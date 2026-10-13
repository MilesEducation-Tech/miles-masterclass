import { httpResource } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { CART_ROUTES, Cart, parseCart } from '@core/models/commerce.model';
import { CartDetails } from '@core/models/payment.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { CountryContext } from '@core/services/country-context/country-context';

/**
 * The learner's CAIRA commerce cart (`GET api/v1/commerce/cart/`).
 *
 * It lives in `core/` rather than in `PaymentFacade` because the cart is
 * genuinely cross-cutting: the footer overlay shows its count on every page,
 * and PROMPT.md §3 doesn't let layout import `features/payment`, so the state
 * has to sit below both of them.
 *
 * Only the read and the state live here. Everything that decides cart
 * behaviour (add, remove, coupons, checkout) stays in `PaymentFacade`.
 */
@Service()
export class CartStore {
  private readonly auth = inject(AuthSession);
  private readonly country = inject(CountryContext).current;

  /**
   * Opt-in: the read CREATES an empty cart when the learner has none, so only
   * pages that show a cart ask for it (`load()`). Reading on every page would
   * leave an empty cart per learner per market. The footer badge shows the
   * count once a payment page has read the cart.
   */
  private readonly wanted = signal(false);

  /**
   * Gated on the boolean `isAuthenticated()`, never on the token, so a token
   * rotation doesn't re-fire the read. The market goes in `X-Country-Code`.
   * `appInterceptor` sets the same value, but naming it here makes the country
   * a dependency, so switching markets reads that market's cart.
   */
  private readonly cartResource = httpResource(
    () =>
      this.wanted() && this.auth.isAuthenticated()
        ? {
            url: apiUrl(CART_ROUTES.cart.path),
            headers: { 'X-Country-Code': this.country().toUpperCase() },
          }
        : undefined,
    { parse: parseCart },
  );

  /** The cart, or `null` until a payment page has read it (and while signed out). */
  readonly cart = computed(() => (this.cartResource.hasValue() ? this.cartResource.value() : null));
  readonly lineCount = computed(() => this.cart()?.lines.length ?? 0);

  /** The first call opts the read in; later calls re-read the cart. */
  load(): void {
    if (this.wanted()) this.cartResource.reload();
    else this.wanted.set(true);
  }

  /**
   * A cart write answered with the whole cart, so no follow-up read is needed.
   * A `cancelled` cart (its last line was removed) is gone: drop it, and the
   * next `load()` starts a new one.
   */
  set(cart: Cart): void {
    this.cartResource.set(cart.status === 'open' ? cart : undefined);
  }

  /** The id of the course last removed from the cart, for consumers that need to react. */
  readonly cartItemRemoved = signal<number | null>(null);

  /**
   * The legacy cart, as the last legacy cart call returned it. Its endpoints
   * answer 404; it goes when PR3 of `prompts/commerce-api-rebind.md` moves the
   * payment pages onto `cart`.
   */
  readonly cartData = signal<CartDetails | null>(null);

  setCartData(cart: CartDetails | null): void {
    this.cartData.set(cart);
  }
}
