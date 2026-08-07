-- =============================================================================
-- Partner Platform RBAC — coarse page-level perms + roles for the B2B panel
-- =============================================================================
-- Supabase gates PAGE ACCESS only. Django's PartnerAdmin.capabilities enforces
-- the fine-grained actions (coupon:send, code:create:firm, …) and network scope
-- from the verified token, surfaced to the UI via /partner-admin/me/.
--
--   1. Two permissions:
--        partner:platform:read   — the network-admin panel (Partner Code
--                                  Tracker, Vendor Users, Dashboard)
--        partner:platform:manage — the super-admin console (networks, partner
--                                  codes, partner-admin provisioning)
--   2. Three roles:
--        partner_network_admin    — external partner HQ (panel access ONLY)
--        partner_subcompany_admin — external firm admin (panel access ONLY)
--        partner_platform_admin   — Miles ops (super console)
--   3. NO get_my_admin_profile() change — it aggregates every key via
--      has_admin_permission(p.key), so the new perms appear the moment they're
--      mapped. NO JWT-hook change — Django maps token.sub -> PartnerAdmin
--      independently of the admin_role / email_domains claim.
-- =============================================================================

-- 1. New permissions ----------------------------------------------------------
insert into public.admin_permissions (key, category, label, description) values
  ('partner:platform:read', 'partner', 'Partner Platform Panel',
   'Access the partner network-admin panel (dashboard, coupon tracker, vendor users)'),
  ('partner:platform:manage', 'partner', 'Manage Partner Platform',
   'Super-admin console: networks, partner codes, and partner-admin provisioning')
on conflict (key) do nothing;

-- 2. New roles ----------------------------------------------------------------
insert into public.admin_roles (slug, name, description, is_system) values
  ('partner_network_admin',
   'Partner Network Admin',
   'Partner HQ login — network dashboard, coupon tracker, vendor users. Django enforces per-capability actions (create sub-company, send coupon) and network scope.',
   false),
  ('partner_subcompany_admin',
   'Partner Sub-company Admin',
   'Partner firm login — same panel, track-only. Cannot create sub-companies or assign coupons (enforced by the Django PartnerAdmin role).',
   false),
  ('partner_platform_admin',
   'Partner Platform Admin',
   'Miles ops — manage networks, partner codes, and partner-admin logins.',
   false)
on conflict (slug) do nothing;

-- partner_network_admin -> partner:platform:read ONLY
-- (no dashboard:view / reports:* / seo:* / leads:* — this isolation is the
--  entire safety mechanism for external partner logins.)
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_network_admin'
  and p.key in ('partner:platform:read')
on conflict do nothing;

-- partner_subcompany_admin -> partner:platform:read ONLY
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_subcompany_admin'
  and p.key in ('partner:platform:read')
on conflict do nothing;

-- partner_platform_admin -> dashboard:view + both partner:platform:* keys
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'partner_platform_admin'
  and p.key in ('dashboard:view', 'partner:platform:read', 'partner:platform:manage')
on conflict do nothing;

-- super_admin keeps every permission (defensive — has_admin_permission
-- short-circuits on slug='super_admin', but explicit rows keep the admin UI
-- permission lists honest).
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.slug = 'super_admin'
  and p.key in ('partner:platform:read', 'partner:platform:manage')
on conflict do nothing;

-- =============================================================================
-- NOTE: partner_users_manager is intentionally NOT granted partner:platform:*.
-- It remains a Miles-internal Vendor Users role (reports:users:read/block).
-- The Vendor Users page gate is `reports:users:read OR partner:platform:read`,
-- so that role keeps its access via reports:users:read.
-- =============================================================================
