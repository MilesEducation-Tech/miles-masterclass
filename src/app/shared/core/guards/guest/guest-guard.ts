import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../../services/auth/auth';

/**
 * Guard that prevents authenticated users from accessing guest-only pages
 * (login, signup, forget-password). Redirects to masterclass if logged in.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    // User is logged in, redirect to masterclass
    router.navigate(['/']);
    return false;
  }

  // User is not logged in, allow access
  return true;
};
