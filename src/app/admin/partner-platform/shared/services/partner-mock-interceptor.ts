import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { mockRole } from './partner-mock-role';

/**
 * Serves a mock dataset for `docs/PARTNER_PLATFORM_API.md` so the whole
 * three-portal flow is clickable without a provisioned backend account. Off
 * unless the page is on localhost AND `localStorage.partnerMock` is `super`,
 * `network`, or `firm` (the role `/panel/me/` reports back — switch portals
 * with it). Anything it doesn't recognise falls through to the real API.
 *
 * This shell is registered eagerly in `app.config.ts`, so it stays deliberately
 * tiny: the fixtures and handlers are dynamically imported only once the mock
 * is actually switched on, keeping several kB of dev-only data out of the
 * initial bundle.
 *
 * ponytail: a flat URL -> body lookup, no request recording, no persistence —
 * this is for eyeballing the binding, not a test double. It fakes only the
 * DJANGO layer; the Supabase route/sidebar RBAC still needs a real admin login.
 */
export const partnerMockInterceptor: HttpInterceptorFn = (req, next) => {
  const role = mockRole();
  if (!role) return next(req);

  return from(import('./partner-mock-handlers')).pipe(
    switchMap((m) => m.handleMock(req, role, next) ?? next(req)),
  );
};
