-- =============================================================================
-- Partner Users admin — permissions, role, per-admin email-domain assignments
-- =============================================================================
-- Adds the surface the new /admin/users page needs:
--   1. A new permission (`reports:users:block`) so block/unblock can be gated
--      separately from read access.
--   2. A new role (`partner_users_manager`) bundling dashboard:view +
--      reports:users:read + reports:users:block. The Miles Education staff who
--      manage partner end-users get assigned this role.
--   3. `admin_user_email_domains` — links an admin user to one or more partner
--      domains (e.g. `deloitte.com`). The Users page filters the Django
--      `/api/reports/partner-admin/users/` endpoint with the comma-joined list.
--   4. `get_my_admin_profile` is updated to include `email_domains` in the
--      JSON payload alongside `user`, `role`, `permissions` — additive, the
--      existing keys remain unchanged.
-- =============================================================================

-- 1. New permission -----------------------------------------------------------
insert into public.admin_permissions (key, category, label, description) values
  ('reports:users:block', 'reports', 'Block / Unblock Users',
   'Block or unblock partner users from the Users report')
on conflict (key) do nothing;

-- 2. New role ----------------------------------------------------------------
insert into public.admin_roles (slug, name, description, is_system) values
  ('partner_users_manager',
   'Partner Users Manager',
   'Manage end users belonging to assigned partner domain(s)',
   false)
on conflict (slug) do nothing;

-- partner_users_manager -> dashboard:view + reports:users:read + reports:users:block
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_users_manager'
  and p.key in ('dashboard:view', 'reports:users:read', 'reports:users:block')
on conflict do nothing;

-- super_admin keeps every permission (defensive — has_admin_permission
-- short-circuits on r.slug='super_admin', but explicit mapping keeps the admin
-- UI permission lists honest).
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'super_admin'
  and p.key = 'reports:users:block'
on conflict do nothing;

-- 3. admin_user_email_domains ------------------------------------------------
create table if not exists public.admin_user_email_domains (
  user_id  uuid not null references public.admin_users(user_id) on delete cascade,
  domain   text not null,
  primary key (user_id, domain)
);

alter table public.admin_user_email_domains enable row level security;

-- An admin can read their own assignments; super_admin / admin:users:manage can
-- read everyone's.
drop policy if exists admin_user_email_domains_self_read on public.admin_user_email_domains;
create policy admin_user_email_domains_self_read on public.admin_user_email_domains
  for select using (auth.uid() = user_id or public.has_admin_permission('admin:users:manage'));

-- Only admin:users:manage can mutate assignments.
drop policy if exists admin_user_email_domains_manage on public.admin_user_email_domains;
create policy admin_user_email_domains_manage on public.admin_user_email_domains
  for all using (public.has_admin_permission('admin:users:manage'))
  with check (public.has_admin_permission('admin:users:manage'));

-- 4. get_my_admin_profile RPC — additive: now includes email_domains[] ---------
create or replace function public.get_my_admin_profile()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'user', (select row_to_json(u) from admin_users u where u.user_id = auth.uid()),
    'role', (
      select row_to_json(r)
      from admin_roles r
      join admin_user_roles ur on ur.role_id = r.id
      where ur.user_id = auth.uid()
    ),
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

-- =============================================================================
-- Seed: provision a Miles Education admin (OPTIONAL, edit before running)
-- =============================================================================
-- Run this AFTER:
--   1. Creating the auth user in Supabase Dashboard:
--      Authentication -> Users -> "Add user" -> Email + password
--      (Use a real Miles Education admin email + a strong password >= 12 chars)
--   2. Copy that user's UUID from the dashboard.
--   3. Edit the placeholders below and uncomment the do$$ block, then run.
-- =============================================================================

-- ⚠️  REPLACE THESE BEFORE RUNNING ⚠️
-- do $$
-- declare
--   v_user_id   uuid := '00000000-0000-0000-0000-000000000000'::uuid;  -- <-- replace
--   v_email     text := 'partner.admin@mileseducation.com';            -- <-- replace
--   v_full_name text := 'Partner Users Manager';                       -- <-- replace
--   v_domains   text[] := array['deloitte.com'];                       -- <-- one or more
-- begin
--   -- Insert into admin_users
--   insert into public.admin_users (user_id, email, full_name, is_active)
--   values (v_user_id, v_email, v_full_name, true)
--   on conflict (user_id) do update
--     set email = excluded.email,
--         full_name = excluded.full_name,
--         is_active = true;
--
--   -- Assign partner_users_manager role
--   insert into public.admin_user_roles (user_id, role_id)
--   select v_user_id, r.id
--     from public.admin_roles r
--    where r.slug = 'partner_users_manager'
--   on conflict (user_id) do update
--     set role_id = excluded.role_id;
--
--   -- Attach domain(s)
--   insert into public.admin_user_email_domains (user_id, domain)
--   select v_user_id, unnest(v_domains)
--   on conflict do nothing;
-- end $$;

-- =============================================================================
-- Verification queries (after running the block above)
-- =============================================================================
-- 1. Confirm the role link:
--    select au.email, ar.slug
--      from public.admin_users au
--      join public.admin_user_roles ur on ur.user_id = au.user_id
--      join public.admin_roles ar on ar.id = ur.role_id
--     where au.email = 'partner.admin@mileseducation.com';
--
-- 2. Confirm the domain(s):
--    select au.email, d.domain
--      from public.admin_users au
--      join public.admin_user_email_domains d on d.user_id = au.user_id
--     where au.email = 'partner.admin@mileseducation.com';
--
-- 3. Confirm the user has the expected permissions and email_domains (run
--    while signed in as that user via the SQL editor's "Run as authenticated
--    user" option):
--    select * from public.get_my_admin_profile();
