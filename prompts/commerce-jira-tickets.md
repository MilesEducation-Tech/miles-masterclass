# Jira tickets: commerce rebind (subscriptions on CAIRA)

One epic and nine stories, one per PR (`docs/engineering/jira-ticket-template.md`).

**Created 2026-10-13:** epic **MIL-69**, stories **MIL-70 to MIL-78** in table order. The local branches
are renamed to match.

The plan is `prompts/commerce-api-rebind.md`, and what UAT actually returns is in `docs/COMMERCE_API.md`.

| Jira   | Summary (= PR title)                                                      | Type      | Scope     | Branch                                  | Commit    |
| ------ | ------------------------------------------------------------------------- | --------- | --------- | --------------------------------------- | --------- |
| MIL-69 | Commerce: sell subscriptions through the CAIRA commerce API               | Epic      | payment   | none                                    | none      |
| MIL-70 | `feat(core): send country, platform, app and language headers to the API` | Story     | core      | `feat/MIL-70-api-request-headers`       | `d0968a8` |
| MIL-71 | `refactor(payment): use path aliases for every import`                    | Tech debt | payment   | `refactor/MIL-71-payment-alias-imports` | `aed7237` |
| MIL-72 | `feat(payment): read the cart from the commerce API`                      | Story     | payment   | `feat/MIL-72-commerce-cart-read`        | `8faacd2` |
| MIL-73 | `feat(payment): bind plans and add-to-cart to the subscriptions API`      | Story     | payment   | `feat/MIL-73-commerce-plans`            | `63e3147` |
| MIL-74 | `feat(payment): bind the cart and coupons to the commerce API`            | Story     | payment   | `feat/MIL-74-commerce-cart-coupons`     | `28e9592` |
| MIL-75 | `feat(payment): bind billing addresses to the commerce API`               | Story     | payment   | `feat/MIL-75-commerce-addresses`        | `9419fc2` |
| MIL-76 | `feat(payment): checkout, Stripe return and payment retry`                | Story     | payment   | `feat/MIL-76-commerce-checkout`         | `184959c` |
| MIL-77 | `feat(payment): bind order history to the commerce API`                   | Story     | payment   | `feat/MIL-77-commerce-orders`           | `1d092bf` |
| MIL-78 | `feat(offerings): send course buy buttons to the plan page`               | Story     | offerings | `feat/MIL-78-offerings-buy-to-plan`     | `196618c` |

**The branches are stacked:** each one starts from the previous one (MIL-70 → MIL-71 → … → MIL-78). Every ticket
below is **blocked by** the one above it. MIL-78 needs only MIL-72, but it is stacked on MIL-77.

---

## MIL-69. Epic: Commerce: sell subscriptions through the CAIRA commerce API

**Jira:** MIL-69 · **Issue type:** Epic · **Component / scope:** payment
**Links:**

- `prompts/commerce-api-rebind.md`;
- `docs/COMMERCE_API.md`;
- the CAIRA _Commerce & Catalogue API_ front-end guide (12 Oct 2026);
- Postman folders "10. Commerce" and "09. Catalogue".

### Context

- The old backend (`user/cart/`, `promotion/*`, `user/address/`, `user/order/*`, `stripe/*`) has been
  removed, and every payment call answered 404. The whole payment flow was dead.
- CAIRA now serves commerce on `api/v1/commerce/*` and plans on `api/v1/subscriptions/plans/`.
- **Only subscriptions are sold**: one product ("Master Class") with one plan per term. There are no
  single courses and no books.

### Expected behaviour

- A signed-in learner in any supported market can:
  1. pick a plan;
  2. apply a coupon;
  3. add a billing address;
  4. pay on Stripe;
  5. land on the paid order;
  6. see it in their order history.
- Every figure shown comes from the server; the client does no money arithmetic.
- No old-backend payment code, logic or type remains in the payment flow.

### Scope

- **In:** MIL-70 to MIL-78.
- **Out**, because there is no CAIRA endpoint yet (backend Q3):
  - subscription status in the header and footer;
  - cancel or reactivate auto-renewal;
  - the Stripe billing portal and receipts;
  - a coupon list.

### Backend dependencies (block UAT sign-off or production)

