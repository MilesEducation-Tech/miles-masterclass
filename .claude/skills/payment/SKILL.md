---
name: payment
description: The payment feature of Miles Masterclass v3 — subscription plans, cart, coupons, billing address, checkout, orders and invoices, PaymentFacade, the cart resolver and payment guards. Read before touching features/payment or anything involving money.
---

# Payment

Plans, cart, checkout, orders, invoices. **Money path — nothing here gets simplified away.** Validation, error handling and idempotency stay.

## Files

```
features/payment/
├── payment.routes.ts                      # cartResolver + guards
├── payment.ts                             # shell (header + breadcrumb)
└── shared/
    ├── service/payment-facade/            # 859 lines
    ├── constants/plan-icons.ts
    ├── pages/{plan,cart,billing,orders,invoice}/
    └── components/{overview-wrapper,cart-item,empty-cart,payment-status,promo-offer,
                    promo-coupons,price-overview,plan-card,plan-selection-card,address,
                    plan-comparison-table,plan-scrolling-gallery}/
```

Dialogs: `dialog/cart-drawer-dialog`, `coupon-dialog`, `subscription-dialog`, `firm-sponsorship-dialog`.

## Routes

```
/:country/:profession_type/payment/
  plan                       plan picker           RenderMode.Server (marketing-visible pricing)
  invoice/:orderId           authGuard             RenderMode.Client
  order-history              authGuard
  ''                         shell + cartResolver
    ''                       OverviewWrapper (sidebar layout)
      cart                   cart contents
      billing                paymentGuard: non-empty, non-mixed cart
    review                   paymentGuard: cart + selected address
```

## The cart resolver

`cartResolver` sits on the shell route. Parent resolvers run **before** any child's `canActivate`, so cart state is guaranteed loaded by the time `paymentGuard` evaluates on `/billing` or `/review` — even on a hard refresh or deep link where the shell component hasn't been constructed yet (guards run before components instantiate).

It always fetches fresh (`force: true`): the cart changes outside the shell (add-to-cart on the sibling plan page), so a cached bucket shows stale items and totals. It runs once per shell activation, so that's at most one fetch per entry. It's skipped during SSR — the bucket endpoint is authenticated and the protected pages are `RenderMode.Client`.

Don't move this into a component. Deep-linking `/payment/billing` is exactly the case it exists for.

## PaymentFacade

**Cart**: `loadMyBucket({ force })`, `removeCartItem(cartitemId)`, `removeCoursesFromCart()`.

**Coupons**: `loadCoupons()`, `coupons`, `applyCoupon(code)`, `removeCoupon(code)`.

**Address**: `loadBillingAddress()`, `saveBillingAddress(payload)`, `updateBillingAddress(id, payload)`, `deleteAddress(id)`.

**Checkout**: `proceedToPayment(isTrial = false)`.

**Invoice** — a large block of computeds off `orderData()`: `invoiceItems`, `invoiceItemCount`, `invoiceBillingAddress`, `invoiceFormattedAddress`, `invoiceUserData`, `invoiceCurrency`, `invoiceCurrencySymbol`, `invoicePaymentStatus`, `invoiceTransactionDetails`, `invoiceSubTotal`, `invoiceTotalDiscount`, `invoiceTotalDiscountPercent`, `invoiceGrandTotal`, `invoiceTaxAmount`, `invoiceCouponDetails`, `invoiceProductDiscount`.

**`cartItemRemoved: Signal<number | null>`** — cross-facade sync. Other facades watch it so a removed item disappears from course pages too. Removing an item without emitting it leaves stale "in cart" badges.

## Money rules

- **The server computes every total.** Subtotal, discount, tax and grand total are read from the response, never recomputed client-side. A client-side sum that disagrees with the invoice is a support ticket.
- Currency and symbol come from `orderData().country_details` — never hardcode `$`.
- Never round for display in a way that changes a stored value. Format at the render edge only.
- Checkout must be idempotent from the UI side: disable the button on submit, and never retry a payment automatically.
- A failed payment surfaces the server's message. Never invent a friendlier one that hides why it failed.

## Guards

`paymentGuard` blocks `/billing` on an empty or **mixed** cart (item types that can't be purchased together) and blocks `/review` without a selected address. Keep the checks in the guard, not in the page.

## Plans

`/payment/plan` is `RenderMode.Server` — pricing is marketing-visible and needs to be crawlable. `plan-comparison-table`, `plan-scrolling-gallery`, `plan-card`, `plan-selection-card`, `plan-benefits`. `dialog/subscription-dialog` handles upgrades; `firm-sponsorship-dialog` covers B2B-sponsored access.

Payment dialogs are lazy-loaded to keep them out of the initial bundle. Don't make them eager.

## Invoices

`html-to-pdf` (jsPDF + html2canvas-pro) renders the invoice client-side. Everything on the PDF comes from the `invoice*` computeds — never from a locally reassembled total.

## Gotchas

- The plan page is a **sibling** of the shell, so it doesn't get `cartResolver`. Add-to-cart there must refresh the bucket itself.
- Coupon state lives in the facade; applying one changes every total. Re-read the computeds, don't patch a displayed number.
- `invoiceUserData` and `invoiceFormattedAddress` derive from `orderData` — an order that predates a profile change keeps the address it was placed with. That's correct.
- Never persist card details, and never add a field that would capture one. Payment credentials are the provider's responsibility, not this app's.

## Verify

```bash
pnpm start
```

1. `/us/cpa/payment/plan` — plans render with the right currency.
2. Add to cart → `/payment/cart` shows the item and the server's totals.
3. Apply a coupon — totals change; remove it — they revert exactly.
4. **Deep-link `/payment/billing` on a hard refresh** — the resolver loads the cart and the guard decides correctly.
5. Empty cart → `/billing` is blocked and `empty-cart` renders.
6. Add an address, select it, reach `/review`.
7. Complete a checkout → order appears in `/payment/order-history`.
8. `/payment/invoice/:orderId` — totals match the order exactly; PDF download works.
9. Remove a cart item, then open a course page — the "in cart" state is gone (`cartItemRemoved`).
