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
} as const;