1. **UAT CORS** must allow `x-accept-language`. **Production CORS** must allow `x-country-code`,
   `x-platform`, `x-app-type` and `x-accept-language`. Until then, every browser API call fails.
2. **Stripe configured on UAT.** Checkout currently returns `payment_error: gateway_not_configured`.
3. **The Stripe return redirect** goes to the web app without a locale prefix:
   - UAT: `https://<UAT_URL>/checkout/success?status=<order_status>&order_id=<id>`, and the
     same with `/checkout/cancel?…`;
   - production: the same paths on the production domain.
4. **A UAT coupon code**: one percentage code and one 100% code.
5. **Production must have the CAIRA commerce and subscriptions APIs deployed** before the production
   release.

### UAT test plan (the whole flow, on the UAT Vercel URL, `<UAT_URL>`)

Run as a UAT test learner, with DevTools → Network open.

1. **Signed out:**
   - `/us/accounting/payment/plan` shows the plan card(s) priced for the US.
   - `/in/accounting/payment/plan` shows the US/IN plans, or "Subscriptions aren't available in your
     region yet."
   - Requests carry `X-Country-Code`, `X-Platform`, `X-App-Type` and `X-Accept-Language`.
   - **Subscribe** opens the sign-in prompt.
2. **Sign in → Subscribe:**
   - `POST …/commerce/cart/lines/` answers 201, and you land on the cart page with one line. The footer
     badge shows 1.
   - Subscribe again on a different plan (if there are several) and the API's message shows.
3. **Coupons:**
   - An invalid code shows "That code is not valid for this cart." under the field.
   - The UAT percentage code updates the coupon discount and total.
   - Removing it restores the total.
4. **Billing:**
   - Add an address with postal code `07301`. It keeps the leading zero.
   - Edit it and clear line 2.
   - Proceed sends `PATCH …/commerce/cart/` with `billing_address_id` and takes you to review.
5. **Review:** tick the terms, then Proceed to Payment. Accept the auto-renew terms and you land on
   `checkout.stripe.com`.
6. **Pay** with `4242 4242 4242 4242`, any future date and any CVC. You return through
   `/checkout/success` to `/us/accounting/payment/invoice/<id>`, which shows **paid**, the Stripe
   reference and `stripe`. `purchase` fires once; check GTM/GA4.
7. **Cancel path:**
   - Repeat steps 2–5, then cancel on Stripe. The invoice shows **cancelled**.
   - **Try again** opens a new Stripe session for the **same** order id.
8. **100% coupon:** repeat with the 100% code. Checkout completes without Stripe, and the invoice shows
   paid.
9. **Order history** lists the orders, newest first, with totals in their currency. **View invoice**
   opens one, and **Download Invoice** saves a PDF.
10. **Remove the plan from the cart:** the empty cart shows. On the next visit, `GET …/commerce/cart/`
    returns a new cart id.
11. **Course pages:** the podcast or micro-learning cart button goes to the plan page. "Download
    certificate" without a plan shows "Subscription Required", and Subscribe goes to the plan page.
12. **Session lapses during Stripe:** sign out in another tab, then finish payment. The return goes to
    sign-in, then back to the invoice.

### Release plan

1. **Draft PRs with the `needs-uat` label.** Open one PR per story, as a stack: MIL-70 targets `master`,
   MIL-71 targets MIL-70's branch, and so on. Start each description with
   `⚠️ Needs UAT sign-off — do not merge`.
2. **UAT.** Once CI is green on all nine, the release owner puts **MIL-78's head commit** (`feat/MIL-78-offerings-buy-to-plan`) on `uat`
   (`git-playbook.md` §5). It contains all nine stories, so one deploy tests the whole flow. Run the UAT
   test plan.
   - Fixes go on the branch that owns the code. Rebase the branches above it, then the release owner puts
     the new top commit on UAT.
3. **Sign-off.** Each PR gets "UAT approved by …, commit `<sha>`", the label comes off, and it is marked
   Ready for review.
4. **Merge bottom-up**, each with Squash and merge:
   - Merge MIL-70.
   - Then for each next PR, retarget it to `master` and drop the already-merged parent commit:
     `git rebase --onto origin/master <parent-sha> <branch>`, then force-push.
   - CI goes green, then merge. Repeat up to MIL-78.
