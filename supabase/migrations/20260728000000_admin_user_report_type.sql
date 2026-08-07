-- =============================================================================
-- admin_users.report_type — optional report scope for vendor-admin logins
-- =============================================================================
-- Optional free-form tag set when provisioning an admin. The frontend forwards
-- it as the `report_type` query param on the vendor admin (partner users) API.
-- `get_my_admin_profile()` needs no change: its `row_to_json(u)` already
-- serialises every admin_users column, so the new field reaches the client.

alter table public.admin_users add column if not exists report_type text;

-- Re-signature provision_admin_user with an optional p_report_type. Drop the
-- old 6-arg overload first — otherwise 6-arg rpc() calls become ambiguous.
drop function if exists public.provision_admin_user(text, text, text, text[], text[], text[]);

create or replace function public.provision_admin_user(
  p_email       text,
  p_full_name   text,
  p_role_slug   text,
  p_domains     text[] default '{}',
  p_grants      text[] default '{}',
  p_denies      text[] default '{}',
  p_report_type text   default null
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
  -- Keep in sync with INITIAL_ADMIN_PASSWORD in admin-provisioning.ts.
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
  insert into admin_users (user_id, email, full_name, is_active, created_by, report_type)
    values (v_uid, v_email, nullif(trim(coalesce(p_full_name, '')), ''), true, auth.uid(),
      nullif(trim(coalesce(p_report_type, '')), ''))
    on conflict (user_id) do update
      set full_name = excluded.full_name,
          is_active = true,
          -- Only overwrite when a value was provided — re-provisioning without
          -- p_report_type keeps the existing tag.
          report_type = coalesce(excluded.report_type, admin_users.report_type);

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

grant execute on function public.provision_admin_user(text, text, text, text[], text[], text[], text)
  to authenticated;
