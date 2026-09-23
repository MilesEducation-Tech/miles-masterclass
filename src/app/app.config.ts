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
import { appInterceptor } from '@core/interceptors/app/app-interceptor';
import { adminTokenInterceptor } from '@admin/core/interceptors/admin-token-interceptor';
import { devInterceptors } from '@core/interceptors/dev/dev-interceptors';
import { Network } from '@core/services/network/network';
import { UpdateChecker } from '@shared/services/update-checker';
import { Analytics } from '@core/services/analytics/analytics';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(
      // devInterceptors is spread last so the partner mock it carries on
      // local/development builds still short-circuits only fully-prepared
      // requests; it no-ops unless localStorage.partnerMock is set. In
      // production the array is empty, so nothing mock-related is reachable.
      withInterceptors([appInterceptor, adminTokenInterceptor, ...devInterceptors]),
    ),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
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