5. **Production** (`docs/engineering/versioning.md`):
   - The `feat:` merges open a Release PR (minor bump); merging it deploys production.
   - **Before that Release PR merges:**
     - [ ] Production CORS allows the four headers (dependency 1).
     - [ ] The production CAIRA commerce, subscriptions and account APIs are live (dependency 5).
     - [ ] The production Stripe return points at the production domain (dependency 3).
     - [ ] `src/environments/environment.ts`, the production build's `BASE_API_URL`, points at the
           production API. **Today it is `https://uat-api.milescaira.com/`.** Confirm this is intended,
           or flip it in its own PR.
     - [ ] Smoke test on production: plans → cart → checkout as far as Stripe, using a live coupon or a
           100% code if you don't want a real charge.

**Estimate:** L (split into the nine stories below).

---

## MIL-70. `feat(core): send country, platform, app and language headers to the API`

**Issue type:** Story · **Component / scope:** core
**Jira:** MIL-70 · **Branch:** `feat/MIL-70-api-request-headers` (commit `d0968a8`)
**Links:** epic; `prompts/country-resolution.md` Ticket 2; `docs/AUTH_API.md` §CORS

### Context

- CAIRA prices the catalogue, plans, cart and checkout by the `X-Country-Code` header.
- The backend expects `X-Platform`, `X-App-Type` and `X-Accept-Language` on every API call.

### Current behaviour

`appInterceptor` sent only `Accept-Language`. The three `x-*` headers were removed on 2026-09-22, when
UAT CORS rejected them.

### Expected behaviour

Every non-external request sends:

| Header | Value |
| ------------------- |
| `X-Country-Code` | The URL's country, upper-case (`/in/…` → `IN`), from `CountryContext` |
| `X-Platform` | `masterclass` |
| `X-App-Type` | `WA` |
| `X-Accept-Language` | The switcher's language, from `LanguageContext` |

Third-party calls (Salesforce, marked `IS_EXTERNAL_REQUEST`) and Supabase get none of them.

### Scope

- **In:** `core/interceptors/app/app-interceptor.ts` (with `@core/*` alias imports) and `docs/AUTH_API.md`
  §CORS.
- **Out:** server-side re-derivation of the country at checkout, which is the backend's job.

### Acceptance criteria

- [ ] **`/in/accounting/webinar`:** API requests carry `X-Country-Code: IN`, `X-Platform: masterclass`,
      `X-App-Type: WA` and `X-Accept-Language`.
- [ ] **`/ae/...`:** API requests carry `X-Country-Code: AE`.
- [ ] **Third parties:** Supabase and Salesforce requests carry none of the four.
- [ ] **CORS:** no CORS errors on UAT.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass. State the environment.

### How to verify

On UAT: DevTools → Network → any `uat-api.milescaira.com` request → Request Headers.

### Risks / assumptions / open questions

- **Blocker:** UAT CORS doesn't list `x-accept-language` (checked 2026-10-13), so every browser API call
  fails until the backend adds it. Production lists none of the four.
- **Preflight cost:** every cross-origin request now preflights. Preflight results are cached for up to 2 h
  in Chrome (`max-age 86400` on UAT).
- **Unconfirmed values:** `X-Platform` and `X-App-Type` reuse the pre-strip values (`masterclass`/`WA`);
  Postman documents neither.

**Estimate:** S

---

## MIL-71. `refactor(payment): use path aliases for every import`

**Issue type:** Tech debt · **Component / scope:** payment
**Jira:** MIL-71 · **Branch:** `refactor/MIL-71-payment-alias-imports` (commit `aed7237`)
**Links:** epic · blocked by MIL-70

### Context

The team wants alias imports everywhere, even inside one feature. The commerce stories touch these files,
so they are converted first, in a refactor of their own, rather than mixed into feature PRs.

### Current behaviour

43 relative imports across `features/payment/**`, `core/services/cart/cart-store.ts`,
`layout/footer-overlay/**` and three offerings files.

### Expected behaviour

- **All of those use `@features/*`, `@core/*` or `@layout/*`.**
- **`components/overview-wrapper` moves to `pages/overview-wrapper`.** It is a routed component, so this
  fixes a structure violation, and its baseline entry is pruned.
