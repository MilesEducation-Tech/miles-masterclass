import { Routes } from '@angular/router';
import { validateProfessionCountryGuard } from '@core/guards/validate-profession-country.guard';
import { rootRedirectGuard } from '@core/guards/root-redirect.guard';
import { onboardingGuard } from '@core/guards/auth/onboarding.guard';
import { PageNotFound } from '@features/page-not-found/pages/page-not-found/page-not-found';
import { BlogLayout } from '@layout/blog-layout/blog-layout';
import { Compliance } from '@features/legal/pages/compliance/compliance';

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
    component: PageNotFound,
  },
  {
    path: 'maintenance',
    component: PageNotFound,
  },

  { path: 'compliance', component: Compliance },
  // Headless WordPress blog, rendered natively via the WP REST API. Top-level
  // `/blog` so the URL matches WordPress's permalinks (`/blog/<slug>`). Uses
  // the standard BlogLayout so the site header + footer wrap the blog pages.
  // Declared before `:country/:profession_type` so `/blog` and `/blog/<slug>`
  // aren't captured as country/profession segments.
  {
    path: 'blog-test',
    component: BlogLayout,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/blog/pages/blog-home/blog-home').then((m) => m.BlogHome),
      },
      {
        // Browse / search — declared before `:slug` so "all" isn't read as a slug.
        path: 'all',
        loadComponent: () =>
          import('@features/blog/pages/blog-all/blog-all').then((m) => m.BlogAll),
      },
      {
        path: ':slug',
        loadComponent: () =>
          import('@features/blog/pages/blog-post/blog-post').then((m) => m.BlogPost),
      },
    ],
  },
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
