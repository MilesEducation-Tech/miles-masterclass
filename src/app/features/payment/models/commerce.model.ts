import { Cart, Decimal } from '@core/models/commerce.model';
import { CommonResponse, RouteConfig } from '@core/models/http.model';

/**
 * CAIRA commerce types owned by the payment feature. The cart itself is in
 * `core/models/commerce.model.ts`, because the footer reads it too.
 *
 * Only subscriptions are sold: one product ("Master Class") with one plan per term.
 * The types cover only the keys the app reads (contract: the CAIRA commerce guide and
 * `docs/COMMERCE_API.md`).
 */

export interface PlanPrice {
  currency: string;
  /** The list price. */
  price: Decimal;
  /** The selling price when the plan is discounted; `price` then renders struck through. */
  discount_price: Decimal | null;
}

export interface PlanFeature {
  id: string;
  name: string;
}

/**
 * A purchasable term of the subscription product, priced for the `X-Country-Code` market,
 * or, for a signed-in learner holding a personal assignment, at their personal price.
 */
export interface Plan {
  id: string;
  duration_months: number;
  /** Pre-select this plan. */
  is_default: boolean;
  sort_order: number;
  product: { id: string; title: string };
  price: PlanPrice;
  features: PlanFeature[];
}

/**
 * One of the learner's addresses. `country` is a country NAME (free text), not the market
 * code. CAIRA sends a blank optional field as `null`.
 */