- **One exception stays relative:** the payment root shell keeps `import('./payment')`, because
  `check-structure.mjs` accepts a feature's root shell only in that form.

### Acceptance criteria

- [ ] **Imports:** no relative imports in the converted files (except the root shell above).
- [ ] **Structure check:** passes, with the smaller `structure-baseline.json`.
- [ ] **No behaviour change:** the cart and plan routes render as before.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

On UAT, `/us/accounting/payment/cart` and `/payment/plan` render.

### Risks / assumptions / open questions

None. Import lines, plus one folder move.

**Estimate:** S

---

## MIL-72. `feat(payment): read the cart from the commerce API`

**Issue type:** Story · **Component / scope:** payment
**Jira:** MIL-72 · **Branch:** `feat/MIL-72-commerce-cart-read` (commit `8faacd2`)
**Links:** epic · blocked by MIL-71 · Postman "10. Commerce" → `GET commerce/cart/`

### Context

There was no cart read: the old `user/cart/mybucket/` returned 404, so a fresh load always showed an empty
cart.

### Expected behaviour

- **`CartStore` reads `GET api/v1/commerce/cart/`** through an opt-in `httpResource`:
  - only for signed-in learners;
  - with `X-Country-Code`, so a market switch reads that market's cart;
  - validated by `parseCart`.
- **Only payment pages ask for it.** The read creates an empty cart, so payment pages ask for it and other
  pages never do. The footer badge shows the line count without loading anything.
- **`docs/COMMERCE_API.md`** records the UAT capture.

### Acceptance criteria

- [ ] **Signed out**, `/payment/cart` sends no cart request.
- [ ] **Signed in**, `/payment/cart` sends one `GET …/commerce/cart/` with `X-Country-Code`.
- [ ] **Home page:** browsing it sends no cart request.
- [ ] **Footer badge:** shows the line count after a payment page has loaded the cart.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan steps 1–2. Watch for `commerce/cart/` in Network.

### Risks / assumptions / open questions

A fresh empty US cart reports `currency: "INR"` until a line is added. The UI never shows an empty cart's
totals.

**Estimate:** S

---

## MIL-73. `feat(payment): bind plans and add-to-cart to the subscriptions API`

**Issue type:** Story · **Component / scope:** payment
**Jira:** MIL-73 · **Branch:** `feat/MIL-73-commerce-plans` (commit `63e3147`)
**Links:** epic · blocked by MIL-72 · `GET subscriptions/plans/`, `POST commerce/cart/lines/`

### Context

- The plan page read the dead `promotion/subscription/`.
- Its "signed in" check was hard-coded to signed out, so nobody could subscribe.

### Expected behaviour

- **Plans:** come from `subscriptions/plans/`, priced by market, with one card per plan term in
  `sort_order`. `is_default` is pre-selected.
- **Subscribe:** adds the plan with `POST commerce/cart/lines/` (`product_id` and `plan_id`), then goes to
  the cart page.
- **The subscription dialog** shows the default plan.
- **Removed** (old-backend only):
  - the partner-code prompt and firm-sponsorship dialogs;
  - the Enterprise card;
  - the monthly/EMI toggle and arithmetic.

### Acceptance criteria

- [ ] **US plan card:** `/us/…/payment/plan` shows the plan card, and the server render includes the
      plans.
- [ ] **Empty state:** a market with no plans shows "Subscriptions aren't available in your region yet."
- [ ] **Signed out:** Subscribe opens the sign-in prompt.
- [ ] **Signed in:** Subscribe sends C2 (201) and lands on the cart.
- [ ] **Refusals:** a refused add (different plan, stack full) shows the API's message.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan steps 1–2.

### Risks / assumptions / open questions

- **Product decisions:** the Enterprise "Contact Sales" card is gone, because CAIRA has no such plan. It
  can come back as a static card if product wants it.
- **No "Already subscribed" state** until there's a subscription-status endpoint (backend Q3).

**Estimate:** M

---

## MIL-74. `feat(payment): bind the cart and coupons to the commerce API`

