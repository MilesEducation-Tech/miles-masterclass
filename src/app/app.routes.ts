import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { validateProfessionCountryGuard } from '@core/guards/validate-profession-country-guard';
import { rootRedirectGuard } from '@core/guards/root-redirect-guard';
import { onboardingGuard } from '@core/guards/auth/onboarding-guard';
import { CountryContext } from '@core/services/country-context/country-context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An order-status-shaped hint (`paid`, `partial_paid`…); anything else is ignored. */
const STATUS = /^[a-z_]{1,32}$/;

export const routes: Routes = [
  /**
   * The AI Labs Microsoft sign-in popup lands here (`AiLabAuth`). Declared BEFORE `auth` so the
   * prefix match doesn't hand it to the auth feature's routes. Client-rendered, under `auth/**`.
   */
  {
    path: 'auth/ai-labs-callback',
    loadComponent: () =>
      import('@features/auth/pages/ai-lab-callback/ai-lab-callback').then((m) => m.AiLabCallback),
  },
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
    // `notFound` makes the page answer 404 on the server and take the noindex
    // SEO in `App`; `maintenance` below shares the component without it.
    data: { notFound: true },
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
  {
    // Stripe → CAIRA (which settles the payment) → 303 here, with `order_id` and the order's
    // status. CAIRA doesn't know the locale, so this lands the learner on the order's invoice
    // in their country. Listed before `:country/:profession_type`, which `checkout/success`
    // would otherwise match as country "checkout".
    path: 'checkout/:result',
    redirectTo: ({ params, queryParams }) => {
      const router = inject(Router);
      const base = ['/', inject(CountryContext).current(), 'accounting', 'payment'];
      // Untrusted query: only a UUID becomes part of a URL, and only a known result counts.
      const orderId = String(queryParams['order_id'] ?? '');
      const result = params['result'];
      if (!UUID.test(orderId) || (result !== 'success' && result !== 'cancel')) {
        return router.createUrlTree([...base, 'cart']);
      }
      // A hint for the invoice until it reads the order itself.
      const hint = String(queryParams['status'] ?? '');
      const status = result === 'cancel' ? 'cancelled' : STATUS.test(hint) ? hint : 'pending';
      return router.createUrlTree([...base, 'invoice', orderId], { queryParams: { status } });
    },
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
  // Rendered in place, not redirected: the URL a crawler asked for must itself
  // answer 404, or Google indexes `/page-not-found` and keeps every dead URL.
  {
    path: '**',
    data: { notFound: true },
    loadComponent: () =>
      import('@features/page-not-found/pages/page-not-found/page-not-found').then(
        (m) => m.PageNotFound,
      ),
  },
];
