import { Routes } from '@angular/router';
import { paymentGuard } from '@features/payment/guards/payment-guard';

/**
 * Payment feature routes. Lazy-loaded from `features.routes.ts` via
 * `loadChildren: () => import('@features/payment/payment.routes').then(m => m.PAYMENT_ROUTES)`.
 *
 * Route tree:
 *   /payment/plan                  ← subscription plan picker
 *   /payment/invoice/:orderId      ← standalone invoice
 *   /payment/order-history         ← past orders list
 *   /payment/                      ← Payment shell (header + breadcrumb)
 *     /                            ← OverviewWrapper (sidebar layout)
 *       /cart                      ← cart contents
 *       /billing                   ← guarded: non-empty, non-mixed cart
 *     /review                      ← guarded: cart + selected address
 */
export const PAYMENT_ROUTES: Routes = [
  {
    path: 'plan',
    loadComponent: () => import('@features/payment/pages/plan/plan').then((m) => m.Plan),
  },
  {
    path: 'invoice/:orderId',
    loadComponent: () => import('@features/payment/pages/invoice/invoice').then((m) => m.Invoice),
  },
  {
    path: 'order-history',
    loadComponent: () => import('@features/payment/pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: '',
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
          {
            path: 'billing',
            canActivate: [paymentGuard],
            loadComponent: () =>
              import('@features/payment/pages/billing/billing').then((m) => m.Billing),
            data: { pathType: 'billing' },
          },
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
