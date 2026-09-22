import { AdminAuth } from '@core/services/admin-auth/admin-auth';
import { PERM } from '@core/models/admin/admin-rbac.model';

const LANDING_ROUTES: { perm: string; path: string }[] = [
  { perm: PERM.DASHBOARD_VIEW, path: '/admin/dashboard' },
  { perm: PERM.REPORTS_USERS_READ, path: '/admin/partner-v2/panel/users' },
  { perm: PERM.REPORTS_USER_REPORT_READ, path: '/admin/reports/user-report' },
  { perm: PERM.USERS_CREATE, path: '/admin/partner-v2/superadmin/onboarding' },
  { perm: PERM.SEO_READ, path: '/admin/seo' },
  { perm: PERM.LEADS_READ, path: '/admin/leads' },
  // Partner Platform: external panel-only roles hold neither dashboard:view nor
  // any reports:* perm, so they land on the partner surfaces here. V1 routes are
  // commented out, so every landing points at v2.
  { perm: PERM.PARTNER_PLATFORM_MANAGE, path: '/admin/partner-v2/superadmin/networks' },
  { perm: PERM.PARTNER_PLATFORM_READ, path: '/admin/partner-v2/panel/overview' },
  { perm: PERM.PARTNER_TRACKER_READ, path: '/admin/partner-v2/panel/tracker' },
  { perm: PERM.PARTNER_USERS_READ, path: '/admin/partner-v2/panel/users' },
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

/** Where the bare `/admin/partner-v2` lands, by the best partner perm held. */
const PARTNER_V2_LANDING: { perm: string; path: string }[] = [
  { perm: PERM.PARTNER_PLATFORM_MANAGE, path: '/admin/partner-v2/superadmin/networks' },
  { perm: PERM.PARTNER_PLATFORM_READ, path: '/admin/partner-v2/panel/overview' },
  { perm: PERM.PARTNER_TRACKER_READ, path: '/admin/partner-v2/panel/overview' },
  { perm: PERM.PARTNER_USERS_READ, path: '/admin/partner-v2/panel/users' },
  { perm: PERM.USERS_CREATE, path: '/admin/partner-v2/superadmin/onboarding' },
];

export function partnerV2LandingPath(auth: AdminAuth): string {
  for (const route of PARTNER_V2_LANDING) {
    if (auth.hasPermission(route.perm)) return route.path;
  }
  return '/admin/forbidden';
}
