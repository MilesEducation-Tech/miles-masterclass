import { beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TOAST_COMPONENT } from '@core/services/notification/notification';
import {
  CART_DRAWER_DIALOG,
  SUBSCRIPTION_DIALOG,
} from '@core/services/dialog/feature-dialog-tokens';
import { ToastComponent } from '@shared/ui/toast/toast';

/**
 * Global unit-test setup, wired via `setupFiles` on the `test` target in
 * angular.json.
 *
 * jsdom ships no `IntersectionObserver`, and several components construct one
 * unguarded inside `afterNextRender` — `section-nav`, the library pagination
 * pages (course / instructor / badge) and the tracker badge lists. Those
 * constructors run on a timer, so they throw AFTER the test that triggered
 * them has finished, and Vitest attributes the unhandled exception to whatever
 * suite happens to be running at that moment. That is why one missing global
 * surfaced as errors in `home.spec.ts` and `masterclass.spec.ts`, which never
 * mention it.
 *
 * The stub deliberately never fires its callback: jsdom performs no layout, so
 * nothing ever intersects and a callback firing here would be fiction. A test
 * that needs intersection behaviour has to drive it explicitly rather than
 * lean on this.
 */
class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  // Added to the DOM lib alongside `rootMargin`; TS 6 requires it on the interface.
  readonly scrollMargin: string = '0px';
  readonly thresholds: readonly number[] = [0];

  observe(): void {
    // Intentionally inert — see the note above.
  }
  unobserve(): void {
    // Intentionally inert — see the note above.
  }
  disconnect(): void {
    // Intentionally inert — see the note above.
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = IntersectionObserverStub;

/**
 * jsdom's `Blob` implements no `text()`. Real browsers do, and
 * `partnerBlobErrorMessage()` calls it to read the JSON body out of a failed
 * `responseType: 'blob'` export — so without this the helper always fell into
 * its catch and every blob test silently asserted the fallback string instead
 * of the code path it names. FileReader is what jsdom does provide.
 */
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

/**
 * Unit tests never touch the network.
 *
 * With no HTTP providers, Angular's root `HttpClient` falls back to `FetchBackend`, which
 * calls the real global `fetch` — so a spec that forgot `provideHttpClientTesting()` was
 * calling the live API. Its reply landed at a random time: a slow one timed the spec's
 * `whenStable()` out, an empty one threw inside whichever spec was running by then. That
 * flaked the suite under `CI=1` only (different scheduling), i.e. in CI and `verify.mjs`.
 *
 * Rejecting here turns that into a deterministic, local failure that names the fix. Specs
 * that exercise `fetch` on purpose (`blob-download`, `update-checker`) stub it themselves,
 * which replaces this for their run.
 */
globalThis.fetch = (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return Promise.reject(
    new Error(
      `Unit test attempted a real network request to ${url}. ` +
        'Add provideHttpClient() + provideHttpClientTesting() to the spec, or stub fetch.',
    ),
  );
};

/**
 * `NotificationService` is a core singleton that resolves the toast component
 * through the `TOAST_COMPONENT` token, because core must not import shared
 * (PROMPT.md §3). `app.config.ts` binds it for the running app; specs get no
 * app config, so without this ~60 suites fail with NG0201 the moment anything
 * injects `NotificationService` — usually transitively, via a facade.
 *
 * This supplies a real dependency rather than silencing anything: it binds the
 * same component the app binds, so a spec that shows a toast exercises the
 * real path. `configureTestingModule` merges across calls, so suites that
 * configure their own module still get this.
 */
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      { provide: TOAST_COMPONENT, useValue: ToastComponent },
      // The loader is only invoked when something actually opens the drawer, so
      // binding the real one here costs nothing at setup and keeps the path faithful.
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
    ],
  });
});

export {};
