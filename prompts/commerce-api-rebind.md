# Commerce API rebind: subscriptions on `api/v1/commerce`

**Status:** approved 2026-10-13 ("use this plan"). D1–D6 are taken as the recommended **A** options. The
old backend is gone, so **no legacy binding, logic or type survives in the payment flow** (see "Legacy
removal" below). **PR0 is done (uncommitted).** It also moved `overview-wrapper` into `pages/`, and kept
`import('./payment')` for the root shell, because `check-structure.mjs` only accepts that form.
**Epic branch prefix:** `feat/MIL-XXX-…`, one ticket per PR (see Jira below).
**Contract:** _Miles Platform, Commerce & Catalogue API, front-end integration guide_ (12 Oct 2026), plus
`postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json` folders "09. Catalogue" and
"10. Commerce" (generated 2026-10-09).

---

## Assumptions (read these first)

1. **Only subscriptions are sold** (user, 2026-10-13). There is one product ("Master Class",
   `454db30e-…` on UAT) with one or more plans. No single courses and no books, which means:
   - no catalogue reads (P1–P5);
   - no shipping address;
   - no mixed-cart rules;
   - no quantity edits (C3).
2. **Payment is already broken on UAT.** Every legacy path the feature calls (`user/cart/`, `promotion/*`,
   `user/address/`, `user/order/*`, `stripe/*`) answers 404 (STATE, 2026-10-10). Stacked PRs therefore can't
   regress a working flow.
3. **Request headers come from `feat/MIL-XXX-api-request-headers`.** That branch adds `X-Country-Code`,
   `X-Platform`, `X-App-Type` and `X-Accept-Language`, and this work branches from `master` after it merges.
   **While UAT CORS rejects `x-accept-language`, every browser API call fails**, so browser verification of
   PR1 onward waits on the backend.
4. **Contract checked against UAT on 2026-10-13** (`docs/COMMERCE_API.md`).
   - The cart, order, orders-list and error shapes match the guide.
   - D2 and C4 return the whole cart, so Postman's `data: {}` examples are wrong.
   - **Stripe is not configured on UAT:** K1 returns `payment_error: "gateway_not_configured"` and K2
     answers 503. PR5 can be built, but not verified end to end, until that changes (Q11).
5. **Alias imports everywhere** (user, 2026-10-13), including inside `features/payment` and `core/`. Every
   new or edited file uses `@core/*`, `@shared/*`, `@layout/*`, `@features/*` and `@env/*`. This is stricter
   than AGENTS.md §3, which only _allows_ relative imports within a feature. Converting the existing ones is
   PR0, because CLAUDE.md forbids mixing a refactor into a feature PR.
6. **Partner code and firm sponsorship leave the payment flow** (user, 2026-10-13: the old backend is
   removed). Both call old-backend `PROFILE_ROUTES` (`apply-partner-code/`,
   `promotion/subscription/firm-sponsorship/`). PR2 deletes:
   - `dialogs/partner-code-prompt-dialog/` and `dialogs/firm-sponsorship-dialog/`;
   - the plan page's partner-code and sponsorship buttons;
   - `promptPartnerCodeOrSubscribe` and `openFirmSponsorshipDialog`;
   - the `PROFILE_ROUTES.applyFirmSponsorship` entry.

   The core `PartnerCode` service and `shared/dialogs/apply-partner-code-dialog` stay, because they are used
   outside payment (`profile-completion-dialog`).

7. **The project skills named in AGENTS.md §10 don't exist on disk.** This plan follows AGENTS.md,
   CLAUDE.md and the guide instead.

## Goal

A signed-in learner in any supported market can:

1. pick a plan;
2. apply a coupon;
3. attach a billing address (D1);
4. pay on Stripe;
5. land on the paid order;
6. see it in their order history.

Everything runs on `api/v1/commerce/*` and `api/v1/subscriptions/plans/`, every figure shown comes from the
server, and the client does no money arithmetic.

## What I read

- **The guide** and the Postman "Catalogue" and "Commerce" folders: 32 requests, all on `api/v1/`, with no
  `web-api` or `app-api` twins.
- **`features/payment/**`**: `payment-facade.ts` (810 lines), every page, component, dialog and the guard,
  plus `payment.routes.ts`.
- **`core/models/payment.model.ts`**, which holds the legacy registry and types.
- **Core infrastructure:**
  - `core/models/http.model.ts` (`RouteConfig`, `CommonResponse`);
  - `core/services/api-client/api-client.ts`;
  - `core/services/cart/cart-store.ts`;
  - `core/interceptors/app/app-interceptor.ts`;
  - `core/services/country-context/`.
- **Outside the feature:**
  - `layout/footer-overlay/`;
  - `shared/services/utils.ts` (`addCourseToCart`, `openCertificateDownloadDialog`, `openCartDrawer`);
  - `shared/services/engagement-dialog.ts`;
  - the offerings buy paths (podcast hero, micro-learning reel cards, the `masterclass-facade` and
    `micro-learning-course-facade` `cartItemRemoved` effects);
  - `app.config.ts`, which provides the dialog tokens;
  - `app.routes.ts` and `app.routes.server.ts`.
- **Precedents:**
  - `auth.model.ts` and `account.model.ts` for `api/v1` registries;
  - `course-detail-facade.ts:348` for path params through `call()`;
  - `AccountApi` for unwrapping `CommonResponse` in `parse`.
- **Live UAT, signed out, 2026-10-13:**
  - `GET subscriptions/plans/` answers. With `X-Country-Code: US` it returns one 12-month plan at
    `USD 948.00`. `us` and `US` behave the same. `IN`, `AX` and `XX` return `count: 0`.
  - Catalogue, cart and order reads answer 401.
  - CORS: UAT allows `x-country-code`, `x-platform` and `x-app-type`, but not `x-accept-language`.
    Production allows none of the four.

## Contract summary

| ID  | Call                                                         | Notes                                                                          |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| S1  | `GET api/v1/subscriptions/plans/?product_id=`                | Anonymous allowed; a token adds personal prices. Not paginated.                |
| C1  | `GET api/v1/commerce/cart/?cart_id=`                         | **Creates an empty cart** when none exists. Not repriced on read.              |
| C2  | `POST api/v1/commerce/cart/lines/`                           | `{product_id, plan_id, cart_id}` → `{created, line_id, result: Cart}`          |
| C4  | `DELETE api/v1/commerce/cart/line/{line_id}/`                | Last line removed → cart `cancelled`, along with any pending order.            |
| C5  | `PATCH api/v1/commerce/cart/`                                | `{cart_id, billing_address_id}`. Billing only; shipping isn't used.            |
| D1  | `POST api/v1/commerce/cart/coupon/`                          | `{code, cart_id}` → Cart; around 15 refusal `reason`s, each with safe wording. |
| D2  | `DELETE api/v1/commerce/cart/coupon/?cart_id=`               | → Cart                                                                         |
| A1  | `GET api/v1/commerce/addresses/`                             | `{count, results}`, default first. `country` is a **name**.                    |
| A2  | `POST api/v1/commerce/addresses/`                            | 201 → Address                                                                  |
| A3  | `GET api/v1/commerce/address/{address_id}/`                  | Used by the invoice                                                            |
| A4  | `PATCH api/v1/commerce/address/{address_id}/`                | Partial; an empty body is a 400                                                |
| A5  | `DELETE api/v1/commerce/address/{address_id}/`               | 204, or 409 when any order references the address                              |
| K1  | `POST api/v1/commerce/checkout/`                             | `{cart_id}` → `{result: Order, payment, payment_error, free_order}`            |
| K2  | `POST api/v1/commerce/payment/session/`                      | `{order_id}` in the **body** → session, or `{free: true, …}`                   |
| K3  | `GET api/v1/commerce/orders/?page=&page_size=&order_status=` | Paginated, max 50; `payments` is always `[]` here                              |
| K4  | `GET api/v1/commerce/order/{order_id}/`                      | Order with `payments[]`                                                        |

**Never called from the client:**

- P1–P5 (catalogue) and C3 (quantity).
- `subscriptions/my-plans/`.
- `subscriptions/internal/*`, which needs the internal key and is server-only.
- `commerce/checkout/success|cancel/`: Stripe calls these, and they redirect 303 to us.
- `payment/stripe-webhook/`.

**Not in the API at all** (see the backend questions):

- a coupon list;
- the learner's subscription status, cancel or reactivate auto-renew, and the Stripe customer portal or
  receipts;
- an invoice PDF;
- trials.

## Current code vs the new API

| Today                                                                                                                                        | New                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `PAYMENT_ROUTES` registry in `core/models/payment.model.ts`; generics in the wrong slots; its name clashes with the Angular `PAYMENT_ROUTES` | `CART_ROUTES` (core) + `COMMERCE_ROUTES` (payment), with correct slots                                                  |
| Numeric ids, `number` money, `cartitem_data`, `item_details.delivery_mode`                                                                   | UUID strings and decimal-string money; `lines[]`; one subscription line                                                 |
| No cart read; `CartStore` holds whatever the last mutation returned                                                                          | C1 through a `CartStore`-owned `httpResource`                                                                           |
| `addToCart(itemId, itemType, …, 'monthly'\|'yearly')`                                                                                        | `addPlanToCart(plan)`: C2 with `product_id` and `plan_id`                                                               |
| Plan page `isLoggedIn = signal(false)` stub, so Subscribe always opens sign-up                                                               | Bound to `AuthSession.isAuthenticated`                                                                                  |
| Coupon dialog lists coupons from `promotion/coupons/`                                                                                        | Code field only (no list endpoint)                                                                                      |
| Address `{address1, locality, zipcode: number, email_id, …}`, `PUT`                                                                          | `{line1, line2, landmark, city, state, postal_code: string, country, name, phone, label, is_default}`, `PATCH`, then C5 |
| `proceed_checkout {cart_id, address_id, is_trial}` → `approval_url`                                                                          | K1 `{cart_id}`, then three outcomes; K2 to retry                                                                        |
| Invoice reads `user/order/order_details/` (numeric totals, `transcation_details`)                                                            | K4 order + A3 address                                                                                                   |
| Orders: Stripe receipt, cancel or reactivate auto-renew, customer portal                                                                     | No endpoints (D2)                                                                                                       |
| Client money: EMI ÷12, Σbase − Σselling, coupon difference, `Math.round`, hard-coded `USD`/`$`                                               | Server fields only, through `CurrencyPipe` with the object's own `currency`                                             |
| Course pages: `Utils.addCourseToCart` → legacy `v2/user/cart/`                                                                               | Send the learner to the plan page (PR7)                                                                                 |
| Write failures only logged, so the learner sees nothing                                                                                      | Show the envelope `message`                                                                                             |

## Decisions to confirm

**D1. Billing address**

- **A (recommended):** keep the billing step, and require an address before review. It's today's flow, the
  invoice shows it, and tax or GST may need it (backend Q6). Checkout sends it through C5.
- **B:** drop the billing page, `components/address` and the 855 KB-gzip `location-min.ts`. The API makes
  addresses optional for subscriptions. This is the smallest diff, but it's a product change.

**D2. Order actions that have no endpoint** (Stripe receipt, cancel or reactivate auto-renew, customer
portal)

- **A (recommended):** remove the buttons and facade methods now; they already 404. Bring them back when the
  backend ships learner subscription routes (Q3).
- **B:** keep calling the legacy paths.

**D3. Where Stripe's return lands**

- **A (recommended):** a top-level `checkout/:result` route that redirects to
  `/<country>/accounting/payment/invoice/<order_id>?status=<status>`. The backend only needs our origin, and
  the invoice page already handles `?status=`.
- **B:** the backend redirects straight to the invoice URL. That means it has to know the country and
  profession.

**D4. When the cart is read**

- **A (recommended):** only payment pages and the cart drawer ask for it. The footer badge shows a count once
  the cart is known. **C1 creates a cart**, so reading it on every page would create an empty cart per
  learner per market.
- **B:** read it on every page for signed-in learners.

**D5. A second plan while one is in the cart**

- **A (recommended):** show the API's `subscription_already_in_cart` message. UAT has one plan.
- **B:** replace it: C4 then C2. This cancels the cart and any pending order.

**D6. Monthly toggle and "/month" prices**

- **A (recommended):** remove them. Plans are terms (`duration_months`), and `emi_providers` is empty.
- **B:** keep `price ÷ months`. That is client money arithmetic, which the guide forbids.

## Legacy removal (user, 2026-10-13)

The old backend is removed entirely. Each PR **deletes** the legacy binding, logic and types it replaces:
no compatibility shims, no fallback to an old path, no commented-out code, and no "kept for later" types.
A behaviour with no CAIRA commerce equivalent is removed from the payment flow, not stubbed:

| Legacy behaviour                                                                       | Removed in |
| -------------------------------------------------------------------------------------- | ---------- |
| `pay_method` monthly/yearly, `item_type`/`item_id`, `is_added_to_cart` on plans        | PR2        |
| Partner-code prompt, firm sponsorship, `PROFILE_ROUTES.applyFirmSponsorship`           | PR2        |
| `is_recommended`, `subscription_type`, `free_trial_days`, `stripe_price_id_*`          | PR2        |
| Coupon list (`promotion/coupons/`), `coupon_applicable`, `firstCoupon` strip           | PR3        |
| Mixed-cart rules, `cartitem_data`, `delivery_mode`, `removeCoursesFromCart`            | PR3        |
| `user/address/` shape (`address1`, `locality`, numeric `zipcode`, `email_id`)          | PR4        |
| `proceed_checkout`, `approval_url`, `is_trial`, `forcePurchase`, `checkAndSubscribe`   | PR5        |
| `transcation_details`, `country_details`, numeric order totals, `order_details/`       | PR5        |
| Cancel or reactivate auto-renew, Stripe receipt, customer portal, `retryPayment` route | PR6        |
| `Utils.addCourseToCart`, `v2/user/cart/`, `cartItemRemoved`                            | PR7        |

By the end of PR6, `core/models/payment.model.ts` holds only `CurrentPlanData`. That type is read outside
the payment flow (analytics, the certificate access policy and the engagement dialog), and it goes when a
CAIRA subscription-status endpoint exists (Q3).

## Locked decisions (rules, guide, precedent)

**Data layer**

- **Reads** are `httpResource` with `parse` unwrapping `CommonResponse<T>` (the `AccountApi` precedent),
  plus a `defaultValue` for lists.
- **Mutations** are `ApiClient.call()` against a registry entry.
- **Path params** go through `{ ...route, path: route.path.replace(':line_id', id) }`, as in
  `course-detail-facade.ts:348`.
- **A mutation that returns the cart** calls `CartStore.set(cart)`; there is no follow-up read.

**Registries and types**

- **Registry generics go in their real slots:** `RouteConfig<Body, CommonResponse<T>, Record<string, never>,
Query>`.
- **Names:**
  - `CART_ROUTES` lives in `core/models/commerce.model.ts`, because `CartStore` reads it.
  - `COMMERCE_ROUTES` lives in `features/payment/models/commerce.model.ts`.
  - The legacy `PAYMENT_ROUTES` registry is deleted.
- **Types:**
  - Ids are `string` (UUID).
  - Money is `type Decimal = string`.
  - Each type covers **only the keys the app reads** (the `UserDetails` precedent from MIL-52).
  - Anything `CurrentPlanData` still serves stays until a subscription-status endpoint exists.

**Money**

- **No money arithmetic, and no `Number()` on money**, except in analytics payloads, which GA needs as
  numbers.
- **Display goes through `CurrencyPipe`** with the object's own `currency`. It accepts decimal strings.
- **No hard-coded `'USD'` or `'$'`** in any touched file.

**Market**

- `appInterceptor` already sends `X-Country-Code`.
- Resources that price by market **also** pass it in `headers` from `CountryContext.current()`. This makes the
  dependency explicit, so the resource re-fetches when the country changes. The interceptor sets the same
  value.

**The cart**

- After the learner has seen a cart, every write sends `cart_id` (C2, C5, D1, D2, K1), so it acts on exactly
  the cart they reviewed.

**Errors**

- One small `commerceErrorOf(err) → { reason?: string; message: string }` in the facade file.
- 4xx responses show `message` through `NotificationService`.
- Branch on `data.reason` only where the screen changes:

  | Reason                                                                                   | Screen change                                                      |
  | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
  | `subscription_already_in_cart`                                                           | Show it on the plan card                                           |
  | `coupon_no_longer_valid`                                                                 | Call D2, then ask the learner to check out again                   |
  | `not_open`, `cart_not_open`, or a cancelled cart                                         | `CartStore.reset()`                                                |
  | any K1 `payment_error` (`payment_unavailable_for_currency`, `gateway_not_configured`, …) | Message, stay on the order, "Try again" sends K2. Never auto-retry |
  | `order_not_payable`                                                                      | Reload K4                                                          |
  | `gateway_error`, `gateway_not_configured`                                                | "Try again shortly"                                                |

**Code style**

- **Redirects** use `inject(DOCUMENT).location.assign(url)`, with `DOCUMENT` from `@angular/core`. Never
  `window`.
- **Services** are `@Service()` with `inject()`. `PaymentFacade` and `CartStore` stay root singletons.
- **UI** uses ng-primitives and Tailwind only.
- Don't change any component's `changeDetection`.
- No new dependencies and no tests.
- **Every import uses an alias**, in new and edited files alike.

## Target architecture

```
core/
  models/commerce.model.ts          Decimal, Cart, CartLine, CartMoney, CartCoupon, CART_ROUTES { cart }
  services/cart/cart-store.ts       owns the cart httpResource (opt-in, gated on isAuthenticated, keyed on
                                    country): cart(), lineCount(), load(), set(cart), reset()
features/payment/
  models/commerce.model.ts          Plan, PlanPrice, Address, AddressInput, Order, OrderLine, OrderMoney,
                                    OrderPayment, PaymentSession, CheckoutResult, ListResult<T>, PagedResult<T>,
                                    COMMERCE_ROUTES (S1, C2, C4, C5, D1, D2, A1–A5, K1–K4)
  services/payment-facade.ts        plans, addresses, orders and order resources; addPlanToCart, removeLine,
                                    applyCoupon, removeCoupon, save/update/deleteAddress, attachBillingAddress,
                                    checkout, retryPayment; analytics; commerceErrorOf
app.routes.ts                       checkout/:result → invoice redirect (D3-A)
```

`CartStore` sketch (alias imports only):

```ts
import { httpResource } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { CART_ROUTES, Cart } from '@core/models/commerce.model';
import { CommonResponse } from '@core/models/http.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { CountryContext } from '@core/services/country-context/country-context';

@Service()
export class CartStore {
  private readonly auth = inject(AuthSession);
  private readonly country = inject(CountryContext).current;
  /** Opt-in (D4): C1 creates a cart, so only pages that show one ask for it. */
  private readonly wanted = signal(false);
  private readonly resource = httpResource<Cart>(
    () =>
      this.wanted() && this.auth.isAuthenticated()
        ? { url: apiUrl(CART_ROUTES.cart.path), headers: { 'X-Country-Code': this.country().toUpperCase() } }
        : undefined,
    { parse: (body) => (body as CommonResponse<Cart>).data },
  );
  readonly cart = computed(() => (this.resource.hasValue() ? this.resource.value() : null));
  readonly status = this.resource.status; // the guard waits on this, not isLoading (idle is not loading)
  readonly lineCount = computed(() => this.cart()?.lines.length ?? 0);
  load(): void { … }            // first call opts in, later calls reload
  set(cart: Cart): void { … }   // a write returned the whole cart; a cancelled cart → reset()
  reset(): void { … }           // drop the cart; the next load() creates a fresh one
}
```

Checkout handling, which checks `free_order` first (the guide: "Test free_order first"):

```ts
checkout(): void {
  const cart = this.cart.cart();
  if (!cart) return;
  this.api.call(COMMERCE_ROUTES.checkout, { cart_id: cart.id }).subscribe({
    next: ({ data }) => {
      this.analytics.trackEvent('begin_checkout', { … });
      if (data.free_order) return this.openOrder(data.result.id, 'paid');
      if (data.payment) return this.redirectToStripe(data.payment.url);
      this.recoverPayment(data.result.id, data.payment_error); // K2, or a message for an unsupported currency
    },
    error: (err) => this.showCommerceError(err),
  });
}

/** The URL comes from our API, but it is still a redirect target: only Stripe's hosted checkout. */
private redirectToStripe(url: string): void {
  if (!url.startsWith('https://checkout.stripe.com/')) { … log + toast; return; }
  this.document.location.assign(url);
}
```

Stripe's return (D3-A) goes in `app.routes.ts`, outside the locale tree:

```ts
{
  path: 'checkout/:result',
  redirectTo: ({ params, queryParams }) => {
    const router = inject(Router);
    const country = inject(CountryContext).current();
    const orderId = String(queryParams['order_id'] ?? '');
    // Untrusted query: only a UUID becomes part of a URL.
    if (!UUID.test(orderId)) return router.createUrlTree(['/', country, 'accounting', 'payment', 'cart']);
    const status = params['result'] === 'success' ? (queryParams['status'] ?? 'paid') : 'cancelled';
    return router.createUrlTree(['/', country, 'accounting', 'payment', 'invoice', orderId], { queryParams: { status } });
  },
},
```

## Endpoint map

| Call       | Owner           | Member                                                 | Consumers                                                                        |
| ---------- | --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| S1         | `PaymentFacade` | `plans`, `defaultPlan`, `loadPlans()`                  | plan page, `plan-selection-card`, `plan-comparison-table`, `subscription-dialog` |
| C1         | `CartStore`     | `cart`, `lineCount`, `status`, `load()`                | cart page, cart drawer, billing, review, `paymentGuard`, footer badge            |
| C2         | `PaymentFacade` | `addPlanToCart(plan, onAdded?)`                        | plan page, subscription dialog                                                   |
| C4         | `PaymentFacade` | `removeLine(lineId)`                                   | cart page, cart drawer                                                           |
| D1, D2     | `PaymentFacade` | `applyCoupon(code)`, `removeCoupon()`                  | `price-overview`, `coupon-dialog`                                                |
| A1         | `PaymentFacade` | `addresses`, `loadAddresses()`                         | billing                                                                          |
| A2, A4, A5 | `PaymentFacade` | `saveAddress`, `updateAddress`, `deleteAddress`        | billing (`components/address`)                                                   |
| A3         | `PaymentFacade` | `invoiceAddress` (keyed on `order.billing_address_id`) | invoice                                                                          |
| C5         | `PaymentFacade` | `attachBillingAddress(addressId)`                      | billing "Continue"                                                               |
| K1         | `PaymentFacade` | `checkout()`                                           | review "Pay"                                                                     |
| K2         | `PaymentFacade` | `retryPayment(orderId)`                                | invoice (pending, failed or cancelled), K1 `payment_error`                       |
| K3         | `PaymentFacade` | `orders`, `ordersPage`, `loadOrders(page)`             | order history                                                                    |
| K4         | `PaymentFacade` | `order`, `loadOrder(id)`                               | invoice, Stripe return                                                           |

## Phases (stacked PRs, each green on its own, each under ~400 changed lines)

**Order:** PR0 → PR1 → (PR2 ∥ PR7) → PR3 → PR4 → PR5 → PR6.

**PR0: `refactor(payment): use path aliases for every import`** (about 70 lines)

- Replace every relative import in:
  - `features/payment/**`;
  - `core/services/cart/cart-store.ts`;
  - `layout/footer-overlay/**`, stories included;
  - the offerings files PR7 touches: `podcast-course-hero.ts`, `masterclass-facade.ts`,
    `micro-learning-course-facade.ts`.
- 34 imports in 19 files. No behaviour change. Prettier sorts nothing, so the diff is import lines only.

**PR1: `feat(payment): read the cart from the commerce API`** (about 150 lines; implemented 2026-10-13)

1. **Capture real responses** as a UAT test learner, using the scratchpad script `capture-commerce.sh`.
   It records C1, C2, D1, D2, A1, K1, K4, K3, K2 and C4, and the results go into `docs/COMMERCE_API.md`.
2. **`core/models/commerce.model.ts`:**
   - `Decimal`, `Cart`, `CartLine`, `CartMoney`, `CartCoupon`;
   - an `isCart` / `parseCart` trust boundary (the `isUserDetails` precedent);
   - `CART_ROUTES.cart`.
3. **`CartStore`:**
   - an opt-in `httpResource` gated on `isAuthenticated()`, with `X-Country-Code` from `CountryContext`;
   - `cart`, `lineCount` and `load()`.
   - The legacy `cartData` and `cartItemRemoved` stay until PR3 and PR7 remove their readers.
4. **Readers:**
   - The payment shell (`payment.ts`, parent of cart, billing and review) calls `load()`.
   - The footer badge is `cart.lineCount` and never loads (D4).

**Deviation from the first draft:** `features/payment/models/commerce.model.ts` and the `COMMERCE_ROUTES`
entries are added by the PR that first uses each one (PR2 plans, PR3 cart writes and coupons, PR4
addresses, PR5 checkout and orders), not all up front, so no PR ships unused types. `CartStore.set()` comes
with PR2, and `status` with PR3's guard, for the same reason.

**PR2: `feat(payment): bind plans and add-to-cart to the subscriptions API`** (implemented 2026-10-13: +224 / −1325, mostly deletions)

**What shipped differs from the bullets below in four places:**

- **No Enterprise card.** CAIRA has no such plan, so the "Contact Sales" card and its route go. The firm
  CTA lives on `/cpe-for-corporate` and in the footer's corporate card.
- **No "Already Subscribed" state.** There is no subscription-status endpoint (Q3); C2 refuses with
  `subscription_stack_full`, and the learner sees that message.
- **"Go to Cart" shows once this session knows the cart has a line.** The plan page doesn't read the cart
  (D4); re-adding the same plan is harmless anyway.
- **The `hasActivePlan` stub is gone**, so the promo offer always shows.

- **Facade:**
  - an S1 resource with `defaultValue: []`, sorted by `sort_order`;
  - `defaultPlan` (`is_default`, otherwise the first plan);
  - `addPlanToCart`, which sends C2 `{product_id: plan.product.id, plan_id: plan.id, cart_id?}` and then
    calls `CartStore.set(result)`;
  - the `add_to_cart` event, using `plan.price` cast with `Number()` (analytics only).
- **Plan page:**
  - `isLoggedIn` → `AuthSession.isAuthenticated`. The stub blocks subscribing today.
  - Cards read `product.title`, `duration_months`, `price.price`, `discount_price` and `features[]`.
  - "In cart" means the cart has a line.
  - Remove the monthly toggle and its arithmetic (D6-A).
  - An empty plan list shows "Not available in your region yet". UAT `IN` returns 0 plans.
- **`subscription-dialog`** reads `defaultPlan` instead of `is_recommended`.
- **Delete partner code and firm sponsorship from the payment flow** (Assumption 6): both dialogs, the plan
  page's two buttons, `promptPartnerCodeOrSubscribe`, `openFirmSponsorshipDialog` and
  `PROFILE_ROUTES.applyFirmSponsorship`. The subscription dialog's Subscribe calls `addPlanToCart`.
- **Delete** the legacy plan types: `SubscriptionPlan`, `PlanPriceDetail`, `PlanFeature`,
  `PlanFeatureDetail` and `PlanIapDetails`.

**PR3: `feat(payment): bind the cart and coupons to the commerce API`** (about 380 lines)

- **Cart page, `cart-item` and the cart drawer** read `CartStore.cart()`: one line showing its `title` and
  `money.final_amount`; the totals come from `cart.money`.
- **`removeLine`:** C4. If the response shows the cart `cancelled`, call `reset()` and show the empty cart.
- **`price-overview`:**
  - It shows `money.price_before_discount`, `discount_amount`, `coupon_discount_amount`, `gst_amount` and
    `checkout_amount`.
  - It drops `coupons()`, `firstCoupon`, every sum and `Math.round`.
- **Coupons:**
  - The applied coupon comes from `cart.coupon`.
  - `coupon-dialog` becomes a code field: trim it, require 1–50 characters, then send D1. A 409 shows its
    `message` under the field.
  - `promo-coupons` (plan page) uses `isAuthenticated` and drops the live coupon list.
- **`coupon_removed`** on a read shows one toast: "Your code X was removed".
- **`paymentGuard`:**
  - It waits on `CartStore.status()` reaching `resolved` or `error`, not on `isLoading()`.
  - Billing needs at least one line.
  - Review needs `cart.billing_address_id` (D1-A).
  - Delete the mixed-cart branch.
- **Delete** `CartStore.cartData`, `PaymentFacade.cartState`, `hasCartItems`, `removeCoursesFromCart`,
  `getCoupons`, `loadCoupons`, `coupons`, and the legacy cart and coupon types.

**PR4: `feat(payment): bind billing addresses to the commerce API`** (about 300 lines; D1-A only)

- **Calls:** A1, A2, A4 and A5, then C5 on "Continue". A5's 409 shows "This address is used by an order".
- **Form fields:**
  - `name` is now sent.
  - `line1` and `line2` replace `address1` and `locality`.
  - `postal_code` is a **string**, which fixes the `Number()` that drops leading zeros. Its message no longer
    says "6 digits".
  - `email_id` goes, because the API has no such field.
  - `label` and `is_default` are new.
  - Lengths follow A2: `line1` ≤255, `city` ≤100, `state` ≤100, `postal_code` 1–20, `name` ≤120,
    `phone` ≤20, `label` ≤50.
- **`country` stays a name.** The API wants a name, which the location data already supplies.
- **Delete** `UserAddress`, `BillingAddressPayload` and `selectedAddressId`. The selection becomes
  `cart.billing_address_id`.

**PR5: `feat(payment): checkout, Stripe return and payment retry`** (about 350 lines)

- **Review "Pay"** calls `checkout()` and handles the outcomes in order: `free_order`, then `payment`, then
  `payment_error`. It includes the Stripe URL allow-list.
- **`app.routes.ts`:** add `checkout/:result` (D3-A).
- **Invoice page:**
  - It reads K4, and A3 for the address.
  - Status mapping:

    | `order.status`                          | Shown as    |
    | --------------------------------------- | ----------- |
    | `paid`                                  | `success`   |
    | `pending`, `processing`, `partial_paid` | `pending`   |
    | `failed`, `cancelled`                   | `cancelled` |
    | anything else                           | `pending`   |

  - "Try again" calls `retryPayment(order.id)` (K2). K2's `{free: true}` reloads K4.
- **`purchase`:** the event is built from `order.money` and `order.lines` and keeps its localStorage dedupe.
- **Delete** `proceedToPayment`, `is_trial` and the legacy checkout and order-detail types.

**PR6: `feat(payment): bind order history to the commerce API`** (about 250 lines)

- **Orders page:** K3 with `page_size: 20` and a "Load more" button driven by `next`.
  - Row figures are `money.price_after_gst`, with the status and `created_at`.
  - The only action is "View invoice".
- **D2-A:** remove the Stripe receipt, cancel or reactivate auto-renew, and customer-portal actions, together
  with their facade methods.
- **Final cleanup of `core/models/payment.model.ts`:** keep only `CurrentPlanData`, which analytics, the
  certificate access policy and the engagement dialog still use, and move `CartSteps` to
  `features/payment/constants/`.

**PR7: `feat(offerings): send course buy buttons to the plan page`** (about 200 lines; can land any time
after PR1)

- **Delete `Utils.addCourseToCart`**, `MASTERCLASS_ROUTES.addToCart`, both `cartItemRemoved` effects and
  `CartStore.cartItemRemoved`.
- **Buy buttons go to `/<country>/accounting/payment/plan`:**
  - the podcast hero;
  - the micro-learning reel card's cart button;
  - `Utils.openCertificateDownloadDialog`'s "Add to cart" option.
- **Remove the `is_added_to_cart` checks** from those templates.

## Files touched

| PR  | Files                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR0 | import lines only, in the files listed under PR0                                                                                                                                                                                                                                                                                                         |
| PR1 | **new** `core/models/commerce.model.ts`, `core/services/cart/cart-store.ts`, `layout/footer-overlay/footer-overlay.ts`, `features/payment/payment.ts`                                                                                                                                                                                                    |
| PR2 | `features/payment/services/payment-facade.ts`, `pages/plan/plan.ts\|html`, `components/plan-selection-card/*`, `components/plan-comparison-table/*`, `dialogs/subscription-dialog/*`, **deleted** `dialogs/partner-code-prompt-dialog/*` and `dialogs/firm-sponsorship-dialog/*`, `core/models/profile.model.ts`, `core/models/payment.model.ts`         |
| PR3 | facade, `pages/cart/*`, `components/cart-item/*`, `dialogs/cart-drawer-dialog/*`, `components/price-overview/*`, `dialogs/coupon-dialog/*`, `components/promo-coupons/*`, `guards/payment-guard.ts`, `core/services/cart/cart-store.ts`, `core/models/payment.model.ts`                                                                                  |
| PR4 | facade, `pages/billing/*`, `components/address/*`, `core/models/payment.model.ts`                                                                                                                                                                                                                                                                        |
| PR5 | facade, `pages/invoice/*`, `components/payment-status/*`, `app.routes.ts`, `core/models/payment.model.ts`                                                                                                                                                                                                                                                |
| PR6 | facade, `pages/orders/*`, `core/models/payment.model.ts`, `constants/payment.ts`, `payment.ts`                                                                                                                                                                                                                                                           |
| PR7 | `shared/services/utils.ts`, `core/models/masterclass.model.ts`, `core/services/cart/cart-store.ts`, `features/offerings/podcast/components/podcast-course-hero/*`, `features/offerings/micro-learning/**/micro-learning-reel-card/*`, `features/offerings/services/masterclass-facade.ts`, `features/offerings/services/micro-learning-course-facade.ts` |

Docs:

- `docs/AUTH_API.md` is unchanged.
- A new `docs/COMMERCE_API.md` records the captured shapes and the open backend questions, kept short. It
  is written in PR1 and updated by each PR.

## Security

- **The client never sends money.** Bodies carry only ids, the coupon code and the address fields; no
  price, discount or total.
- **Stripe redirect allow-list:** `payment.url` must start with `https://checkout.stripe.com/`, or we don't
  navigate.
- **`order_id` from Stripe's return is untrusted.** It must match a UUID before it reaches a URL or an API
  call, and `result` must be `success` or `cancel`.
- **`subscriptions/internal/*` and `X-API-Key` never appear** in the client or the registry.
- **Validate at the boundary:**
  - coupon code: trimmed, 1–50 characters;
  - address fields: the A2 lengths, with `postal_code` as a string.
- **Tokens go only through `appInterceptor`.** A plans response fetched with a token can carry a personal
  price: it is never stored (no localStorage), and the transfer cache only carries anonymous responses,
  because Angular skips it when `Authorization` is set.
- **`X-Country-Code` is client-controlled.** Re-deriving the country at checkout is the backend's job
  (`prompts/country-resolution.md`, Payment safety 1). The frontend doesn't pretend to enforce it.

## Acceptance criteria

1. **No legacy paths remain.** `src/` has no `user/cart`, `promotion/`, `user/address`, `user/order`,
   `stripe/`, `lms/check-and-subscribe` or `v2/user/cart` strings, and `PAYMENT_ROUTES` exists only as the
   Angular `Routes`.
2. **No relative imports** in any file this epic touches.
3. **Plans render signed out**, on the server and in the browser, priced for the URL market. `/us/…` shows
   `USD 948.00` for 12 months; a market with no plans shows the empty state.
4. **Subscribe as a learner** sends C2 with `product_id` and `plan_id`. The cart shows one line, and the
   footer badge shows 1 without a separate cart read.
5. **Coupons:** an invalid code shows the server message under the field; a valid code updates every
   figure from `cart.money`.
6. **Removing the line** shows the empty cart. The next visit gets a new cart id.
7. **Addresses (D1-A):** add, edit and delete work, and deleting an address an order uses shows its 409
   message. "Continue" sends C5, and the guard blocks review without `billing_address_id`.
8. **"Pay"** redirects to `checkout.stripe.com`. Paying with Stripe's test card returns through
   `/checkout/success` to the invoice, which shows `paid`. `purchase` fires once.
9. **Cancelling at Stripe** lands on the invoice as cancelled. "Try again" sends K2, which opens a new Stripe
   session for the **same** order id.
10. **A 100% coupon** completes without visiting Stripe, and K2 is never called.
11. **An unsupported currency** (`payment_unavailable_for_currency`) shows a message, with no K2 loop.
12. **Order history** lists the order with server figures, and "View invoice" opens it. The PDF still
    downloads.
13. **Course pages** (PR7): every buy button goes to the plan page, and no request goes to a cart endpoint.
14. **No client money arithmetic** and no hard-coded `USD`/`$` in touched files. Grep for `reduce(`,
    `Math.round`, `÷ 12` and `'USD'`.
15. **Gates:** `pnpm lint` (0 errors), the structure check, Prettier and `pnpm build:prod` (no new budget
    warning; `location-min` stays lazy). State the environment.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

SSR, for the plan page, which is `RenderMode.Server`:

```bash
pnpm build && pnpm serve:ssr:miles-masterclass-v3
```

```bash
curl -s http://localhost:4000/us/accounting/payment/plan | grep -c '948'
```

Confirm the bundle output: no new eager chunk, and `location-min` and `html-to-pdf` stay lazy.

## How to verify

Run on the dev server (`.claude/launch.json` "dev", port 3000) against UAT, as a UAT test learner. This
needs UAT CORS to allow `x-accept-language` first. Watch DevTools → Network.

1. **Signed out:**
   - `/us/accounting/payment/plan` shows one card at $948.00 / 12 months.
   - `/in/accounting/payment/plan` shows the empty state. The request carries `X-Country-Code: IN`.
2. **Sign in, then Subscribe:**
   - `POST …/commerce/cart/lines/` sends `{product_id, plan_id}` and answers 201.
   - The cart page shows the line, and the footer badge shows 1.
3. **Coupons:**
   - `NOPE` shows the 409 message under the field.
   - A UAT code from the backend changes `coupon_discount_amount` and `checkout_amount`.
4. **Billing:** add an address, edit it, then "Continue". `PATCH …/commerce/cart/` sends
   `billing_address_id`.
5. **Review → Pay:** you land on `checkout.stripe.com`. Pay with `4242 4242 4242 4242`, any future date, any
   CVC.
6. **The return** lands on `/checkout/success?…`, which redirects to `/us/accounting/payment/invoice/<id>`
   and shows paid.
   - If the backend can't point at localhost, open
     `/checkout/success?status=paid&order_id=<id from step 5>` by hand.
7. **Cancel path:** repeat steps 2–5 and cancel at Stripe.
   - The invoice shows cancelled.
   - "Try again" sends `POST …/payment/session/` with `{order_id}` in the body and opens a new session.
8. **Order history** shows both orders. The invoice PDF downloads.
9. **Remove the line:** the empty cart shows. Reload, and C1 returns a new `id`.
10. **Course pages** (PR7): a podcast or micro-learning buy button goes to the plan page, and no cart
    request is sent.

## Risks

- **`x-accept-language` CORS:** until UAT allows it, nothing in the browser works, and verification is
  blocked.
- **Hand-built Postman shapes.** Mitigated by PR1's capture step; the types follow what UAT actually
  returns.
- **INR can't be paid through Stripe** (`payment_unavailable_for_currency`). Indian learners may have no way
  to pay online (Q5).
- **No subscription-status endpoint.** `header.hasActivePlan` and the footer `subscribed` stay `false`, so
  subscribers still see "Subscribe" (Q3). Adding a plan they already hold fails at C2 with
  `subscription_stack_full`, and we show that message.
- **C1 creates carts.** D4-A keeps that to learners who open payment pages.
- **Personal prices** bypass the backend cache. Replica lag can briefly show the general price after an
  assignment.
- **Production CORS** lacks all four headers, so `BASE_API_URL` must not switch to production first.
- **Partner code and firm sponsorship** still call legacy endpoints, which 404 (Q8).
- **PR3 is the largest.** If it passes 400 lines, split coupons into their own PR.

## Backend questions

1. **CORS:** add `x-accept-language` to `Access-Control-Allow-Headers` on UAT, and all four headers on
   production.
2. **Stripe return:**
   - What does `<portal>` resolve to in each environment?
   - Confirm the redirect is `<portal>/checkout/success?status=<order_status>&order_id=<id>` and
     `/checkout/cancel?…`, with no locale prefix.
   - Can UAT point at `http://localhost:3000` for local testing?
3. **Learner subscription routes:** current subscription (active, expiry, `can_cancel`), cancel or
   reactivate auto-renew, and a Stripe billing-portal or receipt link. None exist; the orders page and
   header need them.
4. **Real response bodies** for D1, D2 and C4. Postman shows `data: {}`, but the guide says the whole cart.
5. **Indian market:** INR orders return `payment_unavailable_for_currency`. Which gateway will Indian
   learners pay through, and when?
6. **Billing address:** is it required for invoices or GST? Do we enforce it (D1)?
7. **Plans:** will shorter terms (monthly) exist? What will `emi_providers` contain? Is `is_default` the
   replacement for `is_recommended`?
8. **Partner code and firm sponsorship:** what are their `api/v1` replacements?
9. **`Vary: X-Country-Code`** on S1 responses.
10. **A UAT coupon code** we can test with: one percentage code and one 100% code.

11. **Configure Stripe on UAT.** Checkout returns `payment_error: "gateway_not_configured"`, and K2 answers 503. Until it's set up, no payment can start.
12. **A fresh empty US cart reports `currency: "INR"`** until a line is added. Should it be `USD`?

## Jira

**Epic:** `Commerce API rebind (subscriptions only)`. Links: this prompt, the guide (12 Oct 2026), and
Postman folders "10. Commerce" and "09. Catalogue". It is blocked by `feat(core): send X-Country-Code,
X-Platform and X-App-Type on every API request`.

| Ticket | Summary (= PR title)                                                 | Type      | Scope     | Branch                                   | Blocked by      | Estimate |
| ------ | -------------------------------------------------------------------- | --------- | --------- | ---------------------------------------- | --------------- | -------- |
| PR0    | `refactor(payment): use path aliases for every import`               | Tech debt | payment   | `refactor/MIL-XXX-payment-alias-imports` | none            | S        |
| PR1    | `feat(payment): read the cart from the commerce API`                 | Story     | payment   | `feat/MIL-XXX-commerce-cart-read`        | PR0, headers PR | M        |
| PR2    | `feat(payment): bind plans and add-to-cart to the subscriptions API` | Story     | payment   | `feat/MIL-XXX-commerce-plans`            | PR1             | M        |
| PR3    | `feat(payment): bind the cart and coupons to the commerce API`       | Story     | payment   | `feat/MIL-XXX-commerce-cart-coupons`     | PR2             | M        |
| PR4    | `feat(payment): bind billing addresses to the commerce API`          | Story     | payment   | `feat/MIL-XXX-commerce-addresses`        | PR3, D1         | M        |
| PR5    | `feat(payment): checkout, Stripe return and payment retry`           | Story     | payment   | `feat/MIL-XXX-commerce-checkout`         | PR4, Q2         | M        |
| PR6    | `feat(payment): bind order history to the commerce API`              | Story     | payment   | `feat/MIL-XXX-commerce-orders`           | PR5, D2         | M        |
| PR7    | `feat(offerings): send course buy buttons to the plan page`          | Story     | offerings | `feat/MIL-XXX-offerings-buy-to-plan`     | PR1             | S        |

Every ticket uses the same template:

- **Context:** this prompt §Assumptions.
- **Current behaviour:** §"Current code vs the new API".
- **Expected behaviour:** the PR's phase above.
- **Acceptance criteria:** the numbered items that PR delivers (PR2 → 3–4, PR3 → 5–6, PR4 → 7, PR5 → 8–11,
  PR6 → 12, PR7 → 13; all → 1, 2, 14, 15).
- **How to verify:** the matching steps above.
- **Risks:** §Risks and the backend questions the PR depends on.

Rename each branch with `git branch -m` once its `MIL-<n>` exists.

## Follow-ups (not in this epic unless you say so)

- **Repo-wide alias conversion:** 511 relative imports remain in 277 files. After that, an ESLint
  `no-restricted-imports` pattern for `./*` and `../*` would enforce aliases everywhere. It's stricter, so
  it doesn't weaken any check.
- **Subscription-status UI** (header, footer, engagement dialog and certificate access policy), once Q3
  lands. That's also when `CurrentPlanData` can go.
- **Personal-plan banner** from `subscriptions/my-plans/`.
- **An error-toast interceptor:** `SKIP_ERROR_NOTIFICATION` is declared but nothing reads it.
