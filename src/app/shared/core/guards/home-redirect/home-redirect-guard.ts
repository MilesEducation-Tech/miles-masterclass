import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../../services/auth/auth';

/**
 * Guard for the root route that dynamically redirects based on auth state.
 * - Logged in users -> /masterclass
 * - Guest users -> /home
 */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    router.navigate(['/masterclass']);
  } else {
    router.navigate(['/home']);
  }

  // Always return false to prevent the current route from activating
  return false;
};
