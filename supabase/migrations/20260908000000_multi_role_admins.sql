-- =============================================================================
-- Multi-role admins + one role per sidenav section
-- =============================================================================
-- 1. admin_user_roles: (user_id) PK -> (user_id, role_id). A user holds MANY
--    roles; effective permissions are the union, per-user denies still win
--    (has_admin_permission() already joins the table un-aggregated).
-- 2. Role catalog: one role per admin sidenav section (super_admin keeps the
--    catch-all short-circuit). `reports:courses:read` is removed — its page
--    never existed. `reports:user_report:read` was in the TS PERM const but
--    never seeded; it is now.
-- 3. Reassignment: per-user grants that fully cover one of the new roles are
--    converted into that role (effective permissions unchanged), then the
--    Admin Users page's "Roles" action fine-tunes via set_admin_user_roles().
-- 4. get_my_admin_profile() returns `roles[]` (keeps `role` = first, for the
--    mid-deploy window); the JWT hook adds `admin_roles[]` next to `admin_role`
--    (Django reads neither — it resolves partner admins by `sub`).
-- 5. provision_admin_user() takes `p_role_slugs text[]`; the old 7-arg
--    signature is dropped so rpc() calls can't hit an ambiguous overload.
--
-- Partner exclusivity: Django keeps ONE PartnerAdmin row per supabase_uid with
-- ONE role/scope, so `super_admin`, `partner_platform_admin`,
-- `partner_network_admin`, `partner_subcompany_admin` are mutually exclusive.
-- Enforced here in both RPCs and mirrored by the UI.
--
-- Additive & idempotent — every statement is safe to re-run.
-- =============================================================================

-- 1. Composite PK ---------------------------------------------------------------
alter table public.admin_user_roles drop constraint if exists admin_user_roles_pkey;
alter table public.admin_user_roles
  add constraint admin_user_roles_pkey primary key (user_id, role_id);
create index if not exists admin_user_roles_role_id_idx
  on public.admin_user_roles (role_id);

-- 2. Helper: does the CALLER hold a role? ----------------------------------------
create or replace function public.current_admin_has_role(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from admin_user_roles ur
    join admin_roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.slug = p_slug
  );
$$;

grant execute on function public.current_admin_has_role(text) to authenticated;

-- 3. Catalog ------------------------------------------------------------------
-- Dead page: no route ever served /admin/reports/courses. Cascades to
-- admin_role_permissions / admin_user_permissions.
delete from public.admin_permissions where key = 'reports:courses:read';

insert into public.admin_permissions (key, category, label, description) values
  ('reports:user_report:read', 'reports', 'View User Report', 'Per-user course reports')
on conflict (key) do nothing;

insert into public.admin_roles (slug, name, description, is_system) values
  ('seo_manager',            'SEO Manager',            'Content → SEO pages', false),
  ('leads_manager',          'Leads Manager',          'People → Leads', false),
  ('reports_viewer',         'Reports Viewer',         'Reports → User report', false),
  ('partner_platform_admin', 'Partner Platform Admin',
   'Miles ops — Partner v2 super-admin console + User Onboarding. Also needs a Django PartnerAdmin(role=super) row; the Admin Users page creates it.',
   false),
  ('admin_manager',          'Administration',         'Admin Users + Roles & permissions', false)
on conflict (slug) do nothing;

-- dashboard:view rides along with every Miles-internal role (as the original
-- seeds did) so each has a landing page. Partner-external roles get none.
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r
join public.admin_permissions p on p.key = any (
  case r.slug
    when 'seo_manager'            then array['dashboard:view', 'seo:read', 'seo:write', 'seo:delete']
    when 'leads_manager'          then array['dashboard:view', 'leads:read', 'leads:write', 'leads:export']
    when 'reports_viewer'         then array['dashboard:view', 'reports:user_report:read']
    when 'partner_platform_admin' then array['dashboard:view', 'partner:platform:manage', 'partner:platform:read', 'users:create']
    when 'admin_manager'          then array['dashboard:view', 'admin:users:manage', 'admin:roles:manage', 'admin:permissions:manage']
    else '{}'::text[]
  end)
on conflict do nothing;

-- super_admin keeps every key (catalog honesty — the SQL short-circuit already
-- grants it, explicit rows keep the admin UI lists truthful).
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'super_admin'
on conflict do nothing;

