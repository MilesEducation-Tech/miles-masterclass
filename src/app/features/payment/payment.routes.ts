import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ResolveFn, Routes } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { paymentGuard } from '../../shared/core/guards/payment/payment.guard';
import { PaymentFacade } from './shared/service/payment-facade/payment-facade';

/**
 * Ensures the cart bucket is loaded before any child route activates.
 *
 * Parent-route resolvers run **before** any child route's `canActivate`, so by
 * the time `paymentGuard` evaluates on `/billing` or `/review`, the cart state
 * is guaranteed populated — even on hard refresh / deep-link where the
 * `Payment` shell component hasn't been constructed yet (guards run before
 * components instantiate).
 *
 * Skipped during SSR: the bucket endpoint is authenticated and cart state is a
 * browser-session concept; the protected pages are configured as
 * `RenderMode.Client` in `app.routes.server.ts`.
 */
const cartResolver: ResolveFn<boolean> = () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const facade = inject(PaymentFacade);

  // Always fetch fresh on entry to the payment flow — the cart can change
  // outside the shell (e.g. add-to-cart on the plan page, which is a sibling
  // route), so a cached `cartData` would show stale items/totals. The resolver
  // runs once per shell activation, so this is at most one fetch per entry.
  facade.loadMyBucket({ force: true });

  // Wait for the in-flight request to settle, then unblock activation.
  // `take(1)` completes the stream so the router doesn't hold an open
  // subscription after navigation.
  return toObservable(facade.loading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => true),
  );
};

/**
 * Payment feature routes. Lazy-loaded from `features.ts` via
 * `loadChildren: () => import('./payment/payment.routes').then(m => m.PAYMENT_ROUTES)`.
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
    loadComponent: () => import('./shared/pages/plan/plan').then((m) => m.Plan),
  },
  {
    path: 'invoice/:orderId',
    loadComponent: () => import('./shared/pages/invoice/invoice').then((m) => m.Invoice),
  },
  {
    path: 'order-history',
    loadComponent: () => import('./shared/pages/orders/orders').then((m) => m.Orders),
  },
  {
    path: '',
    // Load the cart bucket once per shell activation. Children's guards rely
    // on this data being present.
    resolve: { cart: cartResolver },
    loadComponent: () => import('./payment').then((m) => m.Payment),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./shared/components/overview-wrapper/overview-wrapper').then(
            (m) => m.OverviewWrapper,
          ),
        children: [
          { path: '', redirectTo: 'cart', pathMatch: 'full' },
          {
            path: 'cart',
            loadComponent: () => import('./shared/pages/cart/cart').then((m) => m.Cart),
            data: { pathType: 'cart' },
          },
          {
            path: 'billing',
            canActivate: [paymentGuard],
            loadComponent: () => import('./shared/pages/billing/billing').then((m) => m.Billing),
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
        loadComponent: () => import('./shared/pages/invoice/invoice').then((m) => m.Invoice),
        data: { pathType: 'review' },
      },
    ],
  },
];
