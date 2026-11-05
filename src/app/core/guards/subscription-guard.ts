import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanMatchFn, PRIMARY_OUTLET, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { AccountApi } from '@core/services/account-api/account-api';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { NotificationService } from '@core/services/notification/notification';

/**
 * Requires a subscription term in force (`AccountApi.hasSubscription`). A learner without one is told
 * why and sent to the plan page of the locale they were in; the menu item that led here stays.
 *
 * - Signed out answers `true`: `authGuard`, listed first, sends the visitor to sign-in, and this
 *   must not toast "Subscription Required" at someone who isn't signed in.
 * - Waits for `user-details/` on a hard refresh, on its `status` rather than `isLoading()`, as
 *   `paymentGuard` waits on the cart.
 * - Only a known "no" redirects. A failed read lets the learner in: unknown never paywalls, and
 *   the page's own reads are gated by the server.
 * - The locale comes off the navigation's URL tree, as in `guestHomeGuard`: this route's own
 *   segments don't include `:country/:profession_type`.
 */
export const subscriptionGuard: CanMatchFn = ():
  Observable<boolean | UrlTree> | boolean | UrlTree => {
  if (!inject(AuthSession).isAuthenticated()) return true;

  const account = inject(AccountApi);
  const router = inject(Router);
  const notification = inject(NotificationService);
  const url = router.currentNavigation()?.extractedUrl ?? router.parseUrl(router.url);

  const check = (): boolean | UrlTree => {
    if (account.hasSubscription() !== false) return true;
    notification.info('Subscription Required', 'You need an active plan to access this content.');
    const [country, profession] = url.root.children[PRIMARY_OUTLET]?.segments ?? [];
    if (!country || !profession) return false;
    return router.createUrlTree(['/', country.path, profession.path, 'payment', 'plan']);
  };
  const settled = (status: string) =>
    status === 'resolved' || status === 'error' || status === 'local';

  if (settled(account.user.status())) return check();
  return toObservable(account.user.status).pipe(filter(settled), take(1), map(check));
};
