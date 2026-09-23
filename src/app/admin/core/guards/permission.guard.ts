import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AdminAuth } from '@admin/core/services/admin-auth';

/**
 * Permission-gated route guard. Pass one or more permission keys; matches if
 * the signed-in admin has ANY of them. Redirects to /admin/login if not
 * authenticated, /admin/forbidden if authenticated without the permission.
 */
export function permissionGuard(...required: string[]): CanMatchFn {
  return async () => {
    const auth = inject(AdminAuth);
    const router = inject(Router);

    await auth.init();

    if (!auth.isAuthenticated()) return router.parseUrl('/admin/login');
    if (required.length === 0) return true;
    return auth.hasAny(...required) ? true : router.parseUrl('/admin/forbidden');
  };
}
