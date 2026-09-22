import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Dev-only interceptors. Empty in production — `angular.json`'s `local` and
 * `development` configurations swap this file for
 * `src/app/testing/partner-mock/dev-interceptors.ts`, which registers the
 * Partner Platform mock.
 *
 * Keeping the production copy empty is what keeps ~16 KB of mock fixtures out
 * of the shipped browser and server bundles. Before this split,
 * `app.config.ts` imported `partnerMockInterceptor` directly, so its
 * `import('./partner-mock-handlers')` chunk was emitted in every build and
 * fake partner data shipped to real users. The bundle report asserts it is
 * gone via `--must-not-contain`.
 *
 * This file lives in production space rather than `testing/` on purpose:
 * production code must never import `testing/`.
 */
export const devInterceptors: HttpInterceptorFn[] = [];
