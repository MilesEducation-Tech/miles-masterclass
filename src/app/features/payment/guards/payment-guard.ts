import { inject, PLATFORM_ID } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { CartStore } from '@core/services/cart/cart-store';
import { NotificationService } from '@core/services/notification/notification';
import { Utils } from '@shared/services/utils';

/**
 * Cart-state guard for `/payment/billing` and `/payment/review`. Reads the
 * required path via `route.data['pathType']` (set on every leaf route).
 *
 * Implementation notes:
 * - Guards run before the payment shell is created, so this asks `CartStore` for
 *   the cart itself. `load()` is idempotent, so the shell's own call adds no
 *   second request.
 * - Waits on the cart read's `status`, not on `isLoading()`: an idle resource is
 *   not loading either, and the router would read a cart that was never fetched.
 *   `local` is a cart a write just stored.
 * - Signed out, the read never runs, so the answer is immediate: back to the cart.
 * - SSR returns `true` because both protected pages are configured as
 *   `RenderMode.Client` in `app.routes.server.ts`; the real check runs in the browser.
 */
export const paymentGuard: CanActivateFn = (
  route,
  _state,
): Observable<boolean | UrlTree> | boolean | UrlTree => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const cart = inject(CartStore);
  const facade = inject(PaymentFacade);
  const router = inject(Router);
  const notification = inject(NotificationService);
  const utils = inject(Utils);
  const cartTree = router.createUrlTree([
    '/',
    utils.country(),
    utils.profession(),
    'payment',
    'cart',
  ]);

  if (!inject(AuthSession).isAuthenticated()) return cartTree;

  cart.load();
  const check = (): boolean | UrlTree => evaluate(route, cart, facade, router, notification, utils);
  const settled = (s: string) => s === 'resolved' || s === 'local' || s === 'error';

  if (settled(cart.status())) return check();
  return toObservable(cart.status).pipe(filter(settled), take(1), map(check));
};

function evaluate(
  route: ActivatedRouteSnapshot,
  cart: CartStore,
  facade: PaymentFacade,
  router: Router,
  notification: NotificationService,
  utils: Utils,
): boolean | UrlTree {
  const pathType = (route.data['pathType'] as string | undefined) ?? '';
  const basePath = ['/', utils.country(), utils.profession(), 'payment'];

  if (cart.lineCount() === 0) {
    notification.error('Empty Cart', 'Add a plan to your cart to continue.');
    return router.createUrlTree([...basePath, 'cart']);
  }

  // ponytail: review still checks the legacy address selection; PR4 of
  // prompts/commerce-api-rebind.md moves it to the cart's `billing_address_id`.
  if (pathType === 'review' && !facade.selectedAddressId()) {
    notification.error('Action Required', 'Please select a billing address to proceed.');
    return router.createUrlTree([...basePath, 'billing']);
  }

  return true;
}
