# CAIRA commerce API: what UAT actually returns

The contract is the CAIRA _Commerce & Catalogue API_ front-end guide (12 Oct 2026), plus the Postman folders
"10. Commerce" and "09. Catalogue". This file records only what we **observed** on UAT, and where it differs
from those sources. The plan is `prompts/commerce-api-rebind.md`.

**Capture, 2026-10-13:**

- **Who and where:** a signed-in UAT test learner, `X-Country-Code: US`, using the scratchpad script
  `capture-commerce.sh`.
- **Sequence:** cart → add the US plan → coupon → checkout → order → remove the line.
- **Not captured:**
  - a `free_order`;
  - a paid order and the Stripe return.

  None of these can be reached until the backend issues below are fixed.

**Address capture, 2026-10-13** (scratchpad script `capture-addresses.sh`): A1–A5 and C5. See "Addresses"
below.

## Confirmed

- **The envelope** is `{success, message, data}` everywhere. A 4xx carries `data: {status: "error", reason}`.
  Show `message` and branch on `reason`.
- **Money** is a decimal string (`"948.00"`) and ids are UUID strings, as the guide says.
- **Cart:** every key `Cart` types (`core/models/commerce.model.ts`) is present, and all six captured carts
  pass `isCart`. Lines also carry `quantity`, `booking` and `enrollment_form`, which the app doesn't read.

## Endpoint by endpoint

| Call                                  | Status | Observed                                                                                                                          |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| C1 `GET commerce/cart/`               | 200    | Creates an empty cart when none exists. **An empty US cart reports `currency: "INR"`** (see below).                               |
| C2 `POST commerce/cart/lines/`        | 201    | `data: {status, created: true, line_id, result: Cart}`; the cart's currency becomes `USD`.                                        |
| C2, same plan again                   | 200    | `created: false`, with the same `line_id`. Re-adding is harmless.                                                                 |
| D1 `POST commerce/cart/coupon/`       | 409    | `code_invalid`, "That code is not valid for this cart." An **empty** cart gives the same, not `cart_empty`.                       |
| D2 `DELETE commerce/cart/coupon/`     | 200    | **The whole cart**, "Removed successfully.". Postman's `data: {}` is wrong; the guide is right.                                   |
| A1 `GET commerce/addresses/`          | 200    | `{status, count, results}`, unpaginated.                                                                                          |
| K1 `POST commerce/checkout/`          | 201    | Order `pending`, `payment: null`, **`payment_error: "gateway_not_configured"`**, `free_order: null`.                              |
| K4 `GET commerce/order/{id}/`         | 200    | Matches the guide. `payments: []` while unpaid. Postman's hand-built example was accurate.                                        |
| K3 `GET commerce/orders/?page_size=2` | 200    | `{status, count, page, page_size, next, previous, results}`. Rows are full orders with `payments: []`.                            |
| K2 `POST commerce/payment/session/`   | 503    | `gateway_not_configured`, "Payments are temporarily unavailable. Try again shortly."                                              |
| C4 `DELETE commerce/cart/line/{id}/`  | 200    | **The whole cart** with `status: "cancelled"`. Postman's `data: {}` is wrong.                                                     |
| C1 after C4                           | 200    | A **new** cart id, `open` and empty.                                                                                              |
| K4 after C4                           | 200    | The order is now `cancelled`. Its line keeps `status: "pending"`, with `cancellation_reason: "Cart emptied by the buyer (D-L4)."` |

**Checkout with no billing address succeeds**, so the server doesn't require one for a subscription. D1-A
(require it in our UI) is a product choice, not a contract rule.

## Backend issues found by the capture

1. **Stripe is not configured on UAT.** K1 returns `payment_error: "gateway_not_configured"`, a value the
   guide doesn't list, and K2 answers 503. No payment can be started, so PR5 can't be verified end to end.
2. **An empty cart's currency is wrong.** A fresh US cart reports `currency: "INR"` until a line is added.
   The UI shows no totals for an empty cart, so nothing renders wrongly, but the value is wrong.
3. **Postman's examples for D2 and C4 (`data: {}`) are wrong.** Both return the whole cart. Ask for a
   regenerated collection.
