import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthSession } from '../../services/auth-session/auth-session';

/**
 * Requires a signed-in learner, and preserves where they were going.
 *
 * `CanMatch` rather than `CanActivate` so a guarded lazy chunk is never even
 * downloaded by a user who cannot reach it — the same choice the admin guards
 * make.
 *
 * The redirect target comes from the in-flight navigation, NOT from the
 * `segments` argument: on a child route `segments` holds only this route's own
 * slice of the path, so rebuilding from it would send the user back to
 * `/profile` instead of `/auth/profile`.
 *
 * No `await init()` is needed: `AuthSession` hydrates synchronously from
 * cookies, and on the server it reads them out of the request headers, so this
 * answers the same way during SSR as it does in the browser.
 */
export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthSession);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  const attempted = router.getCurrentNavigation()?.initialUrl;
  return router.createUrlTree(['/auth/login'], {
    queryParams: attempted ? { redirect: router.serializeUrl(attempted) } : {},
  });
};
