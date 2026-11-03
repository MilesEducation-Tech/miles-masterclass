import {
  ApplicationConfig,
  DOCUMENT,
  inject,
  PLATFORM_ID,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  IsActiveMatchOptions,
  NavigationError,
  provideRouter,
  Router,
  ViewTransitionInfo,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';

import { provideDialogConfig } from 'ng-primitives/dialog';
import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideIconsProvider } from './configuration/ng-icon';
import { provideLanguage } from './configuration/language';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appInterceptor } from '@core/interceptors/app/app-interceptor';
import { loadingInterceptor } from '@core/interceptors/loading/loading-interceptor';
import { Network } from '@core/services/network/network';
import { UpdateChecker } from '@shared/services/update-checker';
import { TOAST_COMPONENT } from '@core/services/notification/notification';
import {
  MASTERCLASS_COURSE_INFO_DIALOG,
  SUBSCRIPTION_DIALOG,
} from '@core/services/dialog/feature-dialog-tokens';
import { Toast } from '@shared/ui/toast/toast';

/** The page already showing, whatever its query string or fragment says. */
const SAME_PAGE: IsActiveMatchOptions = {
  paths: 'exact',
  matrixParams: 'exact',
  queryParams: 'ignored',
  fragment: 'ignored',
};

/** On `<html>` while a same-page transition runs; `styles/animation.css` turns its animation off. */
const SAME_PAGE_TRANSITION_CLASS = 'same-page-navigation';

/**
 * View transitions animate a change of page. A navigation that stays on the page and only rewrites
 * its query string (the sign-in card switching between password and code, and Back between them;
 * the invoice keeping `?status=` in step) would otherwise slide and fade the whole document for a
 * change inside it.
 *
 * why: the transition runs with no animation rather than being skipped. `skipTransition()` rejects
 * `ready`, and the router logs that rejection as an AbortError in dev builds.
 *
 * The router hasn't committed the new URL yet when this runs, so `isActive` still describes the
 * page being left (Angular's documented recipe for this check).
 */
function instantSamePageTransition({ transition }: ViewTransitionInfo): void {
  const router = inject(Router);
  const target = router.currentNavigation()?.finalUrl;
  if (!target || !router.isActive(target, SAME_PAGE)) return;

  const root = inject(DOCUMENT).documentElement;
  root.classList.add(SAME_PAGE_TRANSITION_CLASS);
  const done = (): void => root.classList.remove(SAME_PAGE_TRANSITION_CLASS);
  transition.finished.then(done, done);
}

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
      // loadingInterceptor is first, so the loading bar also covers the token
      // refresh appInterceptor waits on before sending.
      withInterceptors([loadingInterceptor, appInterceptor]),
    ),
    provideClientHydration(
      withEventReplay(),
      // Lets a `@defer (hydrate on …)` block render its content on the server and
      // hydrate later. A plain `@defer` still serves only its placeholder.
      withIncrementalHydration(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
      }),
    ),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withViewTransitions({ onViewTransitionCreated: instantSamePageTransition }),
      withNavigationErrorHandler(recoverFromStaleChunk),
    ),
    provideIconsProvider(),
    // The visitor's language: LOCALE_ID, its locale data, and <html lang dir>.
    provideLanguage(),
    // ng-primitives closes open dialogs on every navigation by default; the hand-rolled
    // Dialog service never did, and several dialogs change the route or query params
    // themselves. Kept as it was (Phase 10 decision, STATE.md).
    provideDialogConfig({ closeOnNavigation: false }),
    // Binds the core NotificationService to the shared toast component. Only the
    // composition root may name both sides — see TOAST_COMPONENT.
    { provide: TOAST_COMPONENT, useValue: Toast },
    {
      provide: SUBSCRIPTION_DIALOG,
      useValue: () =>
        import('@features/payment/dialogs/subscription-dialog/subscription-dialog').then(
          (m) => m.SubscriptionDialog,
        ),
    },
    // The masterclass "i" dialog, for the home page's cards (features/home may not
    // import features/offerings).
    {
      provide: MASTERCLASS_COURSE_INFO_DIALOG,
      useValue: () =>
        import('@features/offerings/masterclass/dialogs/masterclass-course-info-dialog/masterclass-course-info-dialog').then(
          (m) => m.MasterclassCourseInfoDialog,
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
  ],
};
