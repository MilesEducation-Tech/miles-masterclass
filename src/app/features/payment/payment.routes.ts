import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth/auth-guard';
import { paymentGuard } from '@features/payment/guards/payment-guard';

/**
 * Payment feature routes. Lazy-loaded from `features.routes.ts` via
 * `loadChildren: () => import('@features/payment/payment.routes').then(m => m.PAYMENT_ROUTES)`.
 *
 * Route tree:
 *   /payment/plan                  ← subscription plan picker (public: pricing)
 *   /payment/invoice/:orderId      ← standalone invoice          [signed in]
 *   /payment/order-history         ← past orders list            [signed in]
 *   /payment/                      ← Payment shell (header + breadcrumb) [signed in]
 *     /                            ← OverviewWrapper (sidebar layout)
 *       /cart                      ← cart contents
 *     /review                      ← guarded: non-empty cart; the billing address is optional
 *
 * `authGuard` sits on each signed-in route rather than on the `payment` mount
 * in `features.routes.ts`, because `plan` must stay open to visitors.
 */
export const PAYMENT_ROUTES: Routes = [
  {
    path: 'plan',
    loadComponent: () => import('@features/payment/pages/plan/plan').then((m) => m.Plan),
  },
  // Orders are the learner's own: signed out, both go to sign-in and come straight back.
  {
    path: 'invoice/:orderId',
    canMatch: [authGuard],
    loadComponent: () => import('@features/payment/pages/invoice/invoice').then((m) => m.Invoice),
  },
  {
    path: 'order-history',
    canMatch: [authGuard],
    loadComponent: () => import('@features/payment/pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./payment').then((m) => m.Payment),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('@features/payment/pages/overview-wrapper/overview-wrapper').then(
            (m) => m.OverviewWrapper,
          ),
        children: [
          { path: '', redirectTo: 'cart', pathMatch: 'full' },
          {
            path: 'cart',
            loadComponent: () => import('@features/payment/pages/cart/cart').then((m) => m.Cart),
            data: { pathType: 'cart' },
          },
          // The old `billing` step lives on as a redirect: review collects the address now.
          { path: 'billing', redirectTo: '../review' },
        ],
      },
      {
        path: 'review',
        canActivate: [paymentGuard],
        // TODO(payment): /review currently re-renders the Invoice component as
        // a checkout-review screen. Replace with a dedicated `Review` page when
        // the design lands; the route name and component shouldn't disagree.
        loadComponent: () =>
          import('@features/payment/pages/invoice/invoice').then((m) => m.Invoice),
        data: { pathType: 'review' },
      },
    ],
  },
];
