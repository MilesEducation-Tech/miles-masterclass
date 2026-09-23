# Phase 5 — session 7: `payment`

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
Seventh session of the sequence in [PHASE-05-REMAINING.md](../PHASE-05-REMAINING.md).

## 1. Summary

```
payment/shared/components/<11 folders>/  ->  payment/components/
payment/shared/pages/{billing,cart,invoice,orders,plan}/  ->  payment/pages/
payment/shared/constants/plan-icons.ts   ->  payment/constants/   (merged into the existing folder)
payment/shared/service/payment-facade/payment-facade.ts(+spec) -> payment/services/payment-facade.ts(+spec)
```

**62 renames, 17 files with a content diff** (12 inside payment, 5 outside). Every hunk in all 17 is
a bare import-specifier swap — the reviewer confirmed each modified file has exactly one hunk.

`payment.ts` stayed at the feature root as a `<router-outlet/>` shell per decision D2, and
`overview-wrapper` stayed in `components/` per the same decision's recorded sub-case.

**`features/payment/shared/` is gone. Only `offerings` remains** — 5 layers, 106 files.

### One move in this session was not like the others

The lesson from `partners` was that dropping a `shared/` layer leaves relative imports untouched when
**both** endpoints drop it together. That held again here, twice:

- the `../../components/<x>/<x>` imports from the five pages: unchanged;
- `plan-comparison-table.ts`'s `../../constants/plan-icons`: **also unchanged**, because
  `shared/constants/` and `shared/components/` dropped the layer together, even though the
  destination folder `constants/` already existed with two files in it.

**`service/` -> `services/` was the exception, and it collapsed two segments at once**: singular to
plural, _and_ folder-per-service to a flat file. `shared/service/payment-facade/payment-facade` became
`services/payment-facade`. Nothing about that is symmetric, so every crosser changed — 7 relative and
10 absolute.

### `PaymentFacade`: what changed, and what deliberately did not

`PaymentFacade` is the most boundary-crossed symbol in this repo: **17 importers**, 12 inside payment
and 5 outside it — `shared/services/utils.ts:48`,
`shared/dialogs/subscription-dialog/subscription-dialog.ts:5`,
`layout/footer-overlay/footer-overlay.ts:22`, and both `offerings` facades. All 17 were repointed,
and a repo-wide grep for `payment/shared` now returns nothing.

**This removed no boundary violation.** Five of those importers are §3 violations
(`shared -> features` x2, `layout -> features` x1, `features -> features` x2), and they are exactly
as illegal at the new path as at the old one. The session made the import text shorter; the
architecture is unchanged. All nine banned edges in the repo still stand, and Phase 7 still owns them.

Two related things worth recording:

- `utils.ts:767`'s dynamic `await import('@features/payment/dialogs/cart-drawer-dialog/…')` needed
  **no** change, because `dialogs/` was already at the feature root and did not move.
- `eslint.config.mjs:16` ignores `payment/constants/location-min.ts` by exact filename, not by folder
  glob. `plan-icons.ts` moved _into_ that same folder and is therefore still linted normally — which
  is correct, but is the kind of thing a folder-level ignore would have silently changed.

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 17s  |
| build (local)   | pass   | 24s  |
| build (prod)    | pass   | 25s  |
| storybook build | pass   | 21s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

Unit tests: 152 files, 443 passed / 1 pre-existing skip — including the relocated
`payment/services/payment-facade.spec.ts`.

**Bundle.** Initial **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**.
Lazy **271 chunks, unchanged**; no chunk created or removed, none moved by more than 0.6 KB. That
matters more here than the number suggests: `PaymentFacade` is reached from `shared/`, `layout/`,
`offerings/` and its own feature, so a chunking shift was a real possibility.

**SSR smoke** — all four routes match baseline. **No payment route is in the smoke set**, so the gate
did not exercise this session directly.

`reviewer` subagent — **PASS, zero violations.** It confirmed every modified file has exactly one
import-only hunk, that all seven `path:` values in `payment.routes.ts` are byte-identical, that no
stale `payment/shared` specifier survives anywhere including dynamic imports, and that `src/seo.ts`,
`src/legacy-redirects.ts`, `src/app/app.routes.server.ts`, `layout/footer/footer.ts` and
`layout/header/nav.config.ts` all show zero diff.

**Recorded-baseline check:** clean.

## 3. Decisions needed / skipped / suspicious

### Needs your attention

