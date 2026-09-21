export const PERM = {
  DASHBOARD_VIEW: 'dashboard:view',

  SEO_READ: 'seo:read',
  SEO_WRITE: 'seo:write',
  SEO_DELETE: 'seo:delete',

  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  LEADS_EXPORT: 'leads:export',

  REPORTS_USERS_READ: 'reports:users:read',
  REPORTS_USERS_BLOCK: 'reports:users:block',
  REPORTS_USER_REPORT_READ: 'reports:user_report:read',

  // Partner Platform (B2B licensing) — COARSE page-level gates only. Django's
  // PartnerAdmin.capabilities enforces the fine-grained actions (seat:send,
  // code:create:firm, …) and is surfaced to the UI via /partner-admin/me/.
  PARTNER_PLATFORM_READ: 'partner:platform:read', // partner dashboard — Miles ops only
  PARTNER_TRACKER_READ: 'partner:tracker:read', // network admin (tracker + vendor users, NO dashboard)
  PARTNER_USERS_READ: 'partner:users:read', // sub-company admin (vendor users ONLY)
  PARTNER_PLATFORM_MANAGE: 'partner:platform:manage', // super-admin console (networks, partner codes, provisioning)

  ADMIN_USERS_MANAGE: 'admin:users:manage',
  ADMIN_ROLES_MANAGE: 'admin:roles:manage',
  ADMIN_PERMISSIONS_MANAGE: 'admin:permissions:manage',

  // Audit log — read-only by construction. The table has no insert/update/delete
  // policy at all, so this gates viewing and nothing else. Seeded by
  // 20260918000000_admin_audit_log.sql.
  AUDIT_READ: 'audit:read',

  // User Onboarding — create/edit learner users + record offline payments via the
  // Django internal APIs. One gate for the whole /admin/user-onboarding section.
  USERS_CREATE: 'users:create',
} as const;

export type AdminPermission = (typeof PERM)[keyof typeof PERM];

/**
 * Django keeps ONE PartnerAdmin row (one role + scope) per Supabase login, so
 * these Supabase roles are mutually exclusive. Every other role combines freely.
 * Mirrored server-side by `assert_admin_role_set()`.
 */
export const EXCLUSIVE_ADMIN_ROLE_SLUGS: ReadonlySet<string> = new Set([
  'super_admin',
  'partner_platform_admin',
  'partner_network_admin',
  'partner_subcompany_admin',
]);

/** Checkbox semantics for a role set, with radio behaviour inside the exclusive group. */
export function toggleRoleSlug(
  current: ReadonlySet<string>,
  slug: string,
  checked: boolean,
): Set<string> {
  const next = new Set(current);
  if (!checked) {
    next.delete(slug);
    return next;
  }
  if (EXCLUSIVE_ADMIN_ROLE_SLUGS.has(slug)) {
    for (const s of next) if (EXCLUSIVE_ADMIN_ROLE_SLUGS.has(s)) next.delete(s);
  }
  next.add(slug);
  return next;
}
