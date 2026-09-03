import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { adminAuthGuard } from './shared/guards/admin-auth.guard';
import { adminGuestGuard } from './shared/guards/admin-guest.guard';
import { permissionGuard } from './shared/guards/permission.guard';
import { PERM } from '../shared/core/models/admin/admin-rbac.model';
import { AdminAuth } from '../shared/core/services/admin-auth/admin-auth';
import { adminLandingPath, partnerV2LandingPath } from './shared/utils/admin-landing';
import { UserOnboardingFacade } from './user-onboarding/shared/services/user-onboarding-facade';

export const adminRoutes: Routes = [
  {
    path: 'login',
    canMatch: [adminGuestGuard],
    loadComponent: () =>
      import('./shared/components/admin-login/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'forgot-password',
    canMatch: [adminGuestGuard],
    loadComponent: () =>
      import('./shared/pages/admin-forgot-password/admin-forgot-password').then(
        (m) => m.AdminForgotPassword,
      ),
  },
  {
    // No guard: arrives with a recovery session but completes recovery; the page
    // itself requires that session to do anything.
    path: 'reset-password',
    loadComponent: () =>
      import('./shared/pages/admin-reset-password/admin-reset-password').then(
        (m) => m.AdminResetPassword,
      ),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./shared/components/forbidden/forbidden').then((m) => m.Forbidden),
  },
  {
    path: '',
    canMatch: [adminAuthGuard],
    loadComponent: () => import('./layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => adminLandingPath(inject(AdminAuth)),
      },
      {
        path: 'dashboard',
        canMatch: [permissionGuard(PERM.DASHBOARD_VIEW)],
        loadComponent: () =>
          import('./dashboard/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'seo',
        canMatch: [permissionGuard(PERM.SEO_READ)],
        loadComponent: () =>
          import('./seo/pages/seo-dashboard/seo-dashboard').then((m) => m.SeoDashboard),
      },
      {
        path: 'seo/bulk',
        canMatch: [permissionGuard(PERM.SEO_WRITE)],
        loadComponent: () =>
          import('./seo/pages/seo-bulk-upload/seo-bulk-upload').then((m) => m.SeoBulkUpload),
      },
      {
        path: 'seo/edit/:slug',
        canMatch: [permissionGuard(PERM.SEO_WRITE)],
        loadComponent: () => import('./seo/pages/seo-editor/seo-editor').then((m) => m.SeoEditor),
      },
      {
        path: 'leads',
        canMatch: [permissionGuard(PERM.LEADS_READ)],
        loadComponent: () => import('./leads/leads').then((m) => m.Leads),
      },
      {
        // "Vendor Users" — Miles reports staff (reports:users:read), network
        // admins (partner:tracker:read) AND sub-company admins (partner:users:read).
        path: 'domain-users',
        canMatch: [
          permissionGuard(
            PERM.REPORTS_USERS_READ,
            PERM.PARTNER_TRACKER_READ,
            PERM.PARTNER_USERS_READ,
          ),
        ],
        loadComponent: () => import('./users/users').then((m) => m.Users),
      },
      {
        // Partner Code Tracker — network admins (tracker:read) only; sub-company
        // admins get Vendor Users only. platform:read (Miles ops) keeps access.
        path: 'partner-code-tracker',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ)],
        loadComponent: () => import('./seat-tracker/seat-tracker').then((m) => m.SeatTracker),
      },
      {
        path: 'reports/user-report',
        canMatch: [permissionGuard(PERM.REPORTS_USER_REPORT_READ)],
        loadComponent: () => import('./user-report/user-report').then((m) => m.UserReport),
      },
      {
        path: 'partner/networks',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () =>
          import('./partner-platform/super-admin/networks/networks').then((m) => m.Networks),
      },
      {
        path: 'partner/networks/:id/tracker',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ)],
        loadComponent: () =>
          import('./partner-platform/super-admin/network-tracker/network-tracker').then(
            (m) => m.NetworkTracker,
          ),
      },
      {
        path: 'partner/partner-codes',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () =>
          import('./partner-platform/super-admin/partner-codes/partner-codes').then(
            (m) => m.PartnerCodes,
          ),
      },
      {
        path: 'partner/reports',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () => import('./partner-platform/reports/reports').then((m) => m.Reports),
      },
      {
        path: 'partner/dashboard',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ)],
        loadComponent: () =>
          import('./partner-platform/network-admin/dashboard/partner-dashboard').then(
            (m) => m.PartnerDashboard,
          ),
      },
      // ---- Partner Platform v2 — full partners/* API coverage. V1 above stays
      // live but deprecated (sidebar badge + page banners) until v2 settles.
      {
        path: 'partner-v2',
        pathMatch: 'full',
        redirectTo: () => partnerV2LandingPath(inject(AdminAuth)),
      },
      // The v2 URL space mirrors the API doc's two bases: `superadmin/*` is the
      // Miles-internal console, `panel/*` is the network/firm-admin surface.
      {
        path: 'partner-v2/superadmin/networks',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () =>
          import('./partner-platform-v2/networks/networks-v2').then((m) => m.NetworksV2),
      },
      {
        // READ can look at the hub; the write actions inside are MANAGE-gated.
        path: 'partner-v2/superadmin/networks/:id',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE, PERM.PARTNER_PLATFORM_READ)],
        loadComponent: () =>
          import('./partner-platform-v2/network-detail/network-detail-v2').then(
            (m) => m.NetworkDetailV2,
          ),
      },
      {
        path: 'partner-v2/superadmin/firms',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () => import('./partner-platform-v2/firms/firms-v2').then((m) => m.FirmsV2),
      },
      {
        path: 'partner-v2/superadmin/codes',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () => import('./partner-platform-v2/codes/codes-v2').then((m) => m.CodesV2),
      },
      {
        path: 'partner-v2/superadmin/partner-admins',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () =>
          import('./partner-platform-v2/partner-admins/partner-admins-v2').then(
            (m) => m.PartnerAdminsV2,
          ),
      },
      {
        path: 'partner-v2/superadmin/reports',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
        loadComponent: () =>
          import('./partner-platform-v2/reports/reports-v2').then((m) => m.ReportsV2),
      },
      {
        // Same componentless-parent pattern as v1 user-onboarding: list + form
        // share ONE route-scoped facade instance (reference data fetched once).
        path: 'partner-v2/superadmin/onboarding',
        canMatch: [permissionGuard(PERM.USERS_CREATE)],
        providers: [UserOnboardingFacade],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./partner-platform-v2/onboarding/onboarding-v2').then((m) => m.OnboardingV2),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./user-onboarding/shared/components/user-form/user-form').then(
                (m) => m.UserForm,
              ),
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./user-onboarding/shared/components/user-form/user-form').then(
                (m) => m.UserForm,
              ),
          },
        ],
      },
      {
        path: 'partner-v2/panel/overview',
        canMatch: [
          permissionGuard(
            PERM.PARTNER_PLATFORM_READ,
            PERM.PARTNER_TRACKER_READ,
            PERM.PARTNER_USERS_READ,
          ),
        ],
        loadComponent: () =>
          import('./partner-platform-v2/overview/partner-overview-v2').then(
            (m) => m.PartnerOverviewV2,
          ),
      },
      {
        path: 'partner-v2/panel/tracker',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ)],
        loadComponent: () =>
          import('./partner-platform-v2/tracker/tracker-v2').then((m) => m.TrackerV2),
      },
      {
        path: 'partner-v2/panel/users',
        canMatch: [
          permissionGuard(
            PERM.REPORTS_USERS_READ,
            PERM.PARTNER_TRACKER_READ,
            PERM.PARTNER_USERS_READ,
          ),
        ],
        loadComponent: () => import('./partner-platform-v2/users/users-v2').then((m) => m.UsersV2),
      },
      {
        // Same adaptive page as the superadmin route — for panel admins the
        // facade reads panel/report/* auto-scoped, with no scope picker.
        path: 'partner-v2/panel/reports',
        canMatch: [permissionGuard(PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ)],
        loadComponent: () =>
          import('./partner-platform-v2/reports/reports-v2').then((m) => m.ReportsV2),
      },
      {
        path: 'admin-users',
        canMatch: [permissionGuard(PERM.ADMIN_USERS_MANAGE)],
        loadComponent: () => import('./admin-users/admin-users').then((m) => m.AdminUsers),
      },
      {
        // Create/edit learner users + record offline payments via the Django
        // internal APIs. Componentless parent so list + create/edit share ONE
        // route-scoped facade instance (reference data fetched once).
        path: 'user-onboarding',
        canMatch: [permissionGuard(PERM.USERS_CREATE)],
        providers: [UserOnboardingFacade],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./user-onboarding/user-onboarding').then((m) => m.UserOnboarding),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./user-onboarding/shared/components/user-form/user-form').then(
                (m) => m.UserForm,
              ),
          },
          {
            path: ':id/edit',
            loadComponent: () =>
              import('./user-onboarding/shared/components/user-form/user-form').then(
                (m) => m.UserForm,
              ),
          },
        ],
      },
      {
        path: 'roles-permissions',
        canMatch: [permissionGuard(PERM.ADMIN_ROLES_MANAGE, PERM.ADMIN_PERMISSIONS_MANAGE)],
        loadComponent: () =>
          import('./roles-permissions/roles-permissions').then((m) => m.RolesPermissions),
      },
      {
        path: '**',
        redirectTo: () => adminLandingPath(inject(AdminAuth)),
      },
    ],
  },
];
