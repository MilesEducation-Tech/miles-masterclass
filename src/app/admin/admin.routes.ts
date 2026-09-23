import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { adminAuthGuard } from '@admin/core/guards/admin-auth.guard';
import { adminGuestGuard } from '@admin/core/guards/admin-guest.guard';
import { permissionGuard } from '@admin/core/guards/permission.guard';
import { PERM } from '@admin/core/models/admin-rbac.model';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { adminLandingPath, partnerV2LandingPath } from '@admin/core/utils/admin-landing';
import { UserOnboardingFacade } from '@admin/user-onboarding/services/user-onboarding-facade';
import { LeadsFacade } from '@admin/leads/services/leads-facade';
import { UserReportFacade } from '@admin/user-report/services/user-report-facade';
import { RbacFacade } from '@admin/roles-permissions/services/rbac-facade';
import { PartnerAdminMe } from '@admin/core/services/partner-admin-me';
import { PartnerSuperAdminFacade } from '@admin/core/services/partner-superadmin-facade';
import { PartnerNetworkFacade } from '@admin/core/services/partner-network-facade';
import { PartnerReportFacade } from '@admin/partner-platform-v2/services/partner-report-facade';
import { PartnerUsersFacade } from '@admin/users/services/partner-users-facade';

export const adminRoutes: Routes = [
  {
    path: 'login',
    canMatch: [adminGuestGuard],
    loadComponent: () =>
      import('@admin/auth/pages/admin-login/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'forgot-password',
    canMatch: [adminGuestGuard],
    loadComponent: () =>
      import('@admin/auth/pages/admin-forgot-password/admin-forgot-password').then(
        (m) => m.AdminForgotPassword,
      ),
  },
  {
    // No guard: arrives with a recovery session but completes recovery; the page
    // itself requires that session to do anything.
    path: 'reset-password',
    loadComponent: () =>
      import('@admin/auth/pages/admin-reset-password/admin-reset-password').then(
        (m) => m.AdminResetPassword,
      ),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('@admin/auth/pages/forbidden/forbidden').then((m) => m.Forbidden),
  },
  {
    path: '',
    canMatch: [adminAuthGuard],
    loadComponent: () =>
      import('@admin/layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
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
          import('@admin/dashboard/pages/admin-dashboard/admin-dashboard').then(
            (m) => m.AdminDashboard,
          ),
      },
      {
        path: 'seo',
        canMatch: [permissionGuard(PERM.SEO_READ)],
        loadComponent: () =>
          import('@admin/seo/pages/seo-dashboard/seo-dashboard').then((m) => m.SeoDashboard),
      },
      {
        path: 'seo/bulk',
        canMatch: [permissionGuard(PERM.SEO_WRITE)],
        loadComponent: () =>
          import('@admin/seo/pages/seo-bulk-upload/seo-bulk-upload').then((m) => m.SeoBulkUpload),
      },
      {
        path: 'seo/edit/:slug',
        canMatch: [permissionGuard(PERM.SEO_WRITE)],
        loadComponent: () =>
          import('@admin/seo/pages/seo-editor/seo-editor').then((m) => m.SeoEditor),
      },
      {
        path: 'leads',
        providers: [LeadsFacade],
        canMatch: [permissionGuard(PERM.LEADS_READ)],
        loadComponent: () => import('@admin/leads/pages/leads/leads').then((m) => m.Leads),
      },
      // ---- Deprecated: superseded by Partner Platform v2 / partner-v2 onboarding.
      //       {
      //         // "Vendor Users" — Miles reports staff (reports:users:read), network
      //         // admins (partner:tracker:read) AND sub-company admins (partner:users:read).
      //         path: 'domain-users',
      //         canMatch: [
      //           permissionGuard(
      //             PERM.REPORTS_USERS_READ,
      //             PERM.PARTNER_TRACKER_READ,
      //             PERM.PARTNER_USERS_READ,
      //           ),
      //         ],
      //         loadComponent: () => import('@admin/users/pages/users/users').then((m) => m.Users),
      //       },
      //       {
      //         // Partner Code Tracker — network admins (tracker:read) only; sub-company
      //         // admins get Vendor Users only. platform:read (Miles ops) keeps access.
      //         path: 'partner-code-tracker',
      //         canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ)],
      //         loadComponent: () => import('@admin/seat-tracker/pages/seat-tracker/seat-tracker').then((m) => m.SeatTracker),
      //       },
      {
        path: 'reports/user-report',
        providers: [UserReportFacade],
        canMatch: [permissionGuard(PERM.REPORTS_USER_REPORT_READ)],
        loadComponent: () =>
          import('@admin/user-report/pages/user-report/user-report').then((m) => m.UserReport),
      },
      // ---- Deprecated: superseded by Partner Platform v2 / partner-v2 onboarding.
      //       {
      //         path: 'partner/networks',
      //         canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
      //         loadComponent: () =>
      //           import('@admin/partner-platform/pages/networks/networks').then((m) => m.Networks),
      //       },
      //       {
      //         path: 'partner/networks/:id/tracker',
      //         canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ)],
      //         loadComponent: () =>
      //           import('@admin/partner-platform/pages/network-tracker/network-tracker').then(
      //             (m) => m.NetworkTracker,
      //           ),
      //       },
      //       {
      //         path: 'partner/partner-codes',
      //         canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
      //         loadComponent: () =>
      //           import('@admin/partner-platform/pages/partner-codes/partner-codes').then(
      //             (m) => m.PartnerCodes,
      //           ),
      //       },
      //       {
      //         path: 'partner/reports',
      //         canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
      //         loadComponent: () => import('@admin/partner-platform/pages/reports/reports').then((m) => m.Reports),
      //       },
      //       {
      //         path: 'partner/dashboard',
      //         canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ)],
      //         loadComponent: () =>
      //           import('@admin/partner-platform/pages/partner-dashboard/partner-dashboard').then(
      //             (m) => m.PartnerDashboard,
      //           ),
      //       },
      // ---- Partner Platform v2 — full partners/* API coverage. V1 is commented
      // out above; delete it once v2 has settled.
      {
        // One componentless parent so every partner-v2 page shares ONE instance
        // of each facade (me profile, selectFirm drill-down survive within the
        // area) and leaving the area destroys them — aborting in-flight loads
        // and stopping partner calls from firing on unrelated pages.
        path: 'partner-v2',
        providers: [
          PartnerAdminMe,
          PartnerSuperAdminFacade,
          PartnerNetworkFacade,
          PartnerReportFacade,
          PartnerUsersFacade,
        ],
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: () => partnerV2LandingPath(inject(AdminAuth)),
          },
          // The v2 URL space mirrors the API doc's two bases: `superadmin/*` is the
          // Miles-internal console, `panel/*` is the network/firm-admin surface.
          {
            path: 'superadmin/networks',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/networks-v2/networks-v2').then(
                (m) => m.NetworksV2,
              ),
          },
          {
            // READ can look at the hub; the write actions inside are MANAGE-gated.
            path: 'superadmin/networks/:id',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE, PERM.PARTNER_PLATFORM_READ)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/network-detail-v2/network-detail-v2').then(
                (m) => m.NetworkDetailV2,
              ),
          },
          {
            path: 'superadmin/firms',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/firms-v2/firms-v2').then((m) => m.FirmsV2),
          },
          {
            path: 'superadmin/codes',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/codes-v2/codes-v2').then((m) => m.CodesV2),
          },
          {
            path: 'superadmin/partner-admins',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/partner-admins-v2/partner-admins-v2').then(
                (m) => m.PartnerAdminsV2,
              ),
          },
          {
            path: 'superadmin/reports',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_MANAGE)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/reports-v2/reports-v2').then(
                (m) => m.ReportsV2,
              ),
          },
          {
            // Same componentless-parent pattern as v1 user-onboarding: list + form
            // share ONE route-scoped facade instance (reference data fetched once).
            path: 'superadmin/onboarding',
            canMatch: [permissionGuard(PERM.USERS_CREATE)],
            providers: [UserOnboardingFacade],
            children: [
              {
                path: '',
                pathMatch: 'full',
                loadComponent: () =>
                  import('@admin/partner-platform-v2/pages/onboarding-v2/onboarding-v2').then(
                    (m) => m.OnboardingV2,
                  ),
              },
              {
                path: 'new',
                loadComponent: () =>
                  import('@admin/user-onboarding/pages/user-form/user-form').then(
                    (m) => m.UserForm,
                  ),
              },
              {
                path: ':id/edit',
                loadComponent: () =>
                  import('@admin/user-onboarding/pages/user-form/user-form').then(
                    (m) => m.UserForm,
                  ),
              },
            ],
          },
          {
            path: 'panel/overview',
            canMatch: [
              permissionGuard(
                PERM.PARTNER_PLATFORM_READ,
                PERM.PARTNER_TRACKER_READ,
                PERM.PARTNER_USERS_READ,
              ),
            ],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/partner-overview-v2/partner-overview-v2').then(
                (m) => m.PartnerOverviewV2,
              ),
          },
          {
            path: 'panel/tracker',
            canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ, PERM.PARTNER_TRACKER_READ)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/tracker-v2/tracker-v2').then(
                (m) => m.TrackerV2,
              ),
          },
          {
            path: 'panel/users',
            canMatch: [
              permissionGuard(
                PERM.REPORTS_USERS_READ,
                PERM.PARTNER_TRACKER_READ,
                PERM.PARTNER_USERS_READ,
              ),
            ],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/users-v2/users-v2').then((m) => m.UsersV2),
          },
          {
            // Same adaptive page as the superadmin route — for panel admins the
            // facade reads panel/report/* auto-scoped, with no scope picker.
            path: 'panel/reports',
            canMatch: [permissionGuard(PERM.PARTNER_TRACKER_READ, PERM.PARTNER_USERS_READ)],
            loadComponent: () =>
              import('@admin/partner-platform-v2/pages/reports-v2/reports-v2').then(
                (m) => m.ReportsV2,
              ),
          },
        ],
      },
      {
        path: 'admin-users',
        providers: [PartnerSuperAdminFacade],
        canMatch: [permissionGuard(PERM.ADMIN_USERS_MANAGE)],
        loadComponent: () =>
          import('@admin/admin-users/pages/admin-users/admin-users').then((m) => m.AdminUsers),
      },
      // ---- Deprecated: superseded by Partner Platform v2 / partner-v2 onboarding.
      //       {
      //         // Create/edit learner users + record offline payments via the Django
      //         // internal APIs. Componentless parent so list + create/edit share ONE
      //         // route-scoped facade instance (reference data fetched once).
      //         path: 'user-onboarding',
      //         canMatch: [permissionGuard(PERM.USERS_CREATE)],
      //         providers: [UserOnboardingFacade],
      //         children: [
      //           {
      //             path: '',
      //             pathMatch: 'full',
      //             loadComponent: () =>
      //               import('@admin/user-onboarding/pages/user-onboarding/user-onboarding').then((m) => m.UserOnboarding),
      //           },
      //           {
      //             path: 'new',
      //             loadComponent: () =>
      //               import('@admin/user-onboarding/pages/user-form/user-form').then(
      //                 (m) => m.UserForm,
      //               ),
      //           },
      //           {
      //             path: ':id/edit',
      //             loadComponent: () =>
      //               import('@admin/user-onboarding/pages/user-form/user-form').then(
      //                 (m) => m.UserForm,
      //               ),
      //           },
      //         ],
      //       },
      {
        // Read-only: the table has no insert/update/delete policy, so this
        // route can only ever display. No providers — the page owns its own
        // resource() directly.
        path: 'audit-log',
        canMatch: [permissionGuard(PERM.AUDIT_READ)],
        loadComponent: () =>
          import('@admin/audit-log/pages/audit-log/audit-log').then((m) => m.AuditLogPage),
      },
      {
        path: 'roles-permissions',
        providers: [RbacFacade],
        canMatch: [permissionGuard(PERM.ADMIN_ROLES_MANAGE, PERM.ADMIN_PERMISSIONS_MANAGE)],
        loadComponent: () =>
          import('@admin/roles-permissions/pages/roles-permissions/roles-permissions').then(
            (m) => m.RolesPermissions,
          ),
      },
      {
        path: '**',
        redirectTo: () => adminLandingPath(inject(AdminAuth)),
      },
    ],
  },
];