4. **UAT CORS doesn't allow `DELETE`** (checked 2026-10-14, from localhost and the UAT Vercel URL):
   preflight answers `access-control-allow-methods: GET, OPTIONS, PATCH, POST, PUT`. In a browser, D2
   (remove coupon), C4 (remove from cart) and A5 (delete address) all fail as status 0, which the app
   shows as "We couldn't reach the server". The calls are right; the backend must add `DELETE`.
5. **`GET commerce/coupons/` isn't in Postman** (the 2026-10-14 export has only D1/D2). Captured below.

## Client rules these observations add

- **Treat any `payment_error` as "no session".**
  - Show the message, and keep the learner on the order.
  - Offer "Try again", which calls K2, rather than calling K2 automatically: K2 fails the same way while the
    gateway is down.
- **A C4 response with `status: "cancelled"` means the cart is gone.** Show the empty cart; the next C1
  creates a fresh one.
- **Never show `currency` or totals for a cart with no lines.**

## Addresses

Every captured address passes `parseAddresses` and carries the keys `Address` types
(`features/payment/models/commerce.model.ts`). The API also sends `label` and `updated_at`, which the app
doesn't read.

| Call                                     | Status | Observed                                                                                                       |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| A2 `POST commerce/addresses/`            | 201    | The address, `is_default: false`. A `postal_code` of `"07301"` keeps its leading zero.                         |
| A2 with `""` for `line2`/`landmark`      | 201    | **Accepted; stored as `null`.** Sending `""` is how an edit clears an optional field.                          |
| A2 missing `line1`/`state`/`postal_code` | 400    | `invalid_query`, with `errors: [{field, message: "Field required"}]` per field.                                |
| A1 `GET commerce/addresses/`             | 200    | `{status, count, results}`.                                                                                    |
| A4 `PATCH commerce/address/{id}/`        | 200    | The updated address, "Saved successfully.".                                                                    |
| A4 with `{}`                             | 400    | "No fields to update." No `reason`.                                                                            |
| C5 `PATCH commerce/cart/` (billing only) | 200    | The whole cart, with `billing_address_id` set. `shipping_address_id` stays `null`. Works on an empty cart too. |
| A5 `DELETE commerce/address/{id}/`       | 204    | Empty body. **The cart's `billing_address_id` is cleared server-side.**                                        |

**What the client does about it:**

- **Blank optional fields go as `""`.**
- **Deleting the cart's address** clears `billing_address_id` from the local cart, as the server does.
- **Proceed on billing always re-attaches the selected address**, so a stale attachment can't reach
  checkout.

## Coupon list

Captured on UAT 2026-10-14 with the test learner's token. The endpoint came from the backend as a curl;
it isn't in Postman yet.

| Call                                          | Status | Observed                                                                                  |
| --------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `GET commerce/coupons/`, no token             | 401    | "Authentication credentials were not provided."                                           |
| `GET commerce/coupons/`, US, cart with a line | 200    | `data: {status: "ok", count: 1, cart_id, results: [Coupon]}`.                             |
| `GET commerce/coupons/`, IN, no cart          | 200    | `cart_id: null`, `count: 0`, `results: []`. It does **not** create a cart (C1 does).      |
| `GET commerce/coupons/?cart_id=<id>`          | 200    | Same list; `cart_id` is accepted.                                                         |
| `GET commerce/coupons/?foo=bar`               | 400    | `reason: "invalid_query"`, "Extra inputs are not permitted". Strict query, like the rest. |

One coupon, as returned:

```json
{
  "code": "MMC250",
  "description": null,
  "discount_type": "flat",
  "discount_value": "250.00",
  "max_discount_amount": null,
  "min_order_amount": null,
  "currency": "USD",
  "applies_to": "eligible_items",
  "applicable_to_all_products": true,
  "valid_to": "2026-12-31T23:59:59Z",
  "discount_amount": "250.00",
  "lines": [{ "line_id": "…", "discount_amount": "250.00" }]
}
```

- **`discount_amount` is the saving on this cart**, worked out by CAIRA; the UI shows it, not
  `discount_value`.
- **`valid_to` is the end of a UTC day.** Formatted in the viewer's zone, IST reads it as the next day,
  so the dialog formats it in UTC.
- **Applying is D1 as before.** The list only offers codes; the cart's `coupon` says which one is applied.
