import { computed, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../../services/auth/auth';

/**
 * Allows navigation only for authenticated users. Anonymous users are redirected
 * to the login page with `?redirect=<requested-path>` — the query param the
 * OTP-verify success handler (auth-facade) reads to send them back where they
 * tried to go.
 *
 * Returns a `UrlTree` (not `false` + `router.navigate`) so the redirect happens
 * in the same router transition — no flashed-then-cancelled navigation.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Read auth state via a local `computed` so the guard's source of truth is
  // the reactive signal. `auth.isLoggedIn` is the token-derived check —
  // synchronous off the cookie, available on the very first navigation after
  // a refresh (before `currentUser` finishes hydrating from `TransferState`).
  // Using the user signal here would intermittently reject valid sessions
  // on fast clicks during boot.
  const isLoggedIn = computed(() => auth.isLoggedIn());

  if (isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], { queryParams: { redirect: state.url } });
};
