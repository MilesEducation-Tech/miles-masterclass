import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';
import { PERM } from '../../../shared/core/models/admin/admin-rbac.model';

const LANDING_ROUTES: { perm: string; path: string }[] = [
  { perm: PERM.DASHBOARD_VIEW, path: '/admin/dashboard' },
  { perm: PERM.REPORTS_USERS_READ, path: '/admin/domain-users' },
  { perm: PERM.REPORTS_COURSES_READ, path: '/admin/reports/courses' },
  { perm: PERM.REPORTS_USER_REPORT_READ, path: '/admin/reports/user-report' },
  { perm: PERM.SEO_READ, path: '/admin/seo' },
  { perm: PERM.LEADS_READ, path: '/admin/leads' },
  // Partner Platform: external panel-only roles hold neither dashboard:view nor
  // any reports:* perm, so they land on the partner surfaces here.
  { perm: PERM.PARTNER_PLATFORM_MANAGE, path: '/admin/partner/networks' },
  { perm: PERM.PARTNER_PLATFORM_READ, path: '/admin/partner/dashboard' },
  { perm: PERM.PARTNER_TRACKER_READ, path: '/admin/partner-code-tracker' },
  { perm: PERM.PARTNER_USERS_READ, path: '/admin/domain-users' },
];

/**
 * Pick the first admin route the signed-in user has permission to access.
 * Falls back to /admin/forbidden when the user has no usable permissions —
 * the static redirect to /admin/dashboard would loop into the forbidden page
 * for any role that doesn't include dashboard:view.
 */
export function adminLandingPath(auth: AdminAuth): string {
  for (const route of LANDING_ROUTES) {
    if (auth.hasPermission(route.perm)) return route.path;
  }
  return '/admin/forbidden';
}
