# Phase 11 — `features/partners`

## 1. Summary

3 files changed, no new files, no moves.

- **`corporate`, `illinois`, `bkn` → `CalendlyDialog` lazy-loads** (§4.4), the same pattern as the `layout` row:
  - `openScheduler()` is now async and `await import()`s the dialog.
  - `CalendlyDialogData` is `import type`.
  - All four template callers are fire-and-forget `(clicked)` bindings.
- **Survey:**
  - No heavy library and no services in the feature.
  - The page-local `<app-offerings>` on 7 pages is `shared/components/offerings`. Its `laptop` and
    `floating-assets` children are CSS-only (checked in the `shared/components` row), so nothing heavy.
  - No marquee, testimonials, player or app-download sections.

## 2. Verification

`verifier`, full `verify.mjs`, first run:

| Gate            | Result                                                         |
| --------------- | -------------------------------------------------------------- |
| lint            | pass                                                           |
| unit tests      | pass: 190 files / 698 passed + 1 skipped                       |
| build (local)   | pass                                                           |
| build (prod)    | pass                                                           |
| storybook build | pass                                                           |
| format check    | pass                                                           |
| bundle report   | pass                                                           |
| ssr smoke       | pass: 4 of 4 routes, incl. `/us/accounting/partners/cpacanada` |

The baseline dir was clean after the run.

**Bundle:**

- Initial is unchanged: 88.0 KB gz (−1.3% vs baseline). "Initial total" is 243.36 kB (was 243.39).
- `app-calendly-dialog` is in 0 of the three page chunks; it lives in its own lazy chunk (`chunk-ZY7RCULJ`).

## 3. Decisions needed / skipped / suspicious

- **Open §4.4 violation, pre-existing, logged by your decision: `partnership-content`'s two `@defer` blocks have
  unsized placeholders** (`<div></div>`). The sized grey skeletons sit commented out beside them. The `reviewer`
  returned **FAIL on this point only**; the Calendly diff itself passed.
  - The component is used on 10 partner pages.
  - Your choice was "measure and size", with a plain box at the measured carousel height. It could not be done
    here: UAT's `v2/library/` fails, so every carousel renders empty (a 110 px heading, 0 cards) and there is
    no real height to measure.
  - **To close it:** on staging or prod data, measure each `app-partnership-content app-carousel` height at 375,
    768 and 1440 px, per section type (TRACKS even/odd, MASTERCLASS, PODCAST, MICRO-LEARNING). Then replace each
    `<div></div>` with a box of that height, the way home's app-download placeholder was done.
- No `@Injectable`, no CSS files, no heavy-library service left eager.

## 4. Visual QA list

- `/…/cpe-for-corporate`, `/…/illinois-society-of-cpas` and the bkn page: "Schedule a demo" / "Book a call" opens
  Calendly.

## 5. Commit message

```
perf(partners): lazy-load the Calendly dialog on the corporate, illinois and bkn pages

openScheduler() loads CalendlyDialog with import() when clicked; only the
dialog's data type stays static. The dialog leaves all three page chunks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
