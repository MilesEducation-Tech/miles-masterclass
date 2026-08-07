import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { Auth } from '../services/auth/auth';

export const isExistingUserGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const currentUser = auth.currentUser();

  // If user is not logged in, let other guards (like guestGuard/authGuard) handle it
  // or redirect to login. For now assuming auth is handled.
  if (!auth.isAuthenticated()) {
    return true;
  }

  // If user is NOT an existing user (is_existing_user === false)
  if (currentUser && !currentUser.is_existing_user) {
    // Allow navigation ONLY to profile
    if (state.url.includes('/auth/profile')) {
      return true;
    }
    // Redirect to profile for any other route
    return router.createUrlTree(['/auth/profile']);
  }

  return true;
};
