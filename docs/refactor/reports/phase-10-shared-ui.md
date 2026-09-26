# Phase 10 — Headless UI · `shared/ui`

Date: 2026-09-25 · Branch: `refactor/structure-10` · Scope: `shared/ui` only (your decision, STATE.md "Decisions").

## 1. Summary

The inventory showed this row is mostly finished already. **13 of the 17 `shared/ui` primitives already sit fully
on ng-primitives** (button, select, aria-select, aria-autocomplete, aria-multiselect, otp, tab-strip,
checkbox-list, select-menu, progress, toast) or are not interactive (error-state, forms, page-loading, spinner).
Two items remained:

| Item                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/ui/autocomplete/`                    | **Deleted** (5 files, −834 lines). It was a hand-rolled overlay combobox with zero consumers, and `aria-autocomplete` had already replaced it everywhere. Deletion approved per PROMPT.md §7. `import-auditor` found no importers, no selector usage and no config/glob references. The two stale `<app-autocomplete>` JSDoc lines in `core/services/job-sectors/job-sectors.ts` now name `<app-aria-autocomplete>`. |
| `shared/ui/aria/aria-input`, `checkbox` case | A native `<input type="checkbox">` became a `<button ngpCheckbox>` (`role="checkbox"`, `aria-checked`, Space toggles and Enter doesn't). The checked style is now `data-[checked]:` in place of an `isChecked()` class branch. The native `<label for>` is kept, so clicking the label still toggles, and the `[labelLink]` anchors inside it still navigate instead of toggling.                                    |
| `shared/ui/aria/aria-input`, `radio` case    | Native radios inside a hand-written `role="radiogroup"` became `ngpRadioGroup` / `ngpRadioItem` / `ngpRadioIndicator`. The group now handles roving focus and arrow-key selection. Blur → `touched` moves to the group's `focusout`.                                                                                                                                                                                 |
| aria wiring for both                         | `ngpFormField` on the wrapper, `ngpLabel` on the radio heading, and `ngpDescription` on the hint/error. See §3.1 for why this was **required**, not a nicety.                                                                                                                                                                                                                                                        |
| Spec / stories                               | `aria-input.spec.ts` went from 1 test to **13** (click, Space/Enter, disabled, blur→touched, arrow keys, disabled radio option, external value, aria-labelledby/describedby). Two stories were added: `CheckboxChecked` and `RadioSelected` (with a disabled option).                                                                                                                                                |

**Public API is unchanged:** same selector, same inputs and models, and the same `FormValueControl` contract.
No call site was touched. There are ~20 checkbox consumers across auth, faculty, payment, admin and shared forms,
and **zero** radio consumers outside the spec and stories.

**Bookkeeping (step 0):** Phase 10 cells were added to the Part B tracker for the Phase 10 work the Phase 0 table gave to no session:
`core/services` (Dialog), `shared/components`, `shared/dialogs`, `features/offerings` and `admin/*`. Owners were confirmed by grep.

## 2. Verification

`verifier`, full run, local macOS / Node 24.15:

| Gate            | Result                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------- |
| lint            | ✅                                                                                             |
| unit tests      | ✅ 163 files · **571 passed** + 1 skipped (was 560)                                            |
| build (local)   | ✅                                                                                             |
| build (prod)    | ✅                                                                                             |
| storybook build | ✅                                                                                             |
| format check    | ✅ (red on the first run: `aria-input.html` not prettier-formatted; fixed)                     |
| bundle report   | ✅ with a **+9.8 KB (+11.0%) initial-gzip warning**, explained below                           |
| ssr smoke       | ✅ all 4 routes. The Phase 9 stale-baseline red is gone, so the baseline has been re-recorded. |

`reviewer`: **PASS, zero violations.**

**Browser check** (`ng serve`, `/auth/login` consent checkbox, real key events):

- Tab focus shows the ring. A real Space press toggles exactly once: the event log shows `keydown`/`keyup` and no synthetic `click`.
- Enter does not toggle.
- A label click toggles, and the mailto link inside the label is intact.
- Blur sets touched.

The radio has no live consumer, so it is covered by the spec and the story only.

### Bundle: the +9.8 KB is a measurement artefact, not a regression (proven)

I attributed it with a clean `git worktree` build of `HEAD` and three bisect variants, all measured with the same
script:

| Build                        | report "initial" gz |
| ---------------------------- | ------------------- |
| `HEAD`                       | 89.4 KB             |
| + autocomplete deletion only | 89.3 KB             |
| + checkbox only              | 99.0 KB             |
| full change                  | 99.0 KB             |

What moved was the **`modulepreload` list, not the loaded bytes.**

- `main` statically imports **46 chunks** in both builds. That closure measures **1578.5 KB raw / 565.2 KB gzip, identical to the 0.1 KB** in `HEAD` and in this change.
- Angular emits `modulepreload` links for only **10** of those chunks. `bundle-report.mjs` counts "initial" as the chunks linked from `index.csr.html`, so it measures those 10.
- Adding `ngpCheckbox` changed esbuild's chunk partition. The signal-forms chunk (`@angular/forms/signals`, already a static import of `main` at `HEAD` through the eager `profile-completion-dialog`) took a preload slot from a 2 KB chunk.
- Nothing new loads at startup.

⚠️ **This is a harness finding for you, not something I changed.** The report's "initial" figure is ~89–99 KB,
but the real eager closure is **~565 KB gzip**. The figure can swing ±10 KB on any change that reshuffles chunks.
Phase 9's "−13 KB" may be the same artefact. `scripts/refactor/` is yours; the fix would be to walk `main`'s static
imports instead of reading the preload links.

## 3. Decisions needed / skipped / suspicious

### 3.1 Bug found and fixed in my own change: `ngpFormControl` wipes hand-bound aria

`ngpCheckbox` and `ngpRadioGroup` both run `ngpFormControl`. That code writes `aria-labelledby` and `aria-describedby`
through effects that run **after** the template's first binding pass, and with no `ngpFormField` those values are
`null`. So the first draft rendered the radio group with **no accessible name**, and a checkbox with a hint started
with no `aria-describedby`. The new spec caught it.

The fix: those attributes now come from registered `ngpLabel` / `ngpDescription` elements, so the primitive is their
only owner. `aria-invalid` is shared with the primitive. It is now `invalid && touched`, the primitive's own rule,
so both writers always agree.

- ⚠️ **This is an intentional behaviour change:** a checkbox or radio that is invalid but untouched no longer carries `aria-invalid`. It now appears together with the visible error message, which also requires `touched`. Native input types are unchanged.

### 3.2 Suspected, not fixed (PROMPT.md §7: log bugs, don't fix)

- **`aria-select`, `aria-autocomplete` and `app-select` probably have the same latent clobber.** `ng-primitives/select` and `ng-primitives/combobox` also run `ngpFormControl`, and `aria-select.html` hand-binds `[attr.aria-labelledby]` / `[attr.aria-describedby]` on the `ngpSelect` element. This follows from the same mechanism but **is not verified**; no test covers it. If it is real, those selects have no accessible name on first render. The fix is the same `ngpFormField` pattern. It belongs in a follow-up fix branch, not a refactor phase.
- **`aria-multiselect` chip remove** is a `<span role="button" tabindex="0">`. It is probably deliberate, because a `<button>` can't nest inside the select trigger. It stays.
- **`app-select` overlaps `aria-select` and `aria-multiselect`.** It has one consumer, `features/auth/pages/profile`. Folding it in changes a call site, which §4.3's stable-API rule rules out here.
- **`aria-input.css` is a 0-byte file** that still has a `styleUrl`. It is Phase 12's to delete.
- **Radio focus selects.** `ngpRadioItem` selects on `focus`, so tabbing into a group with no value selects its first option. Native radios don't do that. There are no live radio consumers today; it is worth knowing before the `select-cpe-mode` / `ai-lab-agent-dialog` radios migrate.

### 3.3 Kept

- No `@Injectable` was touched.
- No CSS file was kept or added.
- The pre-existing `eslint-disable-next-line` on the `class` alias in `aria-input.ts` is untouched.
- No heavy-library service is involved.

## 4. Visual QA list

Check at 375 / 768 / 1440:

- **Every `app-aria-input type="checkbox"`**, which is now a `<button>` box: the login consent checkbox, `faculty`, `firm-sponsorship-dialog`, `enquiry-form`, `webinar-registration-form`, `ai-lab-terms-dialog`, and the admin forms (`user-form`, `firm-form-dialog`, `create-partner-*`, `network-form-dialog`, `roles-permissions`, `admin-users`, `edit-admin-roles-dialog`, `allocation-picker`).
  - Unchecked, checked and disabled states should match the old look.
  - The check icon is now centred by flex instead of absolute positioning.
- **Storybook → UI/Aria/Input → Radio / RadioSelected**: the dot indicator, the disabled option, and the focus ring.

## 5. Commit message

```
refactor(shared): migrate aria-input radio/checkbox to ng-primitives, retire dead autocomplete

- aria-input checkbox -> ngpCheckbox, radio -> ngpRadioGroup/Item/Indicator;
  aria-labelledby/describedby via ngpFormField/ngpLabel/ngpDescription because
  ngpFormControl overwrites hand-bound values after first render
- aria-invalid on checkbox/radio now requires touched, matching ng-primitives
- delete shared/ui/autocomplete (0 consumers; replaced by aria-autocomplete)
- aria-input spec 1 -> 13 tests; CheckboxChecked and RadioSelected stories
- public API unchanged; no call sites touched
```
