-- =============================================================================
-- Partner roles collapse to exactly two panels
-- =============================================================================
--   partner_network_admin    — Vendor Users + Partner Code Tracker
--   partner_subcompany_admin — Vendor Users ONLY
-- The partner Dashboard page becomes Miles-ops-only: partner:platform:read is
-- now held only by partner_platform_admin + super_admin. Additive & idempotent.
-- =============================================================================

-- 1. New permission: vendor-users-only gate --------------------------------
insert into public.admin_permissions (key, category, label, description) values
  ('partner:users:read', 'partner', 'Vendor Users',
   'Access Vendor Users for the assigned firm/network (no tracker, no dashboard)')
on conflict (key) do nothing;

-- 2. partner_network_admin: platform:read -> tracker:read -------------------
-- (tracker + vendor users, no partner dashboard)
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_network_admin' and p.key = 'partner:tracker:read'
on conflict do nothing;

delete from public.admin_role_permissions
where role_id = (select id from public.admin_roles where slug = 'partner_network_admin')
  and permission_id = (select id from public.admin_permissions where key = 'partner:platform:read');

-- 3. partner_subcompany_admin: tracker:read -> users:read -------------------
-- (vendor users only)
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_subcompany_admin' and p.key = 'partner:users:read'
on conflict do nothing;

delete from public.admin_role_permissions
where role_id = (select id from public.admin_roles where slug = 'partner_subcompany_admin')
  and permission_id = (select id from public.admin_permissions where key = 'partner:tracker:read');

-- 4. super_admin keeps every permission (explicit, keeps the catalog honest) -
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'super_admin' and p.key = 'partner:users:read'
on conflict do nothing;

-- 5. Role descriptions reflect the new panels --------------------------------
update public.admin_roles set description =
  'Partner HQ login — Partner Code Tracker + Vendor Users. Django enforces per-capability actions (create sub-company, send coupon) and network scope.'
where slug = 'partner_network_admin';

update public.admin_roles set description =
  'Partner firm login — Vendor Users only (no tracker, no dashboard). Scope enforced by the Django PartnerAdmin.'
where slug = 'partner_subcompany_admin';