-- 4. Reassign: per-user grants that fully cover a new role become that role ---
-- Strict full-cover only; internal roles only; partner_platform_admin is skipped
-- for anyone already holding another Django-mapped role (exclusivity). Covered
-- grants are deleted so the role is the single source of truth from here on.
-- Re-running is a no-op once the grants are gone.
with role_sets as (
  select r.id as role_id, r.slug, array_agg(p.key) as keys
  from public.admin_roles r
  join public.admin_role_permissions rp on rp.role_id = r.id
  join public.admin_permissions p on p.id = rp.permission_id
  where r.slug in ('seo_manager', 'leads_manager', 'reports_viewer',
                   'admin_manager', 'partner_platform_admin')
  group by r.id, r.slug
), user_grants as (
  select up.user_id, array_agg(p.key) as keys
  from public.admin_user_permissions up
  join public.admin_permissions p on p.id = up.permission_id
  where up.granted
  group by up.user_id
), matches as (
  select ug.user_id, rs.role_id, rs.keys
  from user_grants ug
  join role_sets rs on rs.keys <@ ug.keys
  where not (
    rs.slug = 'partner_platform_admin'
    and exists (
      select 1
      from public.admin_user_roles ur
      join public.admin_roles r on r.id = ur.role_id
      where ur.user_id = ug.user_id
        and r.slug in ('super_admin', 'partner_network_admin', 'partner_subcompany_admin')
    )
  )
), ins as (
  insert into public.admin_user_roles (user_id, role_id)
  select user_id, role_id from matches
  on conflict do nothing
  returning user_id
)
delete from public.admin_user_permissions up
using matches m
join public.admin_permissions p on p.key = any (m.keys)
where up.user_id = m.user_id
  and up.permission_id = p.id
  and up.granted;

-- 5. Profile RPC: roles[] (+ role = first, super_admin first then by slug) ----
create or replace function public.get_my_admin_profile()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with my_roles as (
    select r.*
    from admin_roles r
    join admin_user_roles ur on ur.role_id = r.id
    where ur.user_id = auth.uid()
  )
  select json_build_object(
    'user', (select row_to_json(u) from admin_users u where u.user_id = auth.uid()),
    'role', (
      select row_to_json(m) from my_roles m
      order by (m.slug <> 'super_admin'), m.slug
      limit 1
    ),
    'roles', coalesce((
      select json_agg(row_to_json(m) order by (m.slug <> 'super_admin'), m.slug)
      from my_roles m
    ), '[]'::json),
    'permissions', coalesce((
      select json_agg(distinct p.key order by p.key)
      from admin_permissions p
      where public.has_admin_permission(p.key)
    ), '[]'::json),
    'email_domains', coalesce((
      select json_agg(distinct d.domain order by d.domain)
      from admin_user_email_domains d
      where d.user_id = auth.uid()
    ), '[]'::json)
  );
$$;

grant execute on function public.get_my_admin_profile() to authenticated;

-- 6. JWT hook: admin_role (primary, unchanged shape) + admin_roles[] ----------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  claims    jsonb := event->'claims';
  uid       uuid  := (event->>'user_id')::uuid;
  v_roles   text[];
  v_domains jsonb;
begin
  select coalesce(array_agg(r.slug order by (r.slug <> 'super_admin'), r.slug), '{}')
    into v_roles
    from admin_users u
    join admin_user_roles ur on ur.user_id = u.user_id
    join admin_roles r on r.id = ur.role_id
   where u.user_id = uid
     and u.is_active;

  if cardinality(v_roles) = 0 then
    return event;  -- not an admin: token unchanged
  end if;

  select coalesce(jsonb_agg(distinct d.domain), '[]'::jsonb)
    into v_domains
    from admin_user_email_domains d
   where d.user_id = uid;

  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'::jsonb));
  claims := jsonb_set(claims, '{app_metadata,admin_role}',  to_jsonb(v_roles[1]));
  claims := jsonb_set(claims, '{app_metadata,admin_roles}', to_jsonb(v_roles));
  claims := jsonb_set(claims, '{app_metadata,email_domains}', v_domains);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- 7. provision_admin_user(p_role_slugs text[]) ---------------------------------
drop function if exists public.provision_admin_user(text, text, text, text[], text[], text[], text);