1. **This session repointed five of the repo's nine banned edges without fixing any of them.** Worth
   stating plainly so the shorter import paths are not mistaken for progress on boundaries. Current
   census, all pre-existing:

   | Class                  | Count | Locations                                                                 |
   | ---------------------- | ----: | ------------------------------------------------------------------------- |
   | `core -> shared`       |     2 | `notification.ts:3`, `update-checker.ts:84` (**dynamic**)                 |
   | `shared -> features`   |     4 | `subscription-dialog.ts:5,6`, `utils.ts:48`, `utils.ts:767` (**dynamic**) |
   | `layout -> features`   |     1 | `footer-overlay.ts:22`                                                    |
   | `features -> features` |     2 | `masterclass-facade.ts:29`, `micro-learning-course-facade.ts:40`          |

   **Six of the nine import `PaymentFacade`.** The reviewer also noted that `footer-overlay.ts:22` is
   in a component body, not a route config — section 3 permits `features -> layout` in route configs,
   but this is the reverse direction and not in a route config either way.

2. **`public/version.json` and `core/version/app-version.ts` are dirty from build-timestamp
   regeneration.** They are not part of any refactor unit and should be excluded when committing.
   This is open question 6 in STATE.md, still unresolved; it has now dirtied the tree in every
   session of this phase.

### Logged, not fixed (PROMPT.md section 2.7)

3. **`payment/constants/location-min.ts` is in the ESLint ignore list** because of its size — this is
   the 839 KB gzip chunk flagged as the single biggest performance win in the Phase 0 audit and
   assigned to Phase 11. Now that its folder also holds `plan-icons.ts` and `payment.ts`, the ignore
   entry's file-specific form is load-bearing; do not "tidy" it into a folder glob.
4. **`promo-offer`, `promo-coupons` and `plan-comparison-table` have no specs**, while the other
   eight payment components do.
5. **Every `.css` in the payment tree is free of `@import`/`@reference`/`url()`**, so none of the 62
   renames carried a depth-sensitive style reference.

## 4. Visual QA list

Every hunk is an import swap and no template or stylesheet changed. But **no payment route is in the
SSR smoke set**, and payment is the feature where a runtime failure costs the most.

Walk the full checkout flow, which exercises every moved page and the facade they share:

- **`/{c}/{p}/payment/plan`** — the entry point, and the page with the most moved imports
  (`plan-comparison-table`, `plan-selection-card`, `promo-offer`, `promo-coupons`, plus the facade).
- **`/{c}/{p}/payment/cart`** -> **`/billing`** -> **`/review`** — the three children of the
  `overview-wrapper` shell, whose own lazy specifier changed. If the shell fails to resolve, all
  three go blank together rather than erroring individually.
- **`/{c}/{p}/payment/order-history`** and **`/{c}/{p}/payment/invoice/:orderId`** — `orders` and
  `invoice`; the invoice page also lazy-loads `html-to-pdf`, so try a PDF download.
- **The cart drawer from anywhere in the app** — opened via `utils.ts:767`'s dynamic import, the one
  payment specifier that deliberately did _not_ change. Confirm it still opens.
- **The subscription dialog** — it renders `plan-selection-card` from `@features/payment/components/…`
  after the repoint, and is the only external consumer of a payment component.

## 5. Commit message

```
refactor(structure): phase 5 payment

Dissolve the internal shared/ layer in features/payment/.

- shared/components/<11 folders>/ -> components/
- shared/pages/{billing,cart,invoice,orders,plan}/ -> pages/
- shared/constants/plan-icons.ts -> constants/ (joining location-min.ts and
  payment.ts)
- shared/service/payment-facade/payment-facade.ts(+spec) ->
  services/payment-facade.ts(+spec), collapsing singular service/ to plural
  services/ and folder-per-service to a flat file

payment.ts stays at the feature root as a router-outlet shell, and
overview-wrapper stays in components/ as a nested shell (recorded decision D2).

The ../../components/... and ../../constants/plan-icons relatives needed no
rewrite: both endpoints dropped the shared/ layer together. Only the facade
move was asymmetric, collapsing two segments at once, so all 17 PaymentFacade
importers changed - 12 inside payment and 5 outside, in shared/services/utils,
shared/dialogs/subscription-dialog, layout/footer-overlay and both offerings
facades. Those five are pre-existing boundary violations; this repoints them,
it does not fix them.

Structure only: no logic, URL, selector or template change. All seven route
path values are byte-identical. Initial bundle and lazy chunk count unchanged.
```
