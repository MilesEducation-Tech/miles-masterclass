import { Routes } from '@angular/router';
import { validateProfessionCountryGuard } from '@core/guards/validate-profession-country-guard';
import { rootRedirectGuard } from '@core/guards/root-redirect-guard';
import { onboardingGuard } from '@core/guards/auth/onboarding-guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.authRoutes),
  },

  {
    path: 'admin',
    loadChildren: () => import('@admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'page-not-found',
    loadComponent: () =>
      import('@features/page-not-found/pages/page-not-found/page-not-found').then(
        (m) => m.PageNotFound,
      ),
  },
  {
    path: 'maintenance',
    loadComponent: () =>
      import('@features/page-not-found/pages/page-not-found/page-not-found').then(
        (m) => m.PageNotFound,
      ),
  },

  {
    path: 'compliance',
    loadComponent: () =>
      import('@features/legal/pages/compliance/compliance').then((m) => m.Compliance),
  },
  // Headless WordPress blog, rendered natively via the WP REST API. Top-level
  // `/blog` so the URL matches WordPress's permalinks (`/blog/<slug>`). Uses
  // the standard BlogLayout so the site header + footer wrap the blog pages.
  // Declared before `:country/:profession_type` so `/blog` and `/blog/<slug>`
  // aren't captured as country/profession segments.

  {
    // `onboardingGuard` is the backstop for a first-time learner who navigates
    // away mid-onboarding: the login flow already sends `new_user` to
    // `/auth/profile` after verify, and this stops a deep link from walking
    // past it. It is inert for signed-out visitors, so the public pages are
    // unaffected.
    path: ':country/:profession_type',
    canMatch: [onboardingGuard],
    canActivate: [validateProfessionCountryGuard],
    loadChildren: () => import('@features/features.routes').then((m) => m.featuresRoutes),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [rootRedirectGuard],
    children: [], // Guard handles navigation
  },
  { path: '**', redirectTo: 'page-not-found' },
];