**Issue type:** Story · **Component / scope:** payment
**Jira:** MIL-74 · **Branch:** `feat/MIL-74-commerce-cart-coupons` (commit `28e9592`)
**Links:** epic · blocked by MIL-73 · `DELETE commerce/cart/line/{id}/`, `POST`/`DELETE commerce/cart/coupon/`

### Expected behaviour

- **Cart page, drawer and price overview** show the server's own figures, in the cart's currency.
- **Remove line:** `DELETE cart/line/{id}/`. Removing the last line cancels the cart, and the next visit
  gets a new one.
- **Coupons:**
  - The dialog is a single code field (CAIRA has no coupon list). The API's refusal message shows under
    the field.
  - Remove with `DELETE cart/coupon/`.
  - A coupon that expired on the server shows a one-time notice.
- **The billing/review guard** waits for the cart read. It sends empty carts and signed-out visitors back
  to the cart.
- **Removed:** `promo-coupons` (a coupon list), the mixed-cart rule, and the old cart and coupon types.

### Acceptance criteria

- [ ] **Totals:** the cart shows its line and server totals. No totals render for an empty cart.
- [ ] **Remove line:** shows the empty cart, and the next visit has a new cart id.
- [ ] **Invalid coupon:** "That code is not valid for this cart." shows under the field.
- [ ] **Valid coupon:** updates the coupon discount and total.
- [ ] **Remove coupon:** restores the total.
- [ ] **Guard:** `/payment/billing` with an empty cart, or signed out, goes to `/payment/cart`.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan steps 2, 3 and 10. A UAT coupon code is needed from the backend.

### Risks / assumptions / open questions

The PR adds 481 lines (over the ~400 guideline). The coupon code is mixed into the same files as the cart
code, so splitting it would need temporary glue code.

**Estimate:** M

---

## MIL-75. `feat(payment): bind billing addresses to the commerce API`

**Issue type:** Story · **Component / scope:** payment
**Jira:** MIL-75 · **Branch:** `feat/MIL-75-commerce-addresses` (commit `9419fc2`)
**Links:** epic · blocked by MIL-74 · `commerce/addresses/`, `commerce/address/{id}/`, `PATCH commerce/cart/`

### Expected behaviour

- **CRUD:** list, add, edit and delete on the commerce API.
- **Delete:** deleting an address an order uses shows the API's 409 message.
- **Proceed:** attaches the selected address to the cart (`PATCH commerce/cart/`), then goes to review.
  Review requires the cart's `billing_address_id`.
- **The form:**
  - Email is gone (the API has none).
  - Fields follow CAIRA's names and length limits, and the postal code stays text.
  - Blank optional fields go as `""`, so an edit can clear them.
  - It closes only after a successful save.

### Acceptance criteria

- [ ] **Postal code:** add an address with postal code `07301` and it keeps the leading zero.
- [ ] **Edit:** clearing line 2 saves it as empty.
- [ ] **Delete in use:** deleting an address an order uses shows "This address is used by an order…".
- [ ] **Proceed:** sends `billing_address_id` and lands on review.
- [ ] **Guard:** review without an attached address goes back to billing.
- [ ] **Failed save:** keeps the form and what was typed.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan step 4.

### Risks / assumptions / open questions

There are no inputs for an address label or for setting the default (the API supports both). Add them if
product wants them.

**Estimate:** M

---

## MIL-76. `feat(payment): checkout, Stripe return and payment retry`

**Issue type:** Story · **Component / scope:** payment
**Jira:** MIL-76 · **Branch:** `feat/MIL-76-commerce-checkout` (commit `184959c`)
**Links:** epic · blocked by MIL-75 · `POST commerce/checkout/`, `POST commerce/payment/session/`,
`GET commerce/order/{id}/`

### Expected behaviour

- **Checkout outcomes:** Pay creates the order and handles three outcomes:
  - `free_order` (a 100% coupon) goes straight to the paid invoice;
  - `payment` redirects to Stripe;
  - `payment_error` shows the reason on the order, with Try again.
- **Redirect safety:** redirects only to `https://checkout.stripe.com/`.
- **Stripe return:** `/checkout/success` and `/checkout/cancel` redirect to the order's invoice in the
  visitor's country. The `order_id` must be a UUID; anything else goes to the cart.
