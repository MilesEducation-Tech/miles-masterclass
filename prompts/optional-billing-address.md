# Commerce remove routes, and an optional billing address

**Status:** revision 1, 2026-10-16, approved in plan mode. PR 1 committed (MIL-103, `79579185`); PR 2
implemented; PR 3 blocked.

**Why:** two changes from the backend and product on 2026-10-16.

- **API.** CAIRA withdrew `DELETE` on 2026-10-14. Removing a coupon (D2), a cart line (C4) and an address
  (A5) are now `POST …/remove/`. A4 (edit an address) is unchanged; it was already `PATCH`.
- **Flow.** The review page must stop requiring a billing address. Above the terms line it shows the picked
  address, or a link that opens an "add address" dialog. Pay works without one. After payment, the invoice
  page asks for the billing address.

Read: `features/payment/` (facade, `commerce.model.ts`, `pages/invoice/`, `components/billing-address/`,
`components/address/`, `dialogs/coupon-dialog/`), `core/services/cart/cart-store.ts`,
`core/services/api-client/api-client.ts`, `docs/COMMERCE_API.md`, Postman "10. Commerce" (2026-10-15 export).

## Jira

Three tickets, three branches, three PRs. The fix and the feature stay apart, and PR 3 must not hold the
other two back. Replace `MIL-XXX` with the issued number, then `git branch -m`.

```
Bug    MIL-XXX  fix(payment): call the POST remove routes for cart lines, coupons and addresses
Story  MIL-XXX  feat(payment): make the billing address optional on review
Story  MIL-XXX  feat(payment): ask for the billing address on the invoice page   (blocked by backend)
```

### Ticket 1. `fix(payment): call the POST remove routes for cart lines, coupons and addresses`

**Issue type:** Bug · **Component / scope:** payment
**Branch:** `fix/MIL-XXX-commerce-remove-routes`
**Links:** epic MIL-69 · relates to MIL-74, MIL-75 · Postman `UNIVERSAL POST commerce-cart-line-remove-v1`,
`commerce-cart-coupon-remove-v1`, `commerce-address-remove-v1` · `prompts/optional-billing-address.md`

**Context.** CAIRA withdrew `DELETE` on 2026-10-14 and added `POST …/remove/` twins. UAT CORS never allowed
`DELETE` either (`docs/COMMERCE_API.md` issue 4), so these three actions fail in the browser today.

**Current behaviour.** "Remove" on a cart line, "Remove coupon" and "Delete address" send `DELETE` and fail
as status 0 ("We couldn't reach the server").

**Expected behaviour.**

- C4 `POST api/v1/commerce/cart/line/{line_id}/remove/`, no body, 200 = the whole cart. The last line
  answers `status: "cancelled"`, and the cart empties.
- D2 `POST api/v1/commerce/cart/coupon/remove/?cart_id=…`, no body, 200 = the whole cart.
- A5 `POST api/v1/commerce/address/{address_id}/remove/`, no body, 200 `{address_id, deleted}`. A 409 while
  an order uses the address shows the server's message.

**Scope.** In: the three route entries, the facade's A5 call, `docs/COMMERCE_API.md`. Out: the review and
invoice flow (tickets 2 and 3); `label` / `is_default` on the address form.

**Acceptance criteria**

- [ ] Each action sends the `POST …/remove/` request with no body and updates the page from the answer.
- [ ] Removing the last line shows the empty cart.
- [ ] Deleting an address an order uses shows the 409 message and keeps the address.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

**Risks.** The `POST` twins are not captured on UAT yet; the Postman examples are the contract.

**Estimate:** S

### Ticket 2. `feat(payment): make the billing address optional on review`

**Issue type:** Story · **Component / scope:** payment
**Branch:** `feat/MIL-XXX-optional-billing-address`
**Links:** epic MIL-69 · relates to MIL-80 · blocked by ticket 1 (same files) · `PATCH commerce/cart/` (C5)

**Context.** Product no longer wants the billing address to gate payment. The server accepts checkout without
one (`docs/COMMERCE_API.md`, "Checkout with no billing address succeeds").

**Current behaviour.** `/payment/review` embeds the whole address list and form, and "Proceed to Payment"
stays disabled until an address is picked (`invoice.ts` `canPay`).

**Expected behaviour.**

- Above Terms & Conditions, a row "Billing address (optional)". With an address picked, it shows the name,
  phone and one-line address on the right with "Change". With none, it shows "+ Add billing address".
- Both open a dialog holding the existing list and form. Saving a new address closes it; picking one and
  pressing Done closes it.
- Pay needs only the terms and no checkout in flight. With a pick that differs from the cart's, Pay puts it
  on the cart (C5) first, as today; with none, it checks out directly.

**Scope.** In: a new `dialogs/address-dialog/`, `BillingAddress` (one output, copy), the facade
(`selectedAddress`, `openAddressDialog`), the review half of `pages/invoice/`. Out: the invoice-page prompt
(ticket 3); a dedicated `Review` page.

**Acceptance criteria**

- [ ] Review with no address: no form on the page, "+ Add billing address" opens the dialog, Pay works.
- [ ] Review with addresses: the cart's or default one is summarised; "Change" picks another.
- [ ] Pay with no address sends `POST commerce/checkout/` with no C5 call.
- [ ] The address form and `location-min` still load only when the form opens (own lazy chunks).
- [ ] 375 / 768 / 1440 px: no horizontal scroll; the dialog fits and scrolls.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

**Estimate:** M

### Ticket 3. `feat(payment): ask for the billing address on the invoice page`