create or replace function public.provision_admin_user(
  p_email       text,
  p_full_name   text,
  p_role_slugs  text[],
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
  v_email text := lower(trim(p_email));
  v_slugs text[] := array(select distinct unnest(p_role_slugs));
  -- Keep in sync with INITIAL_ADMIN_PASSWORD in admin-provisioning.ts.
  v_initial_password constant text := 'Miles@12345';
begin
  -- ---- authorize -----------------------------------------------------------
  -- admin:users:manage provisions any set; a partner network admin may
  -- provision exactly one sub-company admin login for its own firms.
  if not (
    public.has_admin_permission('admin:users:manage')
    or (v_slugs = array['partner_subcompany_admin']
        and public.current_admin_has_role('partner_network_admin'))
  ) then
    raise exception 'not authorized to provision an admin user';
  end if;

  -- ---- validate ------------------------------------------------------------
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid email: %', p_email;
  end if;
  perform public.assert_admin_role_set(v_slugs);

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
          report_type = coalesce(excluded.report_type, admin_users.report_type);

  -- ---- 3. email domains (replace the full set) -----------------------------
  delete from admin_user_email_domains where user_id = v_uid;
  insert into admin_user_email_domains (user_id, domain)
    select v_uid, lower(trim(d))
    from unnest(coalesce(p_domains, '{}')) as d
    where trim(d) <> ''
    on conflict do nothing;

  -- ---- 4. roles (replace the full set) -------------------------------------
  delete from admin_user_roles
   where user_id = v_uid
     and role_id not in (select id from admin_roles where slug = any(v_slugs));
  insert into admin_user_roles (user_id, role_id)
    select v_uid, id from admin_roles where slug = any(v_slugs)
    on conflict do nothing;

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

grant execute on function public.provision_admin_user(text, text, text[], text[], text[], text[], text)
  to authenticated;

-- 8. Shared validation for a role set (used by both RPCs) ----------------------
create or replace function public.assert_admin_role_set(p_slugs text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_partner_count int;
begin
  if p_slugs is null or cardinality(p_slugs) = 0 then
    raise exception 'at least one role is required';
  end if;
  if (select count(*) from admin_roles where slug = any(p_slugs)) <> cardinality(p_slugs) then
    raise exception 'unknown role slug in %', p_slugs;
  end if;
  -- One Django PartnerAdmin row per login → one Django-mapped role per admin.
  select count(*) into v_partner_count
    from unnest(p_slugs) s
   where s in ('super_admin', 'partner_platform_admin',
               'partner_network_admin', 'partner_subcompany_admin');
  if v_partner_count > 1 then
    raise exception 'pick at most one of super_admin / partner_platform_admin / partner_network_admin / partner_subcompany_admin';
  end if;
  -- super_admin bypasses every permission check, so only a super may grant it.
  if 'super_admin' = any(p_slugs) and not public.current_admin_has_role('super_admin') then
    raise exception 'only a super admin can grant super_admin';
  end if;
end;
$$;

grant execute on function public.assert_admin_role_set(text[]) to authenticated;

-- 9. set_admin_user_roles(): the "Roles" action on Admin Users ----------------
create or replace function public.set_admin_user_roles(p_user_id uuid, p_role_slugs text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slugs text[] := array(select distinct unnest(p_role_slugs));
  v_super uuid := (select id from admin_roles where slug = 'super_admin');
begin
  if not public.has_admin_permission('admin:users:manage') then
    raise exception 'not authorized to change admin roles';
  end if;
  if not exists (select 1 from admin_users where user_id = p_user_id) then
    raise exception 'not an admin user';
  end if;
  perform public.assert_admin_role_set(v_slugs);

  if not ('super_admin' = any(v_slugs)) then
    if p_user_id = auth.uid() and public.current_admin_has_role('super_admin') then
      raise exception 'you cannot remove super_admin from yourself';
    end if;
    -- Never strand the app without an active super admin.
    if exists (select 1 from admin_user_roles where user_id = p_user_id and role_id = v_super)
       and not exists (
         select 1
         from admin_user_roles ur
         join admin_users u on u.user_id = ur.user_id
         where ur.role_id = v_super and u.is_active and ur.user_id <> p_user_id
       ) then
      raise exception 'cannot remove the last active super admin';
    end if;
  end if;

  delete from admin_user_roles
   where user_id = p_user_id
     and role_id not in (select id from admin_roles where slug = any(v_slugs));
  insert into admin_user_roles (user_id, role_id)
    select p_user_id, id from admin_roles where slug = any(v_slugs)
    on conflict do nothing;
end;
$$;

grant execute on function public.set_admin_user_roles(uuid, text[]) to authenticated;

-- 10. RLS: a direct PostgREST insert must not bypass the super_admin guard -----
drop policy if exists admin_user_roles_manage on public.admin_user_roles;
create policy admin_user_roles_manage on public.admin_user_roles
  for all using (public.has_admin_permission('admin:users:manage'))
  with check (
    public.has_admin_permission('admin:users:manage')
    and (
      role_id <> (select id from public.admin_roles where slug = 'super_admin')
      or public.current_admin_has_role('super_admin')
    )
  );

-- =============================================================================
-- Verification (run as an authenticated super admin)
-- =============================================================================
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.admin_user_roles'::regclass;
-- select r.slug, count(rp.*) from admin_roles r
--   left join admin_role_permissions rp on rp.role_id = r.id group by 1 order by 1;
-- select * from public.get_my_admin_profile();   -- roles[] present, role = first
