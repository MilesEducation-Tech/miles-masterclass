import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

/**
 * Cart-state guard for `/payment/billing` and `/payment/review`. The required
 * path is declared per leaf route via `route.data['pathType']`.
 *
 * SSR returns `true` because both protected pages are `RenderMode.Client` in
 * `app.routes.server.ts` — the server skeleton is harmless, the real check runs
 * in the browser.
 */
export const paymentGuard: CanActivateFn = (
  _route,
  _state,
): Observable<boolean | UrlTree> | boolean | UrlTree => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;

  // ponytail: this guard gated /payment/billing and /payment/review on cart
  // state read from PaymentFacade, which went with the backend strip. Until the
  // new cart service exists there is nothing to gate on, so both pages are
  // reachable and render their own empty states. Restore `evaluate(...)` below
  // once a cart service is available.
  return true;
};
