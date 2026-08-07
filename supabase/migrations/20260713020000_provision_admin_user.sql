-- =============================================================================
-- provision_admin_user() — create/upsert an admin login from the app (no paste)
-- =============================================================================
-- Ports src/app/admin/admin-users/shared/utils/build-admin-user-sql.ts into a
-- SECURITY DEFINER function so the admin panel can provision logins via
-- supabase.rpc() instead of a copy-paste SQL script.
--
-- Why SECURITY DEFINER: creating auth.users / auth.identities needs elevated
-- privileges the anon client doesn't have (that was the ONLY thing forcing the
-- manual paste — the admin_* RBAC rows are already writable under RLS by a
-- super-admin session). The function runs as its owner (postgres) and gates
-- access internally.
--
-- Authorization (internal):
--   * admin:users:manage  -> may provision ANY role (Miles super-admins)
--   * a partner_network_admin -> may provision ONLY partner_subcompany_admin
--     logins (so an alliance HQ can onboard its sub-company admins). The created
--     login has no data access until Django assigns its firm scope.
--
-- Initial password: a STATIC default (v_initial_password below) is set only when
-- the auth login is first created — existing logins keep their password. The
-- operator shares it with the new admin, who should change it (or use
-- Magic-link / Forgot-password). Keep it in sync with INITIAL_ADMIN_PASSWORD in
-- admin-provisioning.ts.
--
-- ponytail: the auth.users / auth.identities columns mirror GoTrue's internal
-- schema (same load-bearing detail as the old generator). If Supabase changes
-- that schema, update the create branch. search_path includes `extensions` so
-- pgcrypto's crypt()/gen_salt() resolve on Supabase.
-- =============================================================================

create or replace function public.provision_admin_user(
  p_email      text,
  p_full_name  text,
  p_role_slug  text,
  p_domains    text[] default '{}',
  p_grants     text[] default '{}',
  p_denies     text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid;
  v_role_id uuid;
  v_email text := lower(trim(p_email));
  -- Static initial password handed to new admins. Meets Supabase's complexity
  -- floor (upper + lower + digit + symbol). Keep in sync with
  -- INITIAL_ADMIN_PASSWORD in admin-provisioning.ts. Ask admins to change it on
  -- first sign-in (or use Forgot-password / Magic-link) — a shared static
  -- password is a deliberate, lower-security convenience.
  v_initial_password constant text := 'Miles@12345';
begin
  -- ---- authorize -----------------------------------------------------------
  if not (
    public.has_admin_permission('admin:users:manage')
    or (
      p_role_slug = 'partner_subcompany_admin'
      and exists (
        select 1
        from admin_user_roles ur
        join admin_roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and r.slug = 'partner_network_admin'
      )
    )
  ) then
    raise exception 'not authorized to provision an admin user';
  end if;

  -- ---- validate ------------------------------------------------------------
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email: %', p_email;
  end if;

  select id into v_role_id from admin_roles where slug = p_role_slug;
  if v_role_id is null then
    raise exception 'unknown role slug: %', p_role_slug;
  end if;

  -- ---- 1. find or create the auth login ------------------------------------
  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at, created_at, updated_at,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token,
        raw_app_meta_data, raw_user_meta_data)
      values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', v_email, crypt(v_initial_password, gen_salt('bf')),
        now(), now(), now(),
        '', '', '',
        '', '',
        '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
      values (gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now());
  end if;

  -- ---- 2. admin profile (idempotent) ---------------------------------------
  insert into admin_users (user_id, email, full_name, is_active, created_by)
    values (v_uid, v_email, nullif(trim(coalesce(p_full_name, '')), ''), true, auth.uid())
    on conflict (user_id) do update
      set full_name = excluded.full_name, is_active = true;

  -- ---- 3. email domains (replace the full set) -----------------------------
  delete from admin_user_email_domains where user_id = v_uid;
  insert into admin_user_email_domains (user_id, domain)
    select v_uid, lower(trim(d))
    from unnest(coalesce(p_domains, '{}')) as d
    where trim(d) <> ''
    on conflict do nothing;

  -- ---- 4. role -------------------------------------------------------------
  insert into admin_user_roles (user_id, role_id)
    values (v_uid, v_role_id)
    on conflict (user_id) do update set role_id = excluded.role_id;

  -- ---- 5. per-user permission overrides ------------------------------------
  if array_length(p_grants, 1) is not null then
    insert into admin_user_permissions (user_id, permission_id, granted)
      select v_uid, p.id, true from admin_permissions p where p.key = any(p_grants)
      on conflict (user_id, permission_id) do update set granted = true;
  end if;
  if array_length(p_denies, 1) is not null then
    insert into admin_user_permissions (user_id, permission_id, granted)
      select v_uid, p.id, false from admin_permissions p where p.key = any(p_denies)
      on conflict (user_id, permission_id) do update set granted = false;
  end if;

  return v_uid;
end;
$$;

grant execute on function public.provision_admin_user(text, text, text, text[], text[], text[])
  to authenticated;
