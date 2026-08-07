import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { adminAuthGuard } from './shared/guards/admin-auth.guard';
import { adminGuestGuard } from './shared/guards/admin-guest.guard';
import { permissionGuard } from './shared/guards/permission.guard';
import { PERM } from '../shared/core/models/admin/admin-rbac.model';
import { AdminAuth } from '../shared/core/services/admin-auth/admin-auth';
import { adminLandingPath } from './shared/utils/admin-landing';

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
        loadComponent: () => import('./coupon-tracker/coupon-tracker').then((m) => m.CouponTracker),
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
        path: 'partner/dashboard',
        canMatch: [permissionGuard(PERM.PARTNER_PLATFORM_READ)],
        loadComponent: () =>
          import('./partner-platform/network-admin/dashboard/partner-dashboard').then(
            (m) => m.PartnerDashboard,
          ),
      },
      {
        path: 'admin-users',
        canMatch: [permissionGuard(PERM.ADMIN_USERS_MANAGE)],
        loadComponent: () => import('./admin-users/admin-users').then((m) => m.AdminUsers),
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
