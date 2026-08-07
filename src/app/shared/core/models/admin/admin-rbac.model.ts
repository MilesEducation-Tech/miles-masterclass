export const PERM = {
  DASHBOARD_VIEW: 'dashboard:view',

  SEO_READ: 'seo:read',
  SEO_WRITE: 'seo:write',
  SEO_DELETE: 'seo:delete',

  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  LEADS_EXPORT: 'leads:export',

  REPORTS_COURSES_READ: 'reports:courses:read',
  REPORTS_USERS_READ: 'reports:users:read',
  REPORTS_USERS_BLOCK: 'reports:users:block',
  REPORTS_USER_REPORT_READ: 'reports:user_report:read',

  // Partner Platform (B2B licensing) — COARSE page-level gates only. Django's
  // PartnerAdmin.capabilities enforces the fine-grained actions (coupon:send,
  // code:create:firm, …) and is surfaced to the UI via /partner-admin/me/.
  PARTNER_PLATFORM_READ: 'partner:platform:read', // partner dashboard — Miles ops only
  PARTNER_TRACKER_READ: 'partner:tracker:read', // network admin (tracker + vendor users, NO dashboard)
  PARTNER_USERS_READ: 'partner:users:read', // sub-company admin (vendor users ONLY)
  PARTNER_PLATFORM_MANAGE: 'partner:platform:manage', // super-admin console (networks, partner codes, provisioning)

  ADMIN_USERS_MANAGE: 'admin:users:manage',
  ADMIN_ROLES_MANAGE: 'admin:roles:manage',
  ADMIN_PERMISSIONS_MANAGE: 'admin:permissions:manage',
} as const;

export type AdminPermission = (typeof PERM)[keyof typeof PERM];
