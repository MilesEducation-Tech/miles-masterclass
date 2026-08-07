import { Routes } from '@angular/router';
import { validateProfessionCountryGuard } from './shared/core/guards/validate-profession-country.guard';
import { isExistingUserGuard } from './shared/core/guards/is-existing-user.guard';
import { rootRedirectGuard } from './shared/core/guards/root-redirect.guard';
import { PageNotFound } from './pages/page-not-found/page-not-found';
import { BlogLayout } from './pages/blog-layout/blog-layout';
import { Compliance } from './pages/compliance/compliance';

export const routes: Routes = [
  // Declared BEFORE `auth` — Angular matches on prefix, so the `auth` route
  // below would otherwise swallow this and 404 inside `authRoutes`. This is the
  // OAuth redirect target for the AI Labs sign-in popup; it must stay a fixed,
  // allowlistable path (see AI_LABS.redirectPath).
  {
    path: 'auth/ai-labs-callback',
    loadComponent: () =>
      import('./pages/ai-labs-callback/ai-labs-callback').then((m) => m.AiLabsCallback),
  },

  { path: 'auth', loadChildren: () => import('./auth/auth').then((m) => m.authRoutes) },

  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes),
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
          import('./features/blog/pages/blog-home/blog-home').then((m) => m.BlogHome),
      },
      {
        // Browse / search — declared before `:slug` so "all" isn't read as a slug.
        path: 'all',
        loadComponent: () =>
          import('./features/blog/pages/blog-all/blog-all').then((m) => m.BlogAll),
      },
      {
        path: ':slug',
        loadComponent: () =>
          import('./features/blog/pages/blog-post/blog-post').then((m) => m.BlogPost),
      },
    ],
  },
  {
    path: ':country/:profession_type',
    canActivate: [validateProfessionCountryGuard, isExistingUserGuard],
    loadChildren: () => import('./features/features').then((m) => m.featuresRoutes),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [rootRedirectGuard],
    children: [], // Guard handles navigation
  },
  { path: '**', redirectTo: 'page-not-found' },
];
