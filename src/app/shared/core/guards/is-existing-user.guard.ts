import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Auth } from '../services/auth/auth';

/**
 * Keeps a learner with a half-filled profile on `/auth/profile` until they
 * finish it.
 *
 * Rebound from the deleted `User.is_existing_user` field. Two things are worth
 * knowing about why it reads what it reads:
 *
 * - It does **not** use the `onboarding` flag from the login response.
 *   `web/login-with-email-password` sets that to a hardcoded literal `true`
 *   (`_finalize_login` injects it unconditionally), so trusting it would wave
 *   every incomplete profile straight through.
 * - It reads `Auth.isProfileComplete`, which derives from `v2/status`'s real
 *   column values — the same condition the mobile `verify-otp` computes
 *   server-side: a first name, a full name and an email.
 *
 * `currentUser` is `null` until `fetchMyProfile()` resolves, and on a hard
 * refresh that is one request behind the first navigation. Redirecting on
 * `null` would bounce a complete profile to the onboarding form on every
 * reload, so an unknown profile is allowed through and re-checked once the
 * signal fills.
 */
export const isExistingUserGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);

  // Not signed in — guestGuard/authGuard own this case.
  if (!auth.isAuthenticated()) {
    return true;
  }

  // Profile not loaded yet. Fail open; see the note above.
  if (auth.currentUser() === null) {
    return true;
  }

  if (auth.isProfileComplete()) {
    return true;
  }

  // Already heading there — let them through, or the redirect loops.
  if (state.url.includes('/auth/profile')) {
    return true;
  }

  return router.createUrlTree(['/auth/profile']);
};
