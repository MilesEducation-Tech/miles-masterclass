import { httpResource } from '@angular/common/http';
import { Service, computed, inject, linkedSignal, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { apiUrl } from '../api-client/api-client';
import { CartDetails, PAYMENT_ROUTES } from '../../models/payment.model';
import { RouteResponse } from '../../models/http.model';

type MyBucketResponse = RouteResponse<typeof PAYMENT_ROUTES.myBucket>;

/**
 * The cart state that non-payment code reads.
 *
 * It lives in `core/` rather than in `PaymentFacade` because the cart is
 * genuinely cross-cutting: the footer overlay shows a count on every page, and
 * two offerings facades watch for removals to refresh their purchased state.
 * Those are `layout` and `feature` respectively, and PROMPT.md §3 lets neither
 * import `features/payment` — so the state they share has to sit below all of
 * them, not inside one of them.
 *
 * Only the *state* moved. Everything that decides cart behaviour — add, remove,
 * coupons, checkout, the mixed-cart rules — stays in `PaymentFacade`, which
 * re-exposes these signals under their original names so its own consumers and
 * call sites are unchanged.
 *
 * Note this is not a lazy-loading trick: deferring an import does not satisfy
 * `boundaries/dependencies` (it flags dynamic `import()` too), so the edge had
 * to be inverted rather than delayed.
 */
@Service()
export class CartStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The id of the course last removed from the cart, for consumers that need to react. */
  readonly cartItemRemoved = signal<number | null>(null);

  /**
   * Has anything actually asked for the cart yet?
   *
   * **This gate is load-bearing and must not be removed.** An `httpResource` whose
   * request function returns a URL is in the `loading` state *from construction* —
   * measured, not assumed — so an ungated resource here would fire an
   * authenticated `mybucket` request the moment anything injected `CartStore`.
   * That includes `Utils` (64 importers) and `footer-overlay`, i.e. every page in
   * the app. The old imperative `loadMyBucket()` only ran when a caller asked, and
   * this preserves that exactly: `undefined` from the request function means idle,
   * no request.
   */
  private readonly wanted = signal(false);

  /**
   * The cart bucket read. Browser-only: the endpoint is authenticated and the
   * whole payment subtree is `RenderMode.Client` in `app.routes.server.ts`, so
   * there was never a server fetch to preserve.
   */
  private readonly bucket = httpResource<MyBucketResponse | null>(
    () => (this.isBrowser && this.wanted() ? apiUrl(PAYMENT_ROUTES.myBucket.path) : undefined),
    // `| null` in the type rather than a cast on the default: the endpoint can
    // legitimately resolve with a null bucket, so null belongs in the type.
    { defaultValue: null },
  );

  /**
   * The cart itself.
   *
   * A `linkedSignal` rather than a plain `computed`, because `setCartData()` is a
   * real external write point: `PaymentFacade` pushes the cart it gets back from a
   * coupon or checkout response straight in, without a refetch. `linkedSignal`
   * re-seeds from the resource whenever it reloads but stays writable in between,
   * which is the same shape `profile.ts` uses for editable fields.
   *
   * `hasValue()` first: `value()` throws on an errored resource even with a
   * `defaultValue` set, and a failed cart fetch must read as an empty cart rather
   * than take the checkout flow down.
   */
  readonly cartData = linkedSignal<CartDetails | null>(() =>
    this.bucket.hasValue() ? (this.bucket.value()?.data ?? null) : null,
  );

  /**
   * `true` only while a fetch is actively in flight — `isLoading()` covers both
   * `loading` and `reloading`. It is `false` in the `idle` state too, which
   * preserves the distinction the previous manual flag existed for: consumers can
   * still tell "no fetch started yet" (`loading=false`, `cartData=null`) from
   * "fetch in flight" (`loading=true`), so `cartResolver` / `paymentGuard` cannot
   * deadlock on a hard refresh.
   */
  readonly loading = computed(() => this.bucket.isLoading());

  /**
   * The failure, as the message string the previous implementation set — callers
   * (notably `paymentGuard`) test it for truthiness, so the shape is kept.
   */
  readonly error = computed(() => (this.bucket.error() ? 'Failed to load my bucket' : null));

  /**
   * `true` once the first load has settled, success OR error. Used for
   * idempotency — `cartData === null` alone is ambiguous, because the API can
   * legitimately resolve with `null` (empty bucket / errored response), and using
   * it as the gate made effects that re-fire on `loading` loop forever.
   */
  readonly cartFetched = computed(() => {
    const status = this.bucket.status();
    return status === 'resolved' || status === 'error' || status === 'local';
  });

  /**
   * Single write-point for the cart signal so any cart-wide massaging happens
   * in one place.
   */
  setCartData(cart: CartDetails | null): void {
    this.cartData.set(cart);
  }

  /**
   * Loads the user's cart bucket. Idempotent by default — won't re-fetch while
   * a request is in flight or after a successful load. Pass `{ force: true }`
   * to bypass the cache (used by the explicit retry button, and by
   * `cartResolver` on every entry into the payment flow).
   *
   * Stays `void` and stays imperative on purpose: five call sites across
   * `layout`, `shared` and `features/payment` call it from effects and event
   * handlers, and a resolver forces it. Only the transport moved to a resource.
   */
  loadMyBucket(options: { force?: boolean } = {}): void {
    if (!this.isBrowser) return;

    // First ask: opening the gate is itself the fetch, so there is nothing to
    // reload yet. Doing both would fire two requests.
    if (!this.wanted()) {
      this.wanted.set(true);
      return;
    }

    if (!options.force) {
      if (this.loading()) return; // already in flight
      if (this.cartFetched()) return; // already attempted (success or error)
    }

    // `reload()` flips the status to `reloading` synchronously — verified against
    // the installed runtime — so a caller that waits on `loading` going false
    // cannot sample a stale "settled" state and skip the wait.
    this.bucket.reload();
  }
}
