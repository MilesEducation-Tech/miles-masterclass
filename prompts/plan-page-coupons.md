# Coupons on the plan page

Status: **approved and implemented (2026-11-02).** One ticket, one PR: `fix/MIL-134-plan-page-coupons` off `master`
(`d0a53c28`). Decisions 1a and 1b came out of testing.

## Goal

The plan page shows the learner's coupons, under Subscribe Now:

- **Signed out:** a "Your offers" strip that reads "Log in to explore the coupons." Log in opens the same sign-up
  prompt as Subscribe Now.
- **Signed in, with coupons:**
  - **collapsed**, the strip headlines the best coupon: its discount ("25% Off" / "$250 Off"), its description and
    its code;
  - **expanded**, it lists every coupon as a chip with its code, what it takes off and an Apply button;
  - **Apply** puts the selected plan in the cart (unless the cart already has a line), applies the code and opens
    the cart, which shows the discounted total;
  - a refusal shows the API's message under that chip.
- **Signed in, no coupons**, or the list failed: no strip.

## What I read

- **`features/payment/pages/plan/plan.html|ts`:** heading, `PromoOffer`, the comparison table, one card per plan and
  Subscribe Now. There's no coupon surface. `PromoOffer` is a fixed "attend the webinar, claim 25%" banner; its
  sign-in state is a hard-coded `signal(false)` and its CTA is commented out. It isn't a coupon list and stays as it
  is.
- **The cause (git):** #127 (MIL-74, "bind the cart and coupons to the commerce API") removed `promo-coupons`, the
  plan page's coupon list, because at the time "CAIRA has no coupon list". `GET commerce/coupons/` came afterwards
  (2026-10-14, `docs/COMMERCE_API.md` "Coupon list") and was bound only into the cart's coupon dialog.
- **`PaymentFacade`:**
  - `couponsResource` reads `commerce/coupons/`. It's opt-in (`loadCoupons()`), sends `X-Country-Code`, stays off
    the loading bar and only logs a failure.
  - It is also gated on a cart with a line, which the plan page usually doesn't have.
  - `applyCoupon(code)` is D1 on the current cart.
  - `addPlanToCart(plan, onAdded)` is C2, callback-style.
- **`commerce/coupons/` (Postman `commerce-coupons-v1`, `docs/COMMERCE_API.md`):**
  - It needs a token (401 otherwise) and never creates or writes a cart; `cart_id` is optional.
  - It lists only coupons this learner can use now (an ineligible one is left out, so the list needs no client-side
    filter).
  - The market is `X-Country-Code`, or the cart's own market when the header is absent. A learner with neither gets
    an empty list.
  - Each row has `code`, `description`, `discount_type` (`percentage` | `flat` seen so far), `discount_value`, `currency`,
    `valid_to` and `discount_amount`. `discount_amount` is the saving **on the cart**, so with no cart it can't be
    the label.
  - D1 on an empty cart is a 409 `code_invalid`, so Apply has to add the plan first.
- **The design** this restores:
  - a strip below the CTAs, `bg-linear-to-r from-neutral-900 to-accent/15`;
  - collapsed: a large italic discount, the description and a chevron;
  - expanded: a horizontally scrolling row of chips, each with an Apply link; the best one is tinted and tagged
    "Best value for you";
  - signed out: "Your offers / Log in to explore the coupons."
- **`coupon-dialog`:** its row format (code, description, "Valid till … (UTC)") and its per-row refusal message,
  which the chips reuse.

## Locked decisions

1. **One coupon resource, two callers.** `couponsResource` no longer needs a cart. It asks when wanted and signed in,
   sends `cart_id` only when the cart has a line, and keeps `X-Country-Code`. The cart dialog's request is
   unchanged; the plan page's has no `cart_id`. `loadCoupons()` stays the opt-in; the plan page calls it on load.
   - **1a. The read waits while the cart itself is being read** (`CartStore.status` loading/reloading). Otherwise the
     cart page would read once without `cart_id` and again with it; this keeps it to one read, as before. The plan
     page never reads the cart, so it reads straight away.
   - **1b. The last list stays while a new cart id re-reads it.** The resource empties during the re-read, the page's
     `@if` then dropped the strip mid-Apply (Apply adds the plan, which creates the cart id), and the `applied` output
     fired on a destroyed component (NG0953), so the page never went to the cart. `coupons` is now a `linkedSignal`
     that keeps the previous list while the resource is loading.
2. **The label is the coupon's own discount, not `discount_amount`.**
   - `Coupon` gains `discount_type` and `discount_value`, checked in `parseCoupons`.
   - The template formats with pipes: `percentage` → `{{ discount_value | number: '1.0-2' }}% Off`; anything else →
     `{{ discount_value | currency: currency : 'symbol' : '1.0-2' }} Off`.
   - The cart dialog keeps "Save {{ discount_amount }}", which is right there.
3. **"Best" is a facade rule.** `PaymentFacade.bestCoupon` is the largest `percentage` coupon, or the largest `flat`
   one when there's no percentage coupon, as the design specifies. The strip only renders it.
