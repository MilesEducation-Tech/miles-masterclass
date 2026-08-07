-- =============================================================================
-- Admin RBAC schema
-- =============================================================================
-- Permission-string RBAC with per-user grant overrides:
--   1. A user has ONE role (admin_user_roles).
--   2. Roles bundle permissions (admin_role_permissions).
--   3. Per-user grants/denies on top of the role (admin_user_permissions).
--   4. Effective check via has_admin_permission(p_key) — the single source of
--      truth used by every RLS policy and the get_my_admin_profile RPC.
-- =============================================================================

-- 1. Admin user (1:1 with auth.users) -----------------------------------------
create table if not exists public.admin_users (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id),
  last_login_at  timestamptz
);

-- 2. Roles (convenience bundles) ----------------------------------------------
create table if not exists public.admin_roles (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  is_system   boolean not null default false
);

-- 3. Permission catalog -------------------------------------------------------
create table if not exists public.admin_permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  category    text not null,
  label       text not null,
  description text
);

-- 4. Role -> permission default mapping ---------------------------------------
create table if not exists public.admin_role_permissions (
  role_id        uuid references public.admin_roles(id) on delete cascade,
  permission_id  uuid references public.admin_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- 5. User -> role (one role per user) -----------------------------------------
create table if not exists public.admin_user_roles (
  user_id  uuid primary key references public.admin_users(user_id) on delete cascade,
  role_id  uuid not null references public.admin_roles(id) on delete restrict
);

-- 6. Per-user permission overrides --------------------------------------------
--    granted=true  -> additional perm on top of role
--    granted=false -> explicit deny even if role grants it
create table if not exists public.admin_user_permissions (
  user_id        uuid references public.admin_users(user_id) on delete cascade,
  permission_id  uuid references public.admin_permissions(id) on delete cascade,
  granted        boolean not null default true,
  primary key (user_id, permission_id)
);

-- 7. The single source-of-truth permission function ---------------------------
create or replace function public.has_admin_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- super_admin or role-granted, AND not explicitly denied for this user
  select (
    exists (
      select 1
      from admin_users u
      join admin_user_roles ur on ur.user_id = u.user_id
      join admin_roles r on r.id = ur.role_id
      left join admin_role_permissions rp on rp.role_id = r.id
      left join admin_permissions p on p.id = rp.permission_id
      where u.user_id = auth.uid()
        and u.is_active
        and (r.slug = 'super_admin' or p.key = p_key)
    )
    and not exists (
      select 1
      from admin_user_permissions deny
      join admin_permissions dp on dp.id = deny.permission_id
      where deny.user_id = auth.uid()
        and deny.granted = false
        and dp.key = p_key
    )
  )
  -- OR explicitly granted to this user (even without a role)
  or exists (
    select 1
    from admin_user_permissions up
    join admin_permissions p on p.id = up.permission_id
    where up.user_id = auth.uid()
      and up.granted = true
      and p.key = p_key
  );
$$;

grant execute on function public.has_admin_permission(text) to authenticated;

-- 8. Profile RPC: returns { user, role, permissions[] } in one call -----------
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
    ), '[]'::json)
  );
$$;

grant execute on function public.get_my_admin_profile() to authenticated;

-- 9. Touch last_login_at on sign-in (RPC the client calls after signIn) -------
create or replace function public.touch_admin_login()
returns void
language sql
security definer
set search_path = public
as $$
  update public.admin_users
     set last_login_at = now()
   where user_id = auth.uid();
$$;

grant execute on function public.touch_admin_login() to authenticated;

-- =============================================================================
-- RLS — admin_* tables (only super_admin / admin:users:manage can manage)
-- =============================================================================
alter table public.admin_users            enable row level security;
alter table public.admin_roles            enable row level security;
alter table public.admin_permissions      enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles       enable row level security;
alter table public.admin_user_permissions enable row level security;

-- Each admin can read their own row OR if they have admin:users:manage
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users
  for select using (auth.uid() = user_id or public.has_admin_permission('admin:users:manage'));

drop policy if exists admin_users_manage on public.admin_users;
create policy admin_users_manage on public.admin_users
  for all using (public.has_admin_permission('admin:users:manage'))
  with check (public.has_admin_permission('admin:users:manage'));

-- Roles & permissions catalog: readable by any signed-in admin (so the UI can
-- render permission lists), writable only with admin:roles:manage / admin:permissions:manage
drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles
  for select using (auth.uid() is not null);

drop policy if exists admin_roles_manage on public.admin_roles;
create policy admin_roles_manage on public.admin_roles
  for all using (public.has_admin_permission('admin:roles:manage'))
  with check (public.has_admin_permission('admin:roles:manage'));

drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions
  for select using (auth.uid() is not null);

drop policy if exists admin_permissions_manage on public.admin_permissions;
create policy admin_permissions_manage on public.admin_permissions
  for all using (public.has_admin_permission('admin:permissions:manage'))
  with check (public.has_admin_permission('admin:permissions:manage'));

