import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthSession } from '../../services/auth-session/auth-session';

/**
 * Keeps a signed-in learner off the sign-in screen.
 *
 * Sends them on to wherever they were originally headed if a `redirect` is
 * still in the URL, so following a stale `/auth/login?redirect=…` link while
 * already signed in lands on the intended page rather than the login form.
 *
 * The query params come from the match snapshot — the navigation has not
 * committed yet at this point, so the router's own state still describes the
 * PREVIOUS page.
 */
export const guestGuard: CanMatchFn = (_route, _segments, snapshot) => {
  const auth = inject(AuthSession);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;

  const redirect = snapshot?.queryParamMap?.get('redirect');
  return router.parseUrl(redirect || '/');
};
