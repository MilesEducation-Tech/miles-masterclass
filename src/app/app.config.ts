import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
} from '@angular/platform-browser';
import { provideIconsProvider } from './configuration/ng-icon';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appInterceptor } from './shared/core/interceptors/app/app-interceptor';
import { authInterceptor } from './shared/core/interceptors/auth/auth-interceptor';
import { adminTokenInterceptor } from './shared/core/interceptors/admin-token/admin-token-interceptor';
import { partnerMockInterceptor } from './admin/partner-platform/shared/services/partner-mock-interceptor';
import { Network } from './shared/core/services/network/network';
import { UpdateChecker } from './shared/core/services/update-checker/update-checker';
import { Analytics } from './shared/core/services/analytics/analytics';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      // partnerMockInterceptor is last so it short-circuits only fully-prepared
      // requests; it no-ops unless localStorage.partnerMock is set on a dev build.
      withInterceptors([
        appInterceptor,
        adminTokenInterceptor,
        authInterceptor,
        partnerMockInterceptor,
      ]),
    ),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeRequestsWithAuthHeaders: true, // Cache authenticated requests for SSR
      }),
    ),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withViewTransitions(),
    ),
    provideIconsProvider(),
    // `Network` is `providedIn: 'root'` but only does its job once instantiated
    // (its constructor wires up online/offline + connection.change listeners
    // and surfaces toasts via NotificationService). Eagerly resolve it at
    // environment-init time so monitoring starts on app boot without any
    // component having to inject it.
    provideEnvironmentInitializer(() => {
      inject(Network);
    }),
    // Start the deploy-version watcher (browser-only; a no-op during SSR).
    // Detects when a newer build is live and prompts the user to update.
    provideEnvironmentInitializer(() => {
      inject(UpdateChecker).init();
    }),
    // Boot analytics — production-only, consent-gated, admin-excluded; a no-op
    // during SSR and in non-prod builds (see Analytics.init / environment.ANALYTICS).
    provideEnvironmentInitializer(() => {
      inject(Analytics).init();
    }),
  ],
};