drop policy if exists admin_role_permissions_read on public.admin_role_permissions;
create policy admin_role_permissions_read on public.admin_role_permissions
  for select using (auth.uid() is not null);

drop policy if exists admin_role_permissions_manage on public.admin_role_permissions;
create policy admin_role_permissions_manage on public.admin_role_permissions
  for all using (public.has_admin_permission('admin:roles:manage'))
  with check (public.has_admin_permission('admin:roles:manage'));

drop policy if exists admin_user_roles_self_read on public.admin_user_roles;
create policy admin_user_roles_self_read on public.admin_user_roles
  for select using (auth.uid() = user_id or public.has_admin_permission('admin:users:manage'));

drop policy if exists admin_user_roles_manage on public.admin_user_roles;
create policy admin_user_roles_manage on public.admin_user_roles
  for all using (public.has_admin_permission('admin:users:manage'))
  with check (public.has_admin_permission('admin:users:manage'));

drop policy if exists admin_user_permissions_self_read on public.admin_user_permissions;
create policy admin_user_permissions_self_read on public.admin_user_permissions
  for select using (auth.uid() = user_id or public.has_admin_permission('admin:users:manage'));

drop policy if exists admin_user_permissions_manage on public.admin_user_permissions;
create policy admin_user_permissions_manage on public.admin_user_permissions
  for all using (public.has_admin_permission('admin:users:manage'))
  with check (public.has_admin_permission('admin:users:manage'));

-- =============================================================================
-- RLS — seo_pages (existing table)
-- =============================================================================
alter table public.seo_pages enable row level security;

drop policy if exists seo_public_read on public.seo_pages;
create policy seo_public_read on public.seo_pages for select using (true);

drop policy if exists seo_admin_write on public.seo_pages;
create policy seo_admin_write on public.seo_pages
  for insert with check (public.has_admin_permission('seo:write'));

drop policy if exists seo_admin_update on public.seo_pages;
create policy seo_admin_update on public.seo_pages
  for update using (public.has_admin_permission('seo:write'));

drop policy if exists seo_admin_delete on public.seo_pages;
create policy seo_admin_delete on public.seo_pages
  for delete using (public.has_admin_permission('seo:delete'));

-- =============================================================================
-- Seed: roles
-- =============================================================================
insert into public.admin_roles (slug, name, description, is_system) values
  ('super_admin',    'Super Admin',    'Full access to everything',                           true),
  ('seo_manager',    'SEO Manager',    'Manage SEO pages',                                    false),
  ('leads_manager',  'Leads Manager',  'Manage leads',                                        false),
  ('reports_viewer', 'Reports Viewer', 'View course and user reports',                        false)
on conflict (slug) do nothing;

-- =============================================================================
-- Seed: permission catalog
-- =============================================================================
insert into public.admin_permissions (key, category, label, description) values
  ('dashboard:view',            'dashboard', 'View Dashboard',           'Access the admin dashboard landing page'),
  ('seo:read',                  'seo',       'View SEO',                 'View SEO pages and metadata'),
  ('seo:write',                 'seo',       'Edit SEO',                 'Create and edit SEO pages'),
  ('seo:delete',                'seo',       'Delete SEO',               'Delete SEO pages'),
  ('leads:read',                'leads',     'View Leads',               'View leads list and details'),
  ('leads:write',               'leads',     'Edit Leads',               'Create, update, and delete leads'),
  ('leads:export',              'leads',     'Export Leads',             'Export leads to CSV'),
  ('reports:courses:read',      'reports',   'View Courses Report',      'View the courses report'),
  ('reports:users:read',        'reports',   'View Users Report',        'View the users report'),
  ('admin:users:manage',        'admin',     'Manage Admin Users',       'Create/edit/disable admin users'),
  ('admin:roles:manage',        'admin',     'Manage Roles',             'Create/edit roles and role-permission mappings'),
  ('admin:permissions:manage',  'admin',     'Manage Permission Catalog','Add or remove permission entries')
on conflict (key) do nothing;

-- =============================================================================
-- Seed: role -> permission mappings
-- =============================================================================
-- seo_manager -> dashboard:view + all seo:*
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'seo_manager'
  and p.key in ('dashboard:view', 'seo:read', 'seo:write', 'seo:delete')
on conflict do nothing;

-- leads_manager -> dashboard:view + all leads:*
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'leads_manager'
  and p.key in ('dashboard:view', 'leads:read', 'leads:write', 'leads:export')
on conflict do nothing;

-- reports_viewer -> dashboard:view + all reports:*
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'reports_viewer'
  and p.key in ('dashboard:view', 'reports:courses:read', 'reports:users:read')
on conflict do nothing;

-- super_admin gets every permission rolled in (defensive — has_admin_permission
-- short-circuits on r.slug='super_admin', but explicit mapping makes the
-- admin UI render clean lists for super_admin too).
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'super_admin'
on conflict do nothing;
