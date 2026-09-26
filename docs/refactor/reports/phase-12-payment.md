# Phase 12 — `features/payment`

## 1. Summary

**Of 22 stylesheets, 21 are deleted and 1 is kept.** 37 arbitrary colours were replaced with tokens: 1 existing token
and 10 new ones.

**Deleted as empty or dead (10):**

- 8 empty stylesheets: `address`, `cart-item`, `overview-wrapper`, `payment-status`, `price-overview`, `billing`,
  `cart`, `orders`.
- `payment.css`: all 148 lines were commented out.
- `plan-card.css`: nothing in it was live.
  - `.plan-card`, `--recommended` and `--enterprise` are used nowhere.
  - `.ribbon` appears only in commented-out HTML.
  - Its `hsl(var(--card))` values were invalid anyway, because `--card` is `rgb()`.

**`:host { display: block }` → `host: { class: 'block' }` (7):** `plan-selection-card`, `promo-coupons`,
`promo-offer`, `firm-sponsorship-dialog`, `partner-code-prompt-dialog`, `subscription-dialog`,
`plan-comparison-table`.

- `promo-offer`'s call-site classes (`w-full lg:max-w-lg lg:shrink-0`) don't conflict.

**Converted to template utilities (5):**

- **`plan-comparison-table`:** `.comparison > div { align-self: center }` became `[&>div]:self-center`.
- **`cart-drawer-dialog`:** the bottom-right gradient became `bg-linear-to-br/srgb from-[#0d1a2d] to-[#1a2332]`.
  `/srgb` keeps the original interpolation.
- **`coupon-dialog`:** `.coupon-badge-mask` became `[mask-image:…] [mask-size:100%_32px] [mask-repeat:repeat-y]`. The
  build re-adds the `-webkit-` prefixes.
- **`invoice`:** the `.box` perforated-edge mask became one `[mask:…]` arbitrary property. It compiles to
  `calc(100% - 24px)`, which is correct.
- **`plan`:** `.plan-page { background: var(--background) }` became `bg-background`.

**Kept, with a §4.6 reason:** `empty-cart.css`. It holds the `plopp` `@keyframes` and the `nth-child` animation delays
on the inline SVG's shape IDs.

**Colours → tokens.** Following the partners row, values repeated across 2+ files became tokens (`--mm-*` in `:root`,
`--color-*` in `@theme inline`, with a role comment).

| Token                        | Hex                                               | Uses                                                                                            |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `surface-state` (existing)   | `#151f2b`                                         | 3: `payment`, `empty-cart`, `billing`, the very uses its comment already named                  |
| `action`                     | `#4285f4`                                         | 8: the selected-address border and dot, and the address links/focus ring (`address`, `billing`) |
| `surface-inset`              | `#162230`                                         | 3: price box, coupon input, unselected plan panel                                               |
| `surface-deep`               | `#0f141a`                                         | 3: promo cards, plan-selection card                                                             |
| `sheet-top` / `sheet-bottom` | `#0f2237` / `#1a3a5c`                             | 3 each: the gradient behind the subscription, firm-sponsorship and partner-code dialogs         |
| `plan-1` … `plan-5`          | `#18222c` `#06345b` `#34495f` `#507192` `#6297e3` | 10: the plan-card, coupon and invoice gradient stops                                            |

**Colours left as they are, on purpose:**

- Hexes repeated only within one file, such as the `plan-card.ts` card gradient (`#1A2027`→`#203144`), the
  `price-overview` stops and the `orders` backgrounds.
- One-off gradients, such as the coupon badge's `#062149`→`#3B1964`.
- `coupon-dialog`'s `text-[#3b82f6]` / `text-[#60a5fa]`. They are value-equal to `--ring`/`--chart-2` and `--chart-1`,
  but those tokens mean something else.
- The 44 SVG `fill`/`stroke` attributes in the `empty-cart` and `payment` illustrations.

**No change needed:** there is no inline `styles`, `NgClass`/`NgStyle` or `@apply`.

## 2. Verification

These are the `verifier` subagent's results.

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (190 files / 698 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass (fix round 1)                        |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 of 4 routes                       |

- **Fix round 1:** the first run failed only the format check. `plan-card.ts` and `invoice.html` needed re-wrapping
  after their class strings shortened, so I ran prettier and re-ran the gates.
- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**. It compared each file against its `HEAD` original, including the cascade and the dead-code
  claims.
- **Prod CSS:** the verifier quoted every new rule. Each is correct: `[&>div]:self-center>div`, `to bottom right in srgb`,
  the prefixed mask trio, the invoice mask with `calc(100% - 24px)`, and every token utility.
- **Bundle:** the initial bundle is **89.1 KB gz, −0.1% vs baseline, up 0.5 KB on the last row.**
  - The rise comes from the 10 tokens plus the payment utilities moving from lazy component CSS into the global
    sheet. This is the same pattern as earlier rows, just larger.
  - There are 324 lazy chunks.
  - ⚠️ The margin under baseline is now thin, with `offerings` and `admin` still to go. See §3.

## 3. Decisions needed / skipped / suspicious

- **Watch the initial bundle** (not a decision yet):
  - Phase 12 has taken the initial CSS from 87.3 to 89.1 KB gz across the rows so far, because lazy component CSS moves
    into the global sheet.
  - Two large rows remain, `offerings` and `admin`, and they could push the initial bundle past baseline.
  - The bundle-report gate would catch that. If it does, the options are to accept the delta or keep some
    feature-scoped CSS lazy.
- **Kept CSS:** `empty-cart.css` (keyframes).
- **Stale comment, logged not fixed (§2.7):** `features/faculty/pages/faculty/faculty.css:2` says "Same as
  `.plan-page`", but that class no longer exists.
- **Token naming** is my call, following the file's role-naming convention. Rename freely:
  `action`, `surface-inset`, `surface-deep`, `sheet-top/bottom`, `plan-1…5`.
- The spinner-colour decision from `shared/ui` is still open.

## 4. Visual QA list

Check at 375 / 768 / 1440 px:

- **Plan page:** the page background, the recommended plan card's gradient, the plan-selection cards, the comparison
  table's row alignment, and the promo cards.
- **Invoice:** the perforated (scalloped) bottom edge on the receipt, and both gradients.
- **Coupon dialog:** the dialog gradient, the notched left edge of the coupon badges, and the input field.
- **Cart drawer:** the navy gradient.
- **Billing:** the "no address" panel, its hover/focus border in action blue, the selected-address border and dot,
  and the add/edit address links.
- **Subscription, firm-sponsorship and partner-code dialogs:** the navy top-to-bottom gradient.
- **Price overview:** the inset price box.

## 5. Commit message

```
style(payment): move payment styling to Tailwind utilities and tokens

- delete 21 of 22 stylesheets: 8 empty, payment.css (all commented out),
  plan-card.css (dead classes), 7 :host → host class, 5 → utilities
  (comparison row alignment, cart-drawer gradient, coupon + invoice
  masks, plan page background)
- empty-cart.css stays (keyframes on the inline SVG)
- bg-[#151F2B] → surface-state; add payment tokens for colours repeated
  across files (action, surface-inset, surface-deep, sheet-top/bottom,
  plan-1…5), replacing 37 arbitrary values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