4. **Apply is one facade method:** `applyCouponWithPlan(plan, code): Observable<Cart>`.
   - It applies straight away when the cart already has a line.
   - Otherwise it adds the plan (C2), then applies (D1).
   - C2's call moves into a private `addLine(plan)`, which `addPlanToCart` also uses, so its toasts and errors are
     unchanged.
   - A refusal reaches the caller as the API's message, as `applyCoupon` does.
5. **The strip is `features/payment/components/promo-coupons/`.**
   - It injects `PaymentFacade` (coupons, best coupon, apply) and `AuthSession` (`isAuthenticated`, the boolean).
   - It takes the selected plan as an input. That's page state the facade doesn't hold, as `PlanSelectionCard`
     takes it.
   - It emits `login` (the page opens its sign-up prompt, as `PromoOffer` does) and `applied` (the page goes to the
     cart, as Subscribe does).
   - It owns its "Applying…" and refusal state. One apply at a time disables every chip.
6. **The disclosure is ng-primitives' accordion** (`NgpAccordion`, `NgpAccordionItem`, `NgpAccordionTrigger`,
   `NgpAccordionContent`), styled to the design. The shared `AccordionItem` only takes a text heading, and the
   headline here is rich. No hand-rolled `aria-expanded`.
7. **Placement:** in the right rail, directly under Subscribe Now, only when plans exist (as Subscribe).
8. **Out of scope:**
   - the partner-code chip (there is no partner-code entry dialog in the app);
   - `PromoOffer`'s inert sign-in state;
   - hiding the strip for active subscribers (the API already leaves out coupons they can't use).

## Endpoint map

| Call                                | Where                                                   | Change                                   |
| ----------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| `GET api/v1/commerce/coupons/`      | `couponsResource` (plan page, cart dialog)              | `cart_id` only with a cart; no cart gate |
| `POST api/v1/commerce/cart/line/`   | `addLine` (C2) ← `addPlanToCart`, `applyCouponWithPlan` | extracted, same body                     |
| `POST api/v1/commerce/cart/coupon/` | `applyCoupon` (D1) ← `applyCouponWithPlan`              | unchanged                                |

## Files touched (~220 lines)

- `features/payment/components/promo-coupons/promo-coupons.ts|html`: new.
- `features/payment/pages/plan/plan.ts|html`: the strip under Subscribe Now; `loadCoupons()` on load.
- `features/payment/services/payment-facade.ts`: the resource gate, `bestCoupon`, `addLine`,
  `applyCouponWithPlan`.
- `features/payment/models/commerce.model.ts`: `discount_type`, `discount_value` and their guard.
- `docs/COMMERCE_API.md`: the no-cart answer, once checked on UAT.
- `docs/refactor/STATE.md`.

## Security

- The read is the learner's own, behind their token, through the interceptor.
- Nothing is cached across learners: `PaymentFacade` is a root service, and its resource re-reads on sign-in and
  idles on sign-out.
- A code is never typed here; only listed codes are applied.

## Acceptance criteria

1. Signed out: the "Your offers" strip shows under Subscribe Now. Log in opens the sign-up prompt. No
   `commerce/coupons/` request is made.
2. Signed in with coupons, empty cart:
   - one `commerce/coupons/` request, with `X-Country-Code` and no `cart_id`, off the loading bar;
   - collapsed, the best coupon's discount, description and code;
   - expanded, every coupon as a chip.
3. Apply on an empty cart adds the selected plan, applies the code and lands on the cart with the coupon on it.
   With a line already in the cart it only applies, then lands on the cart.
4. A refused code shows the API's message under its chip, the chips are enabled again, and the learner stays on the
   page.
5. Signed in with no coupons, or a failed read: no strip, and the page is otherwise unchanged.
6. The cart page's coupon dialog lists and applies exactly as before (its request still carries `cart_id`).
7. 375 / 768 / 1440: the strip fits the rail; the chips scroll inside the strip, never the page.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm build:prod`.

## How to verify

- **Dev server (4101):**
  - signed out, `/us/accounting/payment/plan`: the strip and the sign-up prompt;
  - with a stubbed session and stubbed `commerce/coupons/`, `cart/line/` and `cart/coupon/` answers: empty list,
    one coupon, several (percent and flat), a 409 refusal, a 500 read.
- **UAT, signed in (you; I can't sign in):** the plan page with an empty cart lists your coupons; Apply lands on the
  cart with the discount; the cart dialog still lists them.

## Risks

- **The no-cart answer is documented but not captured.**
  - Postman says the market comes from `X-Country-Code` when there's no cart. The one no-cart capture
    (2026-10-14) was an Indian learner with `count: 0`, which may only mean there were no Indian coupons.
  - If UAT returns an empty list with no cart for a market that has coupons, the strip can't list them without
    creating a cart, and that's a backend question.
  - The first UAT check above settles it.
- **Apply adds the plan before applying.** A refusal leaves the plan in the cart. That's the same state as Subscribe
  Now, and the button then reads "Go to Cart".

## Assumptions

- The headline shows the best coupon's code as well as its discount, so a code is visible without expanding; the
  design's collapsed headline has no code.
- "Best" follows the design's rule (largest percent first) rather than CAIRA's list order, which isn't documented as
  ranked.
