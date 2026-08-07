import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AdminAuth } from '../../../shared/core/services/admin-auth/admin-auth';
import { AdminRoleSlug } from '../../../shared/core/models/admin/admin-auth.model';

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

/**
 * Denies a route for the given role slugs even when permissions would match.
 * Needed where a shared permission (e.g. the interim `reports:users:read` gate)
 * over-grants a role that must not reach the route. Compose after
 * `permissionGuard`, which runs `auth.init()` so the role slug is loaded.
 */
export function excludeRolesGuard(...roles: AdminRoleSlug[]): CanMatchFn {
  return () => {
    const auth = inject(AdminAuth);
    const router = inject(Router);
    const slug = auth.roleSlug();
    return slug && roles.includes(slug) ? router.parseUrl('/admin/forbidden') : true;
  };
}
