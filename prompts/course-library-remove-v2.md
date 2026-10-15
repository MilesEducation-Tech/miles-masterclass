# Remove the v2 bindings from the course library page (MIL-83)

First of two subtasks under Story MIL-82 (`Bind the course library page to the web filter API`), on
`feat/MIL-82-course-library-binding`. MIL-84 then binds the filters and the course list to
`GET web-api/v1/masterclass/filter/`. Both land in one PR, as MIL-66 and MIL-67 did.

## Assumptions

1. **This commit is a step, not a release.** On its own it leaves the page with its tabs and the empty state, which is
   what learners see on UAT today, because both reads 404. It doesn't merge without MIL-84, since both are in one PR.
2. **Only the course library page changes.** The instructor and badge libraries, and the home carousels' filter
   dialog, also call retired routes, but each has its own ticket.
3. **The shared model `core/models/library-filters.model.ts` stays as it is.** The carousel filter dialog
   (`SectionFiltersFacade`, `FeatureFacade`, `carousel`, `filter-dialog`) still imports `LibraryFiltersData`,
   `CourseFilterSelection`, `EMPTY_COURSE_FILTERS` and `ApiCourseType` from it. MIL-84 decides which library-only
   types move into the feature.

## Goal

The course library page makes no request to a retired route and holds no state shaped by the v2 responses. That
leaves MIL-84 a clean page to bind, rather than a rewrite that's half removal and half binding.

## What I read

- **`course/services/course-facade.ts`**, a root `@Service()`:
  - `libraryFiltersResource`: `GET v2/library-filters/`, which feeds `libraryFilters` and `isLibraryFiltersLoading`.
  - `rawCourseResource`: `GET v2/library/` with `course_type`, `page` and the selection as comma-joined params. It
    feeds `courseItems` (a page accumulator), `coursePagination`, `isCourseLoading` and `courseError`.
  - State: `courseType` (the tab), `courseFilters` (keyed by the v2 param names `instructor_ids`, `category_ids`,
    `caira_levels`, `cpe_range`…), `coursePage`, plus an effect that resets the page on a tab or filter change.
- **`course/pages/course/course.ts|html`**:
  - `groups` maps the v2 `LibraryFiltersData` into sidebar groups; `activeFilterCount` counts the selection.
  - The infinite-scroll `IntersectionObserver` calls `loadNextCoursePage`.
  - `openMobileFilters` opens `CourseFiltersDrawer` with the groups and selection.
  - The template has the sidebar, the tabs, the mobile Filter button, the card grid (`app-vertical`), "Loading…", and
    the scroll sentinel.
- **`course-filters` and `course-filters-drawer`**: presentational, inputs and outputs only, with no HTTP.
- **Other callers:** `CourseFacade` is used only by this page; `uae-caira-facade` mentions it in a comment only.
  `withPreviousValue` and `parseNextPage` have many other callers, so nothing shared becomes unused.

## Endpoint map: probed on UAT today, signed out

| Call made from this page today                   | Via                      | UAT                   | After |
| ------------------------------------------------ | ------------------------ | --------------------- | ----- |
| `GET v2/library-filters/`                        | `libraryFiltersResource` | route gone (404 HTML) | none  |
| `GET v2/library/?course_type=masterclass&page=1` | `rawCourseResource`      | route gone (404 HTML) | none  |

Production (`api.milesmasterclass.com/api/v2/…`) still answers both, which is why
`milesmasterclass.com/in/accounting/library/course-library` works. That page is the visual reference for MIL-84.

## Locked decisions

1. **The facade keeps only the tab state:** `courseType` and `selectCourseType()`. These go:
   - both `httpResource`s;
   - everything they feed: `libraryFilters`, `isLibraryFiltersLoading`, `courseItems`, `coursePagination`,
     `isCourseLoading`, `courseError`;
   - the paging: `coursePage`, the reset effect and `loadNextCoursePage()`;
   - the selection: `courseFilters`, `setCourseFilters()` and `clearCourseFilters()`, because its keys are the v2 param
     names. MIL-84 brings the selection back with the new names (`instructor`, `level`, `cpe_credit`…).
2. **The page keeps its frame:** the two-column layout, the tabs, and the "No courses found." empty state. These go:
   - the `groups` mapping and `activeFilterCount`;
   - the sidebar's filter list and "Loading filters…";
   - the mobile Filter button and `openMobileFilters()`;
   - the infinite-scroll observer, the card loop, "Loading…" and the sentinel.

   The scroll-into-view on a tab change stays.

3. **`course-filters` and `course-filters-drawer` stay unchanged.** The page stops rendering them for this one commit,
   and MIL-84 renders them again with the new groups. Deleting and re-adding them would only churn the PR.
4. **No placeholder copy or "coming soon" state.** The intermediate state never ships.

## Files touched

| File                                                        | Change                                          |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `src/app/features/library/course/services/course-facade.ts` | reduced to the tab state (~120 → ~20 lines)     |
| `src/app/features/library/course/pages/course/course.ts`    | reduced to the tabs and the scroll (~165 → ~50) |
| `src/app/features/library/course/pages/course/course.html`  | frame, tabs and empty state (~65 → ~25)         |
| `docs/refactor/STATE.md`                                    | a "Now" entry for MIL-82/83                     |

About 250 lines removed and 15 added. No new files.

## Security

Nothing changes on access. The route is public, the page reads nothing, and no request is added.

## Acceptance criteria

1. `/us/accounting/library/course-library` shows the back link, the empty sidebar column, the three tabs and
   "No courses found.", with no console error.
2. The network panel shows **no** request to `v2/library-filters/` or `v2/library/`. Today it shows both, as 404s.
3. Switching tabs changes the selected tab and still makes no request.
4. The instructor and badge libraries and the home page carousels are unchanged: same code, same requests.
5. Nothing shared becomes unused. `course-filters` and `course-filters-drawer` are unused only until MIL-84.

## Checks

- `pnpm lint` (0 errors), `pnpm format`, `pnpm check:structure`, `tsc -p tsconfig.app.json`.
- `CI=true pnpm build:prod`, which leaves a running dev server's Vite cache alone.

## How to verify

1. **Before:** on 4101, open `/us/accounting/library/course-library`. The network panel shows `v2/library-filters/` and
   `v2/library/?course_type=masterclass&page=1`, both 404, and the sidebar is empty.
2. **After:** the same URL shows the frame, the tabs and the empty state, and the network panel shows neither request.
3. **Tabs:** clicking Podcast, then Micro Learning, moves the selection and fires nothing.
4. **Siblings:** `/us/accounting/library/instructor-library` and `/badge-library` make the same requests as before.

Checked headless (Playwright) on the dev server. The page is public, so it needs no cookie.

## Risks

- **The branch has a dead page between the two commits.** That's harmless because they ship together, but don't open
  the PR after MIL-83 alone.
- **`docs/refactor/STATE.md` will conflict with the MIL-65 PR.** Both add a "Now" entry at the top. Whichever merges
  second keeps both entries.

## Commit (MIL-83)

- **Summary:** `refactor(library): drop the retired v2 bindings from the course library page`
- **Description:** names MIL-83, lists the two removed calls, and notes that the page shows its tabs and empty state
  until MIL-84.
