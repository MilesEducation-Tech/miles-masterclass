import { HttpInterceptorFn } from '@angular/common/http';

import { partnerMockInterceptor } from './partner-mock-interceptor';

/**
 * The `local` / `development` replacement for
 * `src/app/core/interceptors/dev/dev-interceptors.ts` (see
 * `fileReplacements` in angular.json). This is the ONLY edge from production
 * wiring into `testing/`, and it exists only in non-production builds.
 */
export const devInterceptors: HttpInterceptorFn[] = [partnerMockInterceptor];
