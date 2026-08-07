-- =============================================================================
-- partner:tracker:read — finer gate for sub-company admins
-- =============================================================================
-- Sub-company admins get the Partner Code Tracker + Vendor Users but NOT the
-- network Dashboard. Splitting a narrower perm off partner:platform:read lets
-- the route/sidebar gate them without a /me round-trip. Network admins keep
-- partner:platform:read (full panel). Additive & idempotent.
-- =============================================================================

-- 1. New permission -----------------------------------------------------------
insert into public.admin_permissions (key, category, label, description) values
  ('partner:tracker:read', 'partner', 'Partner Code Tracker',
   'Access the Partner Code Tracker + Vendor Users for the assigned firm (no dashboard)')
on conflict (key) do nothing;

-- 2. Remap partner_subcompany_admin -> tracker:read (drop platform:read) -------
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_subcompany_admin'
  and p.key = 'partner:tracker:read'
on conflict do nothing;

delete from public.admin_role_permissions
where role_id = (select id from public.admin_roles where slug = 'partner_subcompany_admin')
  and permission_id = (select id from public.admin_permissions where key = 'partner:platform:read');

-- 3. super_admin keeps everything (explicit, keeps the catalog UI honest) ------
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'super_admin'
  and p.key = 'partner:tracker:read'
on conflict do nothing;
