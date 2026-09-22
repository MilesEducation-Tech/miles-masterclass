import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AdminAuth } from '@core/services/admin-auth/admin-auth';

/**
 * Sends already-signed-in admins away from public-only pages (e.g. login).
 */
export const adminGuestGuard: CanMatchFn = async () => {
  const auth = inject(AdminAuth);
  const router = inject(Router);

  await auth.init();

  return auth.isAuthenticated() ? router.parseUrl('/admin') : true;
};
