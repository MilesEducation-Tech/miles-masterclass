import {
  ApplicationConfig,
  inject,
  PLATFORM_ID,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  NavigationError,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
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
import { TOAST_COMPONENT } from '@core/services/notification/notification';
import {
  CART_DRAWER_DIALOG,
  SUBSCRIPTION_DIALOG,
} from '@core/services/dialog/feature-dialog-tokens';
import { ToastComponent } from '@shared/ui/toast/toast';

/**
 * Last-resort recovery from version skew, the third layer in
 * docs/engineering/versioning.md §5.
 *
 * A tab running an old bundle asks for a lazy chunk by its old hashed filename.
 * If that file is gone from the current deployment the navigation just dies, so
 * reload onto the new build at the URL the user was heading for — they land where
 * they meant to, on code that exists.
 */
const STALE_CHUNK_RELOAD_KEY = 'app:stale-chunk-reload';

/** Bundler/browser wordings for "the JS you asked for did not load". */
const CHUNK_LOAD_FAILURE =
  /failed to fetch dynamically imported module|error loading dynamically imported module|loading chunk .* failed|importing a module script failed|failed to load module script/i;

function recoverFromStaleChunk(event: NavigationError): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

  // why: only chunk-load failures. A 404 route, a rejected guard or a resolver
  // throwing are all normal navigation errors, and reloading those would put the
  // user in a reload loop over a page that was never going to render.
  const error = event.error as { message?: string } | string | undefined;
  const message = typeof error === 'string' ? error : (error?.message ?? '');
  if (!CHUNK_LOAD_FAILURE.test(message)) return;

  // why: one attempt per URL. If the chunk is missing from the NEW deployment too
  // — a genuinely broken build rather than skew — a second reload loops forever.
  // sessionStorage (not localStorage) so the guard dies with the tab.
  try {
    if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) === event.url) return;
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, event.url);
  } catch {
    // Storage blocked: without a guard we cannot bound the retries, and an
    // infinite reload loop is worse for the user than one failed navigation.
    return;
  }

  location.assign(event.url);
}

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
      withNavigationErrorHandler(recoverFromStaleChunk),
    ),
    provideIconsProvider(),
    // Binds the core NotificationService to the shared toast component. Only the
    // composition root may name both sides — see TOAST_COMPONENT.
    { provide: TOAST_COMPONENT, useValue: ToastComponent },
    // Lets shared/core code open the payment cart drawer without importing the
    // payment feature. The import() stays here, so the dialog stays lazy.
    {
      provide: CART_DRAWER_DIALOG,
      useValue: () =>
        import('@features/payment/dialogs/cart-drawer-dialog/cart-drawer-dialog').then(
          (m) => m.CartDrawerDialog,
        ),
    },
    {
      provide: SUBSCRIPTION_DIALOG,
      useValue: () =>
        import('@features/payment/dialogs/subscription-dialog/subscription-dialog').then(
          (m) => m.SubscriptionDialog,
        ),
    },
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
