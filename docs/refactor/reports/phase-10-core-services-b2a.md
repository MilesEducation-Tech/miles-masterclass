# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B2a

Date: 2026-09-26 · Branch: `refactor/structure-10` · Fourth batch. B2 is split into B2a (payment) and B2b
(offerings, tracker and library). The row stays 🟡.

## 1. Summary

The five `features/payment` dialogs moved **as one set**, because they open one another. `SubscriptionDialog` leads
to the cart drawer, the partner-code prompt and firm sponsorship; the cart drawer leads to the coupon dialog.

| Dialog                    | In the shell                                                                                                             | Openers                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `SubscriptionDialog`      | `maxWidth="95vw"`, "Subscribe to a plan"                                                                                 | `utils.requireCpeModeAccess` and `engagement-dialog`, both through the `SUBSCRIPTION_DIALOG` token |
| `CartDrawerDialog`        | **`position="right"`**, `width="500px"`, `maxWidth="90vw"`, `height="100vh"`, "Cart". This is the first drawer migrated. | `payment-facade.openCartDrawer`, and `utils.openCartDrawer` through `CART_DRAWER_DIALOG`           |
| `CouponDialog`            | `width="460px"`, `maxWidth="95vw"`, "All Coupons"                                                                        | `payment-facade`                                                                                   |
| `FirmSponsorshipDialog`   | `maxWidth="95vw"`, "Firm Sponsorship"                                                                                    | `payment-facade`                                                                                   |
| `PartnerCodePromptDialog` | `maxWidth="95vw"`. The label follows `data?.codeOnly`, reproducing its two callers' labels exactly.                      | `payment-facade` (no data) and the `plan` page (`{ codeOnly: true }`)                              |

The dialogs' own inner `role="dialog"` attributes were removed. The unused `data: {}` passed to the cart drawer was
dropped.

**Old-service code retired with this batch:**

- **`payment-facade` and `engagement-dialog` no longer use the old service at all.**
- `engagement-dialog`'s temporary `afterClosedOld` helper, added in B1b, is gone, along with its `DialogRef` import.

**The lazy-loading contract is unchanged.** These dialogs are still reached only through `import()` or the core
tokens. The `import type` lines in `payment-facade` and `plan` now name the dialog data and result types instead of
the dialog classes. Both are erased at build time.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**, with 169 files / 599 passed +
1 skipped. None of these five dialogs has, or ever had, its own spec. The facade, `plan` and `utils` specs pass.

`reviewer`: **PASS**. It raised one non-blocking nit, a stale "`data` is assigned after construction" comment in
`partner-code-prompt-dialog`, which I removed. `pnpm lint` was re-run clean after that comment-only change.

- It confirmed the lazy-loading contract, the per-ref `afterClosed` renames, and that `shared → features` stays
  token-based.
- It confirmed no `this.dialog.open(` remains for these five dialogs.

**Real browser**, driven through the running app's own `Utils` service:

- **Cart drawer:** it slides in from the right (`dialog-slide-in`), is full viewport height and 500 px wide, is
  labelled "Cart", and Escape closes it. The 5 px gap at the right edge is the scrollbar that the scroll lock keeps
  in place.
- **Subscription dialog,** opened through the real `SUBSCRIPTION_DIALOG` token loader: centred, 95vw max, labelled
  "Subscribe to a plan", content rendered, focus inside, and it closes cleanly.
- **Not driven:** the coupon, firm-sponsorship and partner-code dialogs. They need a cart or a plan, and the payment
  APIs are empty locally. Nesting between shell dialogs was already proven in B1b (`CourseInfo` → `ShareDialog`).

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Pre-existing, logged:** `Utils.canAccessCpeMode()` always returns `true`, because its plan check went with the
  removed session service. So `requireCpeModeAccess()` never opens the subscription paywall today. It is the same
  family as the dead session state in `header` and `footer-overlay`.
- **Size:** the diff is +508 / −534 across 14 files, but **+76 / −102 ignoring whitespace**.
- **Remaining on the old service:**
  - **B2b:** 9 offerings, tracker and library dialogs.
  - **B3:** 13 admin dialogs.
  - **B4:** `UtilsDialog` (18 calls). Six admin dialogs plus `UtilsDialog` still carry the "property-injected by the Dialog service" comment; the pattern notes now say to fix it on migration.

## 4. Visual QA list

1. **Add a course to the cart → the cart drawer.** It slides in from the right, full height and 500 px, and the
   backdrop click closes it. Apply a coupon from it: the coupon dialog must open **above** the drawer.
2. **The plan page:** "Apply a partner code" (code-only prompt), and Subscribe on the recommended plan, which opens
   the full prompt with "Continue to subscribe".
3. **Firm sponsorship** from the plan flow.
4. **The signed-in subscription upsell** (engagement dialog). Check it opens and closes, and that it isn't re-shown
   in the same session.

## 5. Commit message

```
refactor(payment): move the payment dialogs onto the ng-primitives shell

- SubscriptionDialog, CartDrawerDialog (right-hand drawer), CouponDialog,
  FirmSponsorshipDialog and PartnerCodePromptDialog migrate together since
  they open one another; each owns its size and label
- payment-facade and engagement-dialog no longer use the hand-rolled Dialog;
  engagement-dialog's temporary old-ref helper is removed
- dialogs stay lazy: type-only imports now name data/result types, and
  shared still reaches them through the core tokens

Batch B2a of the Dialog service migration (Phase 10, core/services).
```
