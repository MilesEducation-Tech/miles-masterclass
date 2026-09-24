import { inject, PLATFORM_ID } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { NotificationService } from '@core/services/notification/notification';
import { Utils } from '@shared/services/utils';

/**
 * Cart-state guard for `/payment/billing` and `/payment/review`. Reads the
 * required path via `route.data['pathType']` (set on every leaf route).
 *
 * Implementation notes:
 * - Uses `toObservable(facade.loading)` rather than `effect + new Promise`. The
 *   router subscribes to the returned observable; if the user navigates away
 *   mid-load the router unsubscribes — no leaked effects, no orphaned promises.
 * - Stays pure: no HTTP fetches kicked off here. The Billing page owns its own
 *   `loadBillingAddress()` call from its constructor.
 * - SSR returns `true` because both protected pages are configured as
 *   `RenderMode.Client` in `app.routes.server.ts`; the server skeleton is
 *   harmless, the real check runs in the browser.
 */
export const paymentGuard: CanActivateFn = (
  route,
  _state,
): Observable<boolean | UrlTree> | boolean | UrlTree => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  const facade = inject(PaymentFacade);
  const router = inject(Router);
  const notification = inject(NotificationService);
  const utils = inject(Utils);

  const checkCartState = (): boolean | UrlTree =>
    evaluate(route, facade, router, notification, utils);

  // Already loaded — answer synchronously, no observable subscription needed.
  if (!facade.loading()) {
    return checkCartState();
  }

  // Wait for the first non-loading emission, then evaluate. `take(1)` completes
  // the stream so the router doesn't hold an open subscription.
  return toObservable(facade.loading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => checkCartState()),
  );
};

function evaluate(
  route: ActivatedRouteSnapshot,
  facade: PaymentFacade,
  router: Router,
  notification: NotificationService,
  utils: Utils,
): boolean | UrlTree {
  const pathType = (route.data['pathType'] as string | undefined) ?? '';
  const basePath = ['/', utils.country(), utils.profession(), 'payment'];

  // Bucket failed to load — kick the user back to /cart to retry.
  if (facade.error()) {
    return router.createUrlTree([...basePath, 'cart']);
  }

  if (pathType === 'billing') {
    if (facade.cartState().isMixedCart) {
      notification.info(
        'Cart contains a subscription along with other courses',
        'After purchasing a subscription, most courses will be accessible at no additional cost. Please remove either all courses or the subscription to proceed.',
      );
      return router.createUrlTree([...basePath, 'cart']);
    }

    if (!facade.hasCartItems()) {
      notification.error('Empty Cart', 'Please add items to your cart to proceed to billing.');
      return router.createUrlTree([...basePath, 'cart']);
    }

    return true;
  }

  if (pathType === 'review') {
    if (!facade.hasCartItems()) {
      notification.error('Empty Cart', 'Please add items to your cart to proceed to review.');
      return router.createUrlTree([...basePath, 'cart']);
    }

    if (!facade.selectedAddressId()) {
      notification.error('Action Required', 'Please select a billing address to proceed.');
      return router.createUrlTree([...basePath, 'billing']);
    }

    return true;
  }

  // Any other route this guard is attached to (defensive — `data.pathType`
  // should always be one of the two cases above).
  return true;
}
