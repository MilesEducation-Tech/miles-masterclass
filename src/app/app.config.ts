import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideIconsProvider } from './configuration/ng-icon';
import { adminTokenInterceptor } from './shared/core/interceptors/admin-token/admin-token-interceptor';
import { partnerMockInterceptor } from './admin/partner-platform/shared/services/partner-mock-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      // partnerMockInterceptor is last so it short-circuits only fully-prepared
      // requests; it no-ops unless localStorage.partnerMock is set on a dev build.
      withInterceptors([adminTokenInterceptor, partnerMockInterceptor]),
    ),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeRequestsWithAuthHeaders: true,
      }),
    ),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withViewTransitions(),
    ),
    provideIconsProvider(),
  ],
};