- **Invoice:**
  - It reads the order and shows the Stripe reference.
  - Try again (`payment/session/`) shows for pending and failed orders.
  - `purchase` analytics fires once, from the order's figures.
  - Signed out, it goes to sign-in and back.

### Acceptance criteria

- [ ] **Pay:** reaches `checkout.stripe.com`. Paying with 4242 returns to the invoice showing paid.
- [ ] **Cancel at Stripe:** the invoice shows cancelled. Try again opens a new session for the same order.
- [ ] **100% coupon:** completes without Stripe.
- [ ] **Return redirect, invalid input:** `/checkout/success?order_id=not-a-uuid` goes to `/payment/cart`.
- [ ] **Return redirect, country:** `/checkout/success` with a valid id lands on `/<country>/…/invoice/<id>`.
- [ ] **Session lapsed:** the return goes to sign-in, then back to the invoice.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan steps 5–8 and 12.

### Risks / assumptions / open questions

- **Blocked on the backend:**
  - Stripe isn't configured on UAT (`gateway_not_configured`);
  - CAIRA must send the Stripe return to `https://<UAT_URL>/checkout/success|cancel`.
- **Indian learners:** INR orders return `payment_unavailable_for_currency`, so they can't pay online. A
  backend decision is needed.

**Estimate:** M

---

## MIL-77. `feat(payment): bind order history to the commerce API`

**Issue type:** Story · **Component / scope:** payment
**Jira:** MIL-77 · **Branch:** `feat/MIL-77-commerce-orders` (commit `1d092bf`)
**Links:** epic · blocked by MIL-76 · `GET commerce/orders/`

### Expected behaviour

- **Order history:** lists up to 50 orders (the API maximum) newest first. Each shows its id, date, total
  in its currency, a coloured status, its lines, and **View invoice**.
- **Removed** (no CAIRA endpoints):
  - cancel and reactivate auto-renewal;
  - the Stripe receipt;
  - the Access Stripe Dashboard button.
- **Legacy model:** `core/models/payment.model.ts` keeps only `CurrentPlanData`.

### Acceptance criteria

- [ ] **Listing:** the orders from the UAT run appear newest first, with the right totals and statuses.
- [ ] **View invoice:** opens the invoice, and Download Invoice saves the PDF.
- [ ] **Empty history:** shows "No orders found".
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan step 9.

### Risks / assumptions / open questions

- **No subscription management:** subscribers can't cancel auto-renewal from the app until CAIRA ships
  learner subscription endpoints (backend Q3). Flag this to support.
- **One page only:** add paging if a learner ever has more than 50 orders.

**Estimate:** S

---

## MIL-78. `feat(offerings): send course buy buttons to the plan page`

**Issue type:** Story · **Component / scope:** offerings
**Jira:** MIL-78 · **Branch:** `feat/MIL-78-offerings-buy-to-plan` (commit `196618c`)
**Links:** epic · blocked by MIL-77 (needs only MIL-72)

### Context

Course pages still added single courses to the dead `v2/user/cart/`. Only subscriptions are sold.

### Expected behaviour

- **Buy buttons:** the podcast hero's and the micro-learning reel card's cart buttons go to the plan page.
- **Certificate gate:**
  - with no plan, it shows "Subscription Required", and Subscribe goes to the plan page;
  - a course excluded from the subscription shows "Not Included in the Subscription" with Close only.
- **Removed:**
  - `Utils.addCourseToCart` and `openCartDrawer`;
  - the `v2/user/cart/` route;
  - the `CART_DRAWER_DIALOG` token;
  - the `cartItemRemoved` signal and effects.

### Acceptance criteria

- [ ] **Buy buttons:** on a podcast or micro-learning course without a plan, the cart button opens
      `/<country>/accounting/payment/plan`.
- [ ] **Certificate download** without a plan follows the two gate rules above.
- [ ] **No legacy calls:** no request to `v2/user/cart/` anywhere.
- [ ] **Checks:** `pnpm lint` and `pnpm build:prod` pass.

### How to verify

UAT test plan step 11.

### Risks / assumptions / open questions

The podcast hero still shows a per-course price for courses flagged as individually purchasable. That's a
follow-up, if product wants it hidden.

**Estimate:** S
