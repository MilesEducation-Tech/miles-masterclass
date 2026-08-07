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
import { provideHttpClient } from '@angular/common/http';
import { Network } from './shared/core/services/network/network';
import { UpdateChecker } from './shared/core/services/update-checker/update-checker';
import { Analytics } from './shared/core/services/analytics/analytics';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // ponytail: no interceptors — the Django app/auth/admin-token chain went with
    // the backend strip. HttpClient stays for the WordPress blog and SeoManager.
    // Re-add withInterceptors([...]) when the new backend needs auth headers.
    provideHttpClient(),
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