export interface Address {
  id: string;
  name: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

/**
 * The body of A2 (create) and A4 (edit). CAIRA requires `line1`, `city`, `state` and
 * `postal_code`; the billing form also requires a name, phone and country. A blank optional
 * field is sent as `""`: CAIRA stores it as `null`, which is how an edit clears it (checked
 * on UAT 2026-10-13, `docs/COMMERCE_API.md`).
 */
export interface AddressInput {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

/** Field limits from the CAIRA guide (A2); the billing form enforces them before sending. */
export const ADDRESS_LIMITS = {
  name: 120,
  phone: 20,
  line: 255,
  city: 100,
  state: 100,
  country: 100,
  postalCode: 20,
} as const;

/**
 * Every order status CAIRA writes. A cart becomes `purchased` only when payment is captured;
 * until then its order stays `pending` and payable (K2).
 */
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'partial_paid'
  | 'failed'
  | 'refunded'
  | 'partial_refunded'
  | 'cancelled'
  | 'partial_cancelled';

/** An order line: the order's own snapshot, not a join to the live catalogue. */
export interface OrderLine {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  money: { price_before_discount: Decimal; discount_amount: Decimal; final_amount: Decimal };
}

/** One payment attempt. `reference` is the Stripe Checkout Session id (`cs_…`). */
export interface OrderPayment {
  id: string;
  gateway: string;
  reference: string;
  amount: Decimal;
  status: string;
  captured_at: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  currency: string;
  money: {
    price_before_discount: Decimal;
    discount_amount: Decimal;
    coupon_discount_amount: Decimal;
    gst_amount: Decimal;
    /** The order total. */
    price_after_gst: Decimal;
    amount_paid: Decimal;
  };
  billing_address_id: string | null;
  created_at: string;
  lines: OrderLine[];
  /** Filled by K4 only; always `[]` in the orders list (K3). */
  payments: OrderPayment[];
}

/** A Stripe Checkout Session: the browser goes to `url`. */
export interface PaymentSession {
  session_id: string;
  url: string;
  amount: Decimal;
  currency: string;
}

/**
 * K1. Exactly one of `free_order`, `payment` and `payment_error` is set. `free_order` means a
 * coupon covered the whole amount and the order is already paid, so test it first.
 */
export interface CheckoutResult {
  result: Order;
  payment: PaymentSession | null;
  /** e.g. `payment_unavailable_for_currency`, `gateway_not_configured`. */
  payment_error: string | null;
  free_order: { order_status: OrderStatus } | null;
}

/** K2: a new session (201), or a coupon-zeroed order completing with no payment (200). */
export type PaymentSessionResult =
  PaymentSession | { free: true; order_id: string; order_status: OrderStatus };

/** An unpaginated CAIRA list. */
export interface ListResult<T> {
  count: number;
  results: T[];
}

/** C2 answers with the whole cart the line landed in, in `result`. */
export interface AddLineResult {
  /** `false` when the same plan was already in the cart (re-adding is harmless). */
  created: boolean;
  line_id: string;
  result: Cart;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isPlan(v: unknown): v is Plan {
  return (
    isObject(v) &&
    typeof v['id'] === 'string' &&
    typeof v['duration_months'] === 'number' &&
    isObject(v['product']) &&
    typeof v['product']['id'] === 'string' &&
    isObject(v['price']) &&
    typeof v['price']['currency'] === 'string' &&
    typeof v['price']['price'] === 'string' &&
    Array.isArray(v['features'])
  );
}

function isAddress(v: unknown): v is Address {
  return (
    isObject(v) &&
    typeof v['id'] === 'string' &&
    typeof v['line1'] === 'string' &&
    typeof v['city'] === 'string' &&
    typeof v['state'] === 'string' &&
    typeof v['postal_code'] === 'string'
  );
}

function isOrder(v: unknown): v is Order {
  return (
    isObject(v) &&
    typeof v['id'] === 'string' &&
    typeof v['status'] === 'string' &&
    typeof v['currency'] === 'string' &&
    isObject(v['money']) &&
    typeof v['money']['price_after_gst'] === 'string' &&
    Array.isArray(v['lines']) &&
    Array.isArray(v['payments'])
  );
}

/** `httpResource` `parse` for `commerce/order/{id}/`. */
export function parseOrder(body: unknown): Order {
  const order = isObject(body) ? body['data'] : undefined;
  if (!isOrder(order)) throw new Error('commerce/order/ response does not match the contract.');
  return order;
}

/** `httpResource` `parse` for `commerce/addresses/` (default address first). */
export function parseAddresses(body: unknown): Address[] {
  const results = isObject(body) && isObject(body['data']) ? body['data']['results'] : undefined;
  if (!Array.isArray(results) || !results.every(isAddress)) {
    throw new Error('commerce/addresses/ response does not match the contract.');
  }
  return results;
}

/**
 * `httpResource` `parse` for `subscriptions/plans/`: the trust boundary (a drifted body
 * becomes the resource's `error()`), and the cards' order (`sort_order`).
 */
export function parsePlans(body: unknown): Plan[] {
  const results = isObject(body) && isObject(body['data']) ? body['data']['results'] : undefined;
  if (!Array.isArray(results) || !results.every(isPlan)) {
    throw new Error('subscriptions/plans/ response does not match the contract.');
  }
  return [...results].sort((a, b) => a.sort_order - b.sort_order);
}

export const COMMERCE_ROUTES = {
  /** Anonymous allowed; with a token, personal prices replace the general ones. Not paginated. */
  plans: {
    path: 'api/v1/subscriptions/plans/',
    method: 'GET',
  } as RouteConfig<
    void,
    CommonResponse<ListResult<Plan>>,
    Record<string, never>,
    { product_id?: string }
  >,
  /** Adds a plan to the cart (`cart_id` pins the cart the learner saw). */
  addLine: {
    path: 'api/v1/commerce/cart/lines/',
    method: 'POST',
  } as RouteConfig<
    { product_id: string; plan_id: string; cart_id?: string },
    CommonResponse<AddLineResult>
  >,
  /** Answers with the whole cart; removing the last line answers it `cancelled`. */
  removeLine: {
    path: 'api/v1/commerce/cart/line/:line_id/',
    method: 'DELETE',
  } as RouteConfig<void, CommonResponse<Cart>>,
  /** One coupon per cart; a new code replaces the old. A refusal is a 409 with a showable `message`. */
  applyCoupon: {
    path: 'api/v1/commerce/cart/coupon/',
    method: 'POST',
  } as RouteConfig<{ code: string; cart_id?: string }, CommonResponse<Cart>>,
  removeCoupon: {
    path: 'api/v1/commerce/cart/coupon/',
    method: 'DELETE',
  } as RouteConfig<void, CommonResponse<Cart>, Record<string, never>, { cart_id?: string }>,
  /** Unpaginated, default address first. */
  addresses: {
    path: 'api/v1/commerce/addresses/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<ListResult<Address>>>,
  createAddress: {
    path: 'api/v1/commerce/addresses/',
    method: 'POST',
  } as RouteConfig<AddressInput, CommonResponse<Address>>,
  /** Partial: only the fields sent change. Another learner's address is a 404. */
  updateAddress: {
    path: 'api/v1/commerce/address/:address_id/',
    method: 'PATCH',
  } as RouteConfig<Partial<AddressInput>, CommonResponse<Address>>,
  /** 204, or 409 (with a showable `message`) when any order references the address. */
  deleteAddress: {
    path: 'api/v1/commerce/address/:address_id/',
    method: 'DELETE',
  } as RouteConfig<void, null>,
  /** C5: attaches the billing address to the cart; checkout copies it onto the order. */
  attachAddress: {
    path: 'api/v1/commerce/cart/',
    method: 'PATCH',
  } as RouteConfig<{ cart_id: string; billing_address_id: string }, CommonResponse<Cart>>,
  /** K1: the cart becomes a pending order (the same order on a repeat). Always 201 once it exists. */
  checkout: {
    path: 'api/v1/commerce/checkout/',
    method: 'POST',
  } as RouteConfig<{ cart_id: string }, CommonResponse<CheckoutResult>>,
  /** K2: a new Stripe session for a payable order; `order_id` goes in the body, never the query. */
  paymentSession: {
    path: 'api/v1/commerce/payment/session/',
    method: 'POST',
  } as RouteConfig<{ order_id: string }, CommonResponse<PaymentSessionResult>>,
  /** K4: one of the learner's orders, with its payment attempts. Another learner's is a 404. */
  order: {
    path: 'api/v1/commerce/order/:order_id/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<Order>>,
} as const;
