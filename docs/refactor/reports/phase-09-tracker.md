# Phase 9 — Data layer · `features/tracker` (caira + cpe)

Date: 2026-09-26 · Branch: `refactor/structure-10`.

## 1. Summary

**8 reads moved from `resource()` + `firstValueFrom` to `httpResource`. 8 unguarded `value()` reads are fixed.**
Source got smaller (+103 / −135); specs are +234, with 8 new tests in 3 new spec files.

| Where                                               | Reads                                                             | Unguarded reads fixed                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| caira `components/badge-row`                        | webinar badges or course badges (the URL branches by course type) | `items`. Its own comment promised "a failed fetch counts as no data", but it threw. |
| caira `components/caira-level-hero`                 | the CAIRA ladder                                                  | `ladder`                                                                            |
| caira `dialogs/caira-badge-info-dialog`             | badge detail (keeps `SKIP_ERROR_NOTIFICATION`)                    | none; it was already guarded                                                        |
| caira `pages/course-badges`, `pages/webinar-badges` | the paginated badge lists                                         | `totalCount` and next-page                                                          |
| cpe `pages/cpe-tracker`                             | the year summary, the credit list                                 | summary, rows and total                                                             |

**The pattern behind the bug:** the badge pages and the CPE table each render their **own error state**
(`hasError`/`hasListError`). A sibling `computed` read `value()` unguarded, though, so a failed load threw before
that state could render. Every such read now goes through one guarded computed per resource.

Unchanged, as the reviewer checked against `HEAD`:

- URLs, params (`page_count=15`, `ledger`, `year`, `course_type`) and contexts;
- the `isBrowser` SSR gates and the `defaultValue`s;
- the page accumulators;
- the rule that **flipping the CAIRA/Others ledger does not refetch the summary**, which a new spec now pins.

**Unchanged, on purpose:**

- `cpe/services/certificate-download`: blob downloads and the bulk-certificate POST;
- `caira/services/badge-actions`: the claim mutation;
- the compliance-dialog `subscribe` in `cpe-tracker`.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green on the second run.**

The first run's **format check was red**, on `caira-badge-info-dialog.ts`. I had deleted an unused import line after
Prettier had run, which left the import block unformatted. I ran `prettier --write` and then the full verify again;
it is green.

| Gate            | Result                                                |
| --------------- | ----------------------------------------------------- |
| lint            | pass                                                  |
| unit tests      | pass: 184 files, **672 passed** + 1 skipped (was 664) |
| build (local)   | pass                                                  |
| build (prod)    | pass                                                  |
| storybook build | pass                                                  |
| format check    | pass (red on the first run, fixed)                    |
| bundle report   | pass: initial 88.8 KB gz, unchanged                   |
| ssr smoke       | pass: 4 of 4 routes                                   |

- **`reviewer`: PASS, zero violations.**
- **Spec notes:**
  - The `webinar-badges` spec stubs `IntersectionObserver`, which jsdom lacks, and undoes it with
    `vi.unstubAllGlobals()` after each test, so the stub cannot leak into another file.
  - The `cpe-tracker` spec blanks the template to test only the reads.
- **Browser: not run.** The tracker is signed-in, and the dev-server config uses `npx`.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- `cpe-tracker`'s summary used a fake `defaultValue` (`undefined as unknown as …`). It is dropped; the guarded
  `summary` computed covers the idle and error states.
- No `@Injectable`, no CSS, and no heavy-library service. The jszip download path is Phase 11's `injectAsync` work,
  not this phase's.

## 4. Visual QA list (signed in)

1. **CAIRA tracker home:**
   - the level hero and its chevrons;
   - the four badge rows;
   - a row with no badges disappears;
   - with the network throttled to failure, rows hide instead of the page breaking.
2. **Course badges / webinar badges:**
   - infinite scroll works;
   - the filters work;
   - the course-type switch resets to page 1;
   - a failed load shows the page's error and Retry.
3. **Badge info dialog:** the description and criteria tabs.
4. **CPE tracker:**
   - the year and ledger switches work;
   - the ledger switch does not reload the totals;
   - pagination works;
   - a failed load shows the table's error.

## 5. Commit message

```
refactor(tracker): move the CAIRA and CPE tracker reads to httpResource

- badge-row, caira-level-hero, caira-badge-info-dialog, course-badges,
  webinar-badges and cpe-tracker: resource() + firstValueFrom ->
  httpResource, same URLs, params, contexts and SSR gates
- guard 8 value() reads that threw on a failed load, so the pages' own
  error states can render
- +8 spec tests

Phase 9 (data layer), features/tracker.
```
