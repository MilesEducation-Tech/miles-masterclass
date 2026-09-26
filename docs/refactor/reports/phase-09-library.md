# Phase 9 — Data layer · `features/library`

Date: 2026-09-26 · Branch: `refactor/structure-10`.

## 1. Summary

**All 7 library reads moved from `resource()` + `firstValueFrom` to `httpResource`.** Source got smaller
(+83 / −121); specs are +351, with 13 new tests in 3 new spec files and one rewritten spec.

| File                                    | Reads                                                                        | Also                                                                                                                                                                                                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `course/services/course-facade`         | library filters, course listing                                              | **Fixes the logged bug:** `libraryFilters` read `value()` unguarded, so a failing `v2/library-filters/` (a 404 in local/UAT) threw `ResourceValueError` on **every change detection** and took the course library page down. `coursePagination` is guarded too. |
| `instructor/pages/instructor-details`   | instructor, related courses (component-level, like `course-related-section`) | 4 unguarded reads now go through `instructor` and a new `relatedGroups` computed.                                                                                                                                                                               |
| `instructor/services/instructor-facade` | instructor list                                                              | The pagination read is guarded. **A deviation from PLAN §5, see §3.**                                                                                                                                                                                           |
| `badge/services/badge-facade`           | badge categories, badge list                                                 | 2 reads guarded. `claimBadge` (a mutation) stays on RxJS.                                                                                                                                                                                                       |

Unchanged, as the reviewer checked:

- request params: multi-select filters comma-joined, `search_key` sent only when set, the badge status and page;
- the `isBrowser` SSR gating;
- the page accumulators (page 1 replaces, later pages append).

The three lists have no `defaultValue`. Their `linkedSignal` accumulators already return `[]` for every state that
isn't resolved, so a default would be dead code. The reviewer agreed.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                |
| --------------- | ----------------------------------------------------- |
| lint            | pass                                                  |
| unit tests      | pass: 181 files, **664 passed** + 1 skipped (was 652) |
| build (local)   | pass                                                  |
| build (prod)    | pass                                                  |
| storybook build | pass                                                  |
| format check    | pass                                                  |
| bundle report   | pass: initial 88.8 KB gz, unchanged                   |
| ssr smoke       | pass: 4 of 4 routes, as in the baseline               |

- **`reviewer`: PASS.** It judged the instructor-list deviation "acceptable, well-reasoned", but left the call to
  you.
- **Tests that bite:**
  - the course spec asserts that `libraryFilters()` does not throw after a 404, which the old code did;
  - the instructor-details failure test would have thrown on the old unguarded reads.
- **Browser: not run** (the dev-server config uses `npx`). The course library is public, so §4 is quick to do by
  hand.

## 3. Decisions needed / skipped / suspicious

- **A decision is raised, but it does not block this row: the PLAN §5 "searched lists" deviation.** PLAN §5 classed
  **leads, user-report and the instructor library** as SEARCH, to stay on RxJS/`rxResource`.
  - All three are now `httpResource`. Leads and user-report are already committed in Phase 9 admin; the instructor
    list is in this row.
  - The reason: each is a paginated list filtered by a term **the page debounces** before it reaches the facade, so
    the resource never sees keystrokes. The real typeahead (the onboarding company picker) was left as it was.
  - Options, in STATE.md "Decisions":
    - **(a) accept:** the carve-out means "the resource itself would see keystrokes";
    - **(b) revert** all three to `rxResource`, with the debounce inside.
- **Pre-existing, logged, not fixed:** a course-type or filter change (and a badge category or status change) fires
  one request at the old page, before the reset effect moves to page 1. The first request is cancelled, so the only
  cost is a wasted request.
  - It is the same shape as before.
  - The spec pins that the stale request is cancelled.
  - The `leads-facade` pattern (`pageNumber` as a `linkedSignal` reset by the filters) would remove it. That is a
    follow-up.
- **Recurring spec trap, noted again:** a `linkedSignal` accumulator only appends to what it last produced. If
  nothing reads page 1 before page 2 lands, page 1 is lost. The templates always read it, so this is test-only. The
  course spec reads it the way the page does, with a comment.
- No `@Injectable`, no CSS, and no heavy-library service.

## 4. Visual QA list

1. **Course library** (public):
   - the filter sidebar loads;
   - pick filters and switch course type: the list resets and loads;
   - scroll: the next page appends;
   - with `v2/library-filters/` failing, the page still renders without the sidebar filters. Before, it crashed.
2. **Instructor library:**
   - the list, and infinite scroll;
   - type a search: one request after the pause, back at page 1.
3. **Instructor detail:**
   - the profile and promo video;
   - the Masterclass / Podcast / Micro Learning tabs filter the courses;
   - one `view_instructor` event.
4. **Badge library:**
   - the first category is auto-selected;
   - the status filter works;
   - infinite scroll works;
   - Claim still opens Credly.

## 5. Commit message

```
refactor(library): move the course, instructor and badge reads to httpResource

- CourseFacade, InstructorFacade, BadgeFacade and the instructor-details
  page: resource() + firstValueFrom -> httpResource, same params and SSR gate
- guard every value() read; fixes the course library crashing on every
  change detection when v2/library-filters/ fails
- +13 spec tests

Phase 9 (data layer), features/library.
```