**Issue type:** Story · **Component / scope:** payment
**Branch:** `feat/MIL-XXX-invoice-billing-address`
**Links:** epic MIL-69 · blocked by ticket 2 and **by a backend route** (below)

**Context.** With the address optional at review, a paid order can have none. Product wants the invoice page
to ask for it.

**Backend ask (blocker).** No route sets an order's billing address. C5 (`PATCH commerce/cart/`) answers 409
"This cart has already been checked out", and a paid order carries no cart id. We assume
`PATCH api/v1/commerce/order/{order_id}/` with `{ "billing_address_id": "<uuid>" }`, answering 200 with the
order. The backend must confirm or name the real route before this PR merges.

**Expected behaviour.** On `/payment/invoice/:orderId`, a **paid** order with no billing address opens the
address dialog by itself once the order loads, once per visit. Done attaches the picked address to the order
and re-reads it, so Customer Details and the PDF show it. Closing with X leaves an inline
"+ Add billing address" link (not in the PDF).

**Acceptance criteria**

- [ ] A paid order without an address opens the dialog once; with an address, or pending/failed, it doesn't.
- [ ] Done sends the order route with `billing_address_id`, then `GET commerce/order/{id}/`.
- [ ] The downloaded PDF shows the address and never the prompt.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

**Estimate:** S

## Locked decisions

- **Reuse, don't rebuild.** `BillingAddress` already has the list, the add/edit form (signal forms, lazy
  `location-min`), and talks only to the root `PaymentFacade`, so it moves into the dialog as-is plus one
  output. The dialog copies `dialogs/coupon-dialog/` (shell, header, X) and opens from the facade with a
  dynamic `import()`.
- **"Selected" is `facade.selectedAddressId()`**, which already picks the cart's address, else the default,
  else the first. A returning learner sees their address summarised without doing anything.
- **The dialog returns the picked id** (`string | null`; X returns nothing), so the invoice page can act on it.
- **PR 3's route lives in one `COMMERCE_ROUTES` entry**, marked unconfirmed, so the backend's answer changes
  one line.

## PR 1: remove routes

- `features/payment/models/commerce.model.ts`: `removeLine` and `removeCoupon` become `POST …/remove/`.
  `deleteAddress` becomes the key `removeAddress`, `POST …/remove/`, typed
  `CommonResponse<{ address_id: string; deleted: boolean }>`. Doc comments cite the error reasons.
- `features/payment/services/payment-facade.ts`: `deleteAddress()` uses `removeAddress`. `removeLine()` and
  `removeCoupon()` are unchanged: `ApiClient.call()` sends `body: null` when none is given, so the requests
  go body-less, as the routes require.
- `docs/COMMERCE_API.md`: the contract change above the endpoint table; backend issue 4 marked moot.

## PR 2: optional address on review

- New `features/payment/dialogs/address-dialog/address-dialog.ts|html`: the coupon dialog's shell, heading
  "Billing address", a line "Optional. It appears on your invoice.", a scrolling body with
  `<app-billing-address (saved)="done()" />`, a Done button (disabled while the form is open).
  `injectDialogRef<void, string | null>()`. The card is `w-full`: the coupon dialog's `w-[95svw]` card
  overflows its `p-4` overlay at 375 px and the panel scrolls sideways.
- `components/billing-address/`: `saved = output<void>()`, emitted after a successful create or update. The
  empty card's "required" copy becomes optional.
- `services/payment-facade.ts`: `selectedAddress` computed; `openAddressDialog()` returns the dialog ref.
  Comments that say "required" are reworded.
- `pages/invoice/` (review mode): drop the embedded `<app-billing-address />`; add the summary row before the
  terms; `canPay` drops the address condition. `pay()` is unchanged.

## PR 3: invoice prompt

- `commerce.model.ts`: one `attachOrderAddress` entry (assumed path, marked unconfirmed).
- Facade: `attachOrderAddress(orderId, addressId)` → `ApiClient.call()`, then `loadOrder(orderId)` (same id
  re-reads K4).
- `pages/invoice/` (invoice mode): `needsAddress` computed (paid, no `billing_address_id`), a once-per-order
  effect that opens the dialog, and a `no-print` `@else` in Customer Details with the link.

## Security

- No new secrets or privileged calls. Address input is validated by the existing form (`required`,
  `ADDRESS_LIMITS`) before any request. Tokens go through the interceptors as before.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm build:prod` (bundle budget, lazy chunks for `address-dialog` and
`location-min`), then the running app on 4101.

## How to verify

1. **Cart:** remove a line → `POST …/cart/line/<id>/remove/`, no body, 200. Remove the last → empty cart.
2. **Coupon:** apply, then remove → `POST …/cart/coupon/remove/?cart_id=<id>`, 200.
3. **Review, no address:** row shows "+ Add billing address"; Pay works once terms are ticked; the dialog
   saves an address with `POST …/addresses/`, closes, and the row shows it.
4. **Review, addresses:** "Change" → pick another → Done → the row updates. Delete →
   `POST …/address/<id>/remove/` 200, or the 409 message.
5. **Pay without an address:** `POST …/checkout/` with `{cart_id}`, no C5.
6. **Invoice (PR 3, once the route exists):** paid order without an address → dialog opens → Done →
   order route → K4 re-read → address in Customer Details and in the PDF.
7. 375 / 768 / 1440 px.

## Risks

- The `POST …/remove/` routes are not captured on UAT yet.
- PR 3's route is an assumption. Until the backend confirms it, the call 404s with a toast.
- Signed-in UAT checks need a real UAT sign-in; with a dummy token the requests can be inspected but CAIRA
  answers 403.
