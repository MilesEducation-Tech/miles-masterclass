# Phase 9 — Data layer · `features/payment`

Date: 2026-09-26 · Branch: `refactor/structure-10`. It builds on Phase 9 core/shared, which already converted the
cart (`CartStore`).

## 1. Summary

**Five reads moved to `httpResource`: four in `PaymentFacade`, one in `coupon-dialog`.** The plans' hand-rolled
TransferState handoff is deleted, by your decision. Source is +157 / −123; specs are +174, with 8 new tests.

`PaymentFacade` is a **root service built eagerly on every page** (through `Utils`). So every new read is **opt-in**,
behind a `…Wanted` flag its page flips, following the CartStore `wanted` pattern. A spec pins that nothing fetches
until a page asks.

| Read                                                                    | Now                                                                                                                                                 | Notes                                                                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orders (`my_orders/`)                                                   | opt-in `httpResource`. The first `loadOrders()` opts in; later calls `.reload()` (retry, cancel, reactivate).                                       | `ordersData`/`Loading`/`Error` are derived.                                                                                                                            |
| Order detail (`order_details/`)                                         | `httpResource` keyed on an `orderId` signal. The same id again reloads, as the old call refetched.                                                  | It **joins the `loading`/`error` OR** that the invoice skeleton, `cartResolver` and `paymentGuard` read. `order_id` is now a `params` entry, not string concatenation. |
| Billing addresses (`user/address/`)                                     | opt-in `httpResource` + `billingAddress` as a `linkedSignal`                                                                                        | The mixed-cart notification still runs first. Save, update and delete patch the list in place. `selectedAddressId` is unchanged.                                       |
| Subscription plans (`promotion/subscription/`, full + `is_recommended`) | two opt-in `httpResource`s. `subscriptionPlans` is a `linkedSignal` (add/remove-cart patch `is_added_to_cart`); `recommendedPlans` is a `computed`. | **The TransferState handoff is gone** (`makeStateKey`, `PLATFORM_ID`, `isPlatformServer`).                                                                             |
| Coupon dialog list (`promotion/coupons/`)                               | a component-level `httpResource`, read once per open                                                                                                | New 2-test spec.                                                                                                                                                       |

Error logging moved from the old `error:` callbacks into field-level `effect`s. The reviewer confirmed:

- no consumer calls `.set()` on a signal that is now derived;
- `proceedToPayment()` never cleared `opError`, so an order error persisting until the next order load is the old
  behaviour.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                |
| --------------- | ----------------------------------------------------- |
| lint            | pass                                                  |
| unit tests      | pass: 185 files, **679 passed** + 1 skipped (was 672) |
| build (local)   | pass                                                  |
| build (prod)    | pass                                                  |
| storybook build | pass                                                  |
| format check    | pass                                                  |
| bundle report   | pass: initial 88.8 KB gz, unchanged                   |
| ssr smoke       | pass: 4 of 4 routes                                   |

- **`reviewer`: PASS, zero violations.** It checked every consumer, the resolver/guard semantics, the mixed-cart
  path, the root-service opt-in, SSR of `/payment/plan`, and that the specs bite.
- ⚠️ **The SSR smoke does not include `/payment/plan`,** so no gate can see how the plans hydrate. By code reading:
  - the server still fetches the plans (the plan page's constructor opts in), so the SSR HTML has them;
  - anonymous visitors get them handed to the browser by Angular's transfer cache;
  - **signed-in visitors refetch once in the browser**, which is the trade-off you accepted.

  Whether that shows as a flicker on the plan cards is item 1 of the visual QA.

- **Browser: not run.** The payment flow needs a sign-in, and the dev-server config uses `npx`.

## 3. Decisions needed / skipped / suspicious

- **No new decision needed.** The plans decision was taken before execution and is recorded.
- **Logged, not fixed:**
  - `PaymentFacade.getCoupons()`/`coupons`/`loadCoupons()` and `PromoCoupons.loadCoupons()` are **dead** (no
    callers), so the cart's "first coupon" strip never fills. Reviving them would be a visible change.
  - **`plan.ts` `isLoggedIn` / `hasActivePlan` are inert `signal(false)` stubs**, left behind by the removed session
    service, so the plan page always renders as signed out. It is the same family as the course-feedback bug.
    Worth one "re-wire the auth stubs" decision covering both.
  - `removeCoursesFromCart()` is an empty placeholder.
- **Unchanged, on purpose:** every mutation (address save/update/delete, cart add/remove, coupons, checkout, cancel
  and reactivate, the Stripe portal), the firm-search typeahead in `firm-sponsorship-dialog` (a search), and the
  invoice PDF (client-side, no HTTP).
- **PR size:** about 456 changed lines, just over the guideline, but the source is one facade plus one dialog, so it
  is kept as one commit.

## 4. Visual QA list

1. **`/payment/plan`, signed out and signed in:**
   - the plans render in the server HTML;
   - **watch for a flicker on the plan cards after load** (signed in is the refetch case);
   - add a plan to the cart: its card shows "in cart";
   - applying a partner code refreshes the plans.
2. **The subscription dialog** (onboarding): the recommended plans show, and the plan page's list is unaffected.
3. **Billing:**
   - the addresses load;
   - add, edit and delete an address; the selection follows;
   - with a mixed cart, the notice shows and nothing loads;
   - proceeding to review still works (the guard).
4. **Invoice (`/invoice/:orderId`):** the skeleton, then the invoice; a bad id shows the error; the purchase
   analytics fire once.
5. **Order history:** the list, then cancel and reactivate auto-renew, and it refreshes; the Stripe portal opens.
6. **Coupon dialog:** the list loads; apply a coupon.

## 5. Commit message

```
refactor(payment): move orders, invoice, addresses and plans to httpResource

- PaymentFacade (root, built on every page): orders, order detail, billing
  addresses and subscription plans become OPT-IN httpResources; the order
  read still feeds the loading/error the resolver and guard wait on
- plans: drop the hand-rolled TransferState handoff (signed-in users now
  refetch once in the browser, as decided)
- coupon dialog: its list is a component httpResource
- +8 spec tests

Phase 9 (data layer), features/payment.
```
