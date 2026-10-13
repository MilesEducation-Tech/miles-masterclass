import { Service, signal } from '@angular/core';
import { CartDetails } from '@core/models/payment.model';

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
 * Only the *state* lives here. Everything that decides cart behaviour — add,
 * remove, coupons, checkout, the mixed-cart rules — stays in `PaymentFacade`.
 *
 * There is no cart READ (removed 2026-10-11). `user/cart/mybucket/` is not in
 * the backend's API (Postman) and answers 404; its replacement is
 * `GET api/v1/commerce/cart/`, which lands with the commerce rebind
 * (docs/LEGACY_API_ROADMAP.md). Until then the cart is whatever this session's
 * own mutations answered with: add, remove, coupon and checkout responses all
 * carry the cart, and `PaymentFacade` writes it here. A fresh load starts empty.
 */
@Service()
export class CartStore {
  /** The id of the course last removed from the cart, for consumers that need to react. */
  readonly cartItemRemoved = signal<number | null>(null);

  /** The cart, as the last cart mutation in this session returned it. */
  readonly cartData = signal<CartDetails | null>(null);

  /**
   * Single write-point for the cart signal so any cart-wide massaging happens
   * in one place.
   */
  setCartData(cart: CartDetails | null): void {
    this.cartData.set(cart);
  }
}
