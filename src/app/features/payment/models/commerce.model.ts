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
} as const;
