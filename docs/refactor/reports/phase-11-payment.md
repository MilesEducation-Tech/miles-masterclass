# Phase 11 — `features/payment`

## 1. Summary

5 files changed, no new files, no moves. **This is the row PLAN.md called "Phase 11's main prize".**

- **Billing's location data now loads only when the address form opens.** This was your decision this session;
  the Phase 11 line in STATE.md "Decisions" is ticked.
  - `constants/location-min.ts` (country → state → city data, 9.2 MB source) is no longer statically imported.
  - `billing` loads it through `resource({ params: () => showForm() ? true : undefined, loader: () => import(…) })`.
  - `countryOptions` became a `computed`. `stateOptions` and `cityOptions` read the loaded data.
  - A `countryPlaceholder` computed renders the §4.2 loading and error states explicitly ("Loading countries…" /
    a retry hint).
  - Someone who picks an already-saved address never downloads it.
  - Editing an existing address keeps its value while the options load. The `reviewer` checked `aria-autocomplete`:
    its value is bound to the form field, not filtered by options. Only the label appears a moment later.
  - `resource()` with an `import()` loader follows the §4.2 non-HTTP `resource()` precedent (`httpResource` does not
    apply).
- **`UtilsDialog` → `import()` at open** in `plan.openSignupDialog()` and `invoice.proceedToPayment()`. Their early
  returns come before the import, and all callers fire and forget. `constants/payment.ts` is `import type`.
- **Already compliant:**
  - `payment-facade` lazy-loads its 4 dialogs.
  - `plan` lazy-loads `PartnerCodePromptDialog`.
  - `invoice` uses `injectAsync` for `HtmlToPdf`.
  - No `@defer` candidates.

## 2. Verification

Full `verify.mjs`, first run. **I ran it directly**: the `verifier` subagent's attempts were refused by the
harness guard hook, the same intermittent refusal an earlier verifier hit, and it made no further attempt. No gate
or hook was changed.

| Gate            | Result              |
| --------------- | ------------------- |
| lint            | pass                |
| unit tests      | pass                |
| build (local)   | pass                |
| build (prod)    | pass                |
| storybook build | pass                |
| format check    | pass                |
| bundle report   | pass                |
| ssr smoke       | pass: 4 of 4 routes |

The baseline dir was clean after the run. The payment specs pass (16 files / 24 tests).

**Bundle:**

- Initial is unchanged: 88.0 KB gz (−1.3% vs baseline); "Initial total" is 243.34 kB.
- **The billing page chunk is now 14.4 KB raw** (`chunk-4J3RWBJM`). It reaches the location data **only through a
  dynamic `import()`**: 1 `import("./chunk-BM2R35IM.js")`, and no file imports that chunk statically.
- The location chunk itself is 3.49 MB raw / **855 KB gzip**. Before this change billing loaded it statically
  alongside the page. Now it is fetched only when the form opens.

## 3. Decisions needed / skipped / suspicious

- **None needed.** The location-min decision is settled and ticked.
- A user who adds an address still downloads 855 KB when they open the form. Shrinking the data itself (per-country
  city files) was the option you did not pick. It can be revisited later.
- No `@Injectable`, no CSS files, no heavy-library service left eager.

## 4. Visual QA list

Signed in with an item in the cart:

- `/…/payment/billing` with a saved address: select it and proceed. The Network panel shows no large location
  chunk.
- "Add new address": the country field shows "Loading countries…" briefly, then country → state → city work as before.
- Edit a saved address: country, state and city stay selected; the labels fill in once loaded.
- `/…/payment/plan` signed out: "login" prompts open the sign-up dialog.
- `/…/payment/invoice` with a subscription item: "Proceed to Payment" opens the auto-renewal terms dialog.

## 5. Commit message

```
perf(payment): load billing's location data only when the address form opens

- billing: the 855 KB-gzip country/state/city data (constants/location-min)
  is no longer a static import; a resource() gated on showForm() loads it
  with import(), with explicit loading/error placeholder text on the country
  field. Picking a saved address never downloads it
- plan and invoice load UtilsDialog with import() when opened;
  constants/payment imports its dialog type with `import type`

Billing page chunk is now 14.4 KB and reaches the location chunk only
through import().

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
