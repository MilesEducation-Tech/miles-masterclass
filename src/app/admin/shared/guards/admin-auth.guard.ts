import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';

/**
 * Ensures the user is signed in as an admin before matching the route.
 * Redirects to /admin/login otherwise.
 */
export const adminAuthGuard: CanMatchFn = async () => {
  const auth = inject(AdminAuth);
  const router = inject(Router);

  await auth.init();

  return auth.isAuthenticated() ? true : router.parseUrl('/admin/login');
};
