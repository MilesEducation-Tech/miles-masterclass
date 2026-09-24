import { Service, inject, signal } from '@angular/core';
import { ApiClient } from '../api-client/api-client';
import { Logger } from '../logger/logger';
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
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);

  /** The id of the course last removed from the cart, for consumers that need to react. */
  readonly cartItemRemoved = signal<number | null>(null);
  readonly cartData = signal<CartDetails | null>(null);

  /**
   * `true` only while a fetch is actively in flight. Defaults to `false` so
   * consumers can distinguish "no fetch started yet" (`loading=false`,
   * `cartData=null`) from "fetch in flight" (`loading=true`). Without this the
   * `cartResolver` / `paymentGuard` could deadlock on a hard refresh, because
   * the wait would never resolve.
   */
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * `true` after the first `loadMyBucket()` settles (success OR error). Used
   * for idempotency — `cartData === null` alone is ambiguous, because the API
   * can legitimately resolve with `null` (empty bucket / errored response), and
   * using it as the gate made effects that re-fire on `loading` loop forever.
   */
  readonly cartFetched = signal<boolean>(false);

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
   * to bypass the cache (used by the explicit retry button).
   */
  loadMyBucket(options: { force?: boolean } = {}): void {
    if (!options.force) {
      if (this.loading()) return; // already in flight
      if (this.cartFetched()) return; // already attempted (success or error)
    }
    this.loading.set(true);
    this.error.set(null);
    this.http.get<MyBucketResponse>(PAYMENT_ROUTES.myBucket.path).subscribe({
      next: (res) => {
        this.setCartData(res?.data ?? null);
        this.cartFetched.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load my bucket', err);
        this.setCartData(null);
        this.cartFetched.set(true);
        this.error.set('Failed to load my bucket');
        this.loading.set(false);
      },
    });
  }
}
