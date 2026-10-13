import { CommonResponse, RouteConfig } from '@core/models/http.model';

/**
 * The CAIRA commerce cart (`api/v1/commerce/cart/`), the one piece of commerce state read outside
 * the payment feature (the footer badge), which is why it lives in core. Orders, plans and addresses
 * belong to `features/payment/models/commerce.model.ts`.
 *
 * The types cover only the keys the app reads; the contract is the CAIRA commerce guide (12 Oct 2026)
 * and `docs/COMMERCE_API.md`.
 */

/**
 * A money amount as CAIRA sends it: a decimal string with two places (`"948.00"`). Display it with
 * `CurrencyPipe` and the owning object's `currency`; never do arithmetic on it. The server computes
 * every total, and the client never sends money.
 */
export type Decimal = string;

/**
 * Whether an amount is worth a row ("Coupon discount −$94.80"). A comparison for display,
 * not arithmetic: the figure itself is still CAIRA's string.
 */
export function hasAmount(amount: Decimal | number | null | undefined): boolean {
  return amount != null && Number(amount) > 0;
}

/** `abandoned` is reserved by the backend and not yet written. */
export type CartStatus = 'open' | 'purchased' | 'cancelled' | 'abandoned';

export interface CartMoney {
  price_before_discount: Decimal;
  discount_amount: Decimal;
  coupon_discount_amount: Decimal;
  gst_amount: Decimal;
  /** What the learner pays now: the total to show. */
  checkout_amount: Decimal;
}

export interface CartLine {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  money: { unit_price: Decimal; unit_discount_price: Decimal | null; final_amount: Decimal };
}

export interface CartCoupon {
  code: string;
  discount_type: string;
  discount_value: Decimal;
  discount_amount: Decimal;
}

/**
 * One open cart per market (`X-Country-Code`), in a single currency. A subscription cart holds at
 * most one line; removing the last line cancels the cart and any pending order on it.
 */
export interface Cart {
  id: string;
  status: CartStatus;
  currency: string;
  /** `null` for the rest-of-world cart. */
  country_code: string | null;
  money: CartMoney;
  coupon: CartCoupon | null;
  /** Set on the read that found the stored coupon no longer valid; tell the learner once. */
  coupon_removed: { code: string; reason: string } | null;
  billing_address_id: string | null;
  /** Set once the cart is checked out but not yet paid. */
  pending_order_id: string | null;
  lines: CartLine[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The trust boundary for a cart, as `isUserDetails` is for the user record: a drifted body becomes
 * the resource's `error()` in one place instead of `undefined` all over the cart UI. It checks the
 * keys every cart screen depends on.
 */
export function isCart(body: unknown): body is Cart {
  return (
    isObject(body) &&
    typeof body['id'] === 'string' &&
    typeof body['status'] === 'string' &&
    typeof body['currency'] === 'string' &&
    isObject(body['money']) &&
    typeof body['money']['checkout_amount'] === 'string' &&
    Array.isArray(body['lines']) &&
    body['lines'].every((l) => isObject(l) && typeof l['id'] === 'string')
  );
}

/** `httpResource` `parse` for the cart envelope's `data`. */
export function parseCart(body: unknown): Cart {
  const cart = isObject(body) ? body['data'] : undefined;
  if (!isCart(cart)) throw new Error('commerce/cart/ response does not match the contract.');
  return cart;
}

export const CART_ROUTES = {
  /**
   * Returns the learner's cart for the `X-Country-Code` market and CREATES an empty one when none
   * exists, so only pages that show a cart may read it. `cart_id` reads exactly that cart, any status.
   */
  cart: {
    path: 'api/v1/commerce/cart/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<Cart>, Record<string, never>, { cart_id?: string }>,
} as const;
