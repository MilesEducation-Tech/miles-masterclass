import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../../services/auth/auth';
import { NotificationService } from '../../services/notification/notification';

/**
 * Allows navigation only for users with an active subscription. Authenticated
 * users without a plan are bounced to `/payment/plan` with an info toast so
 * they understand why the redirect happened, and a `returnUrl` query param so
 * the post-subscribe flow can land them on the originally requested page.
 *
 * Pair with `authGuard` (and list `authGuard` first) so anonymous users see
 * the login redirect instead of the plan page.
 *
 * Returns a `UrlTree` so the redirect happens in the same navigation
 * transition — matches the `authGuard` pattern and avoids the flashed-then-
 * cancelled navigation you'd get from `router.navigate` + `return false`.
 *
 * On a hard refresh the `currentPlan` signal starts as `null` (it's only
 * repopulated by the async current-plan fetch that runs after the profile
 * load), so we fall back to the cookie snapshot persisted on the last fetch.
 * This stops an active subscriber from being wrongly bounced to the plan page
 * on reload. The cookie is SSR-safe, so the check also holds during SSR.
 */
export const activePlanGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const notification = inject(NotificationService);

  const plan = auth.currentPlan();
  const isActive = plan ? auth.isPlanActive(plan) : auth.hasActivePlanFromCookie();
  if (isActive) {
    return true;
  }

  notification.info('Subscription Required', 'You need an active plan to access this content.');
  return router.createUrlTree(['/payment/plan'], { queryParams: { returnUrl: state.url } });
};
