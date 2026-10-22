# MIL-119: load the course library from the filter-based course list API

Status: **approved and implemented (2026-10-22).** Branch `fix/MIL-119-course-library-filter-api`, off `master` (`db43a117`).

## Goal

`/library/course-library` shows "Failed to Load Courses" on every tab, with an empty sidebar. The backend moved
`course_type` off `filter/`, which the page still sends, so every read is a 400. Bring the page back on the backend's
current contract: the sidebar from `filter/`, the cards from `filter-based-masterclass-list/`. The page looks and
behaves as it did after MIL-84.

## What I read

- **The page today** (MIL-84, `prompts/course-library-binding.md`):
  - `CourseFacade` holds one `httpResource` on `filter/?course_type=…&page=…&page_size=12&<filters>`.
  - `parseCourseLibrary` reads `data.filters` (the sidebar) and `data.courses` (one page of cards) from it.
  - The sidebar groups, the grid, Load More, the tabs and the error state all hang off that one read.
- **Reproduced on the dev server and against UAT directly:**
  - `filter/?course_type=course&page=1&page_size=12` → **400**
    `{"field": "course_type", "message": "Extra inputs are not permitted"}`.
- **The local Postman export** (16 Oct) and **UAT, probed today:**
  - **`GET web-api/v1/masterclass/filter/`** (`web-masterclass-filter-v1`, `AllowAny`)
    - Takes `instructor`, `field_of_study`, `additional_category`, `level`, `cpe_credit`, `track`, `content_type`,
      `page`, `page_size`.
    - **No `course_type`** and **no `login_type`**: either one is a 400.
    - Returns `filters` (every option, not narrowed by the selection), `applied` and `courses` (a pagination block of
      the same cards as before).
  - **`GET web-api/v1/masterclass/filter-based-masterclass-list/`** (`web-masterclass-filter-based-masterclass-list-v1`,
    `AllowAny`, "ADDED 2026-10-15")
    - Requires `course_type` (comma-separated: `course`, `podcast`, `nano_learning`, `micro_learning`, `ai_lab`) and
      `login_type` (`pre_login` / `post_login`; `post_login` without a token is a 401).
    - Also takes `instructor`, `field_of_study`, `additional_category`, `level`, `cpe_credit`, `track`, `page`,
      `page_size`.
    - **No `content_type`**: a 400.
    - Returns `applied` and `courses` only, with no `filters`.
    - Postman's note: "The client builds its sidebar from `filter/` and sends the chosen ids back here."
  - **Live results:**

    | Request                                       | Courses                     |
    | --------------------------------------------- | --------------------------- |
    | `course`, `podcast`, `micro_learning`         | 64, 0, 0                    |
    | + page 2 of 12                                | 12, `has_next` true         |
    | + one instructor                              | 1                           |
    | + CAIRA Level 1                               | 22                          |
    | + a track                                     | 21                          |
    | + CPE 2–5                                     | 63                          |
    | + CPE over 5                                  | 1                           |
    | `filter/?content_type=ai_kit`                 | 5                           |
    | `filter/?content_type=ai_kit&cpe_credit=lt_2` | 0, so the filters still AND |

    Every row passes the existing `MasterclassCourse` guard.
- **The cards** show no bookmark, so the signed-out list (`pre_login`) carries everything they render, as the AI Kit
  button's `course-detail` read already assumes.

## Locked decisions

1. **Two reads, split as the backend intends.**
   - **The sidebar:** one `httpResource` on `filter/?page_size=1`, read once in the browser.
     - `page_size=1`, because only `filters` is used and the default 6 cards are dead weight.
     - The options don't depend on the tab or the selection (the API doesn't narrow them), so there is nothing to
       re-read.
   - **The cards:** the existing paged `httpResource`, now on `filter-based-masterclass-list/` with:
     - `course_type` from the tab and `login_type=pre_login`;
     - each non-empty selection group, comma-joined;
     - `page` and `page_size`.
2. **AI Kit keeps working** (the user's call when the ticket was written).
   - The new list route rejects `content_type`. When AI Kit is selected, the cards read `filter/` instead, with
     `content_type=ai_kit`, the other selected groups and paging. That route still filters by it.
   - AI Kits are masterclasses only, so the AI Kit group shows on the **Masterclasses tab only**.
   - Switching to Podcast or Micro Learning drops an AI Kit selection; the other groups carry over, as today. So the
     Filter badge never counts a hidden choice, and no request sends a parameter its route rejects.
3. **Parsing at the boundary,** in the feature's model:
   - `parseLibraryFilters` reads `data.filters`, the same group guards as today.
   - `parseCourseList` reads `data.courses`, with the same card guard. Both list routes share this block.
   - `CourseLibraryPage` splits into `LibraryFilterOptions` (unchanged) and `CourseListPage {courses, page, hasNext}`.
4. **States:**
   - **The grid:** "Loading…", "No courses found." and "Failed to Load Courses" with Try Again, all as today, on the
     cards read.
   - **The sidebar:** "Loading filters…" while its own read loads. If it fails, the sidebar says "Filters couldn't
     load." and Try Again reloads it too.
5. **Nothing else moves.** The tabs, cards, mobile drawer, Load More, `SKIP_LOADING` on later pages, the scroll on
   change, and the AI Kit / "i" / trailer buttons are untouched.

## Endpoint map

| Call                                                                                                                 | Before        | After                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| `GET web-api/v1/masterclass/filter/?page_size=1`                                                                     | —             | **new**: the sidebar options, once                          |
| `GET web-api/v1/masterclass/filter-based-masterclass-list/?course_type=…&login_type=pre_login&page=…&page_size=12&…` | —             | **new**: the cards                                          |
| `GET web-api/v1/masterclass/filter/?content_type=ai_kit&page=…&page_size=12&…`                                       | —             | **new**: the cards while AI Kit is selected (Masterclasses) |
| `GET web-api/v1/masterclass/filter/?course_type=…`                                                                   | the one read  | **gone** (400 since the contract change)                    |
| `GET web-api/v1/masterclass/course-detail/{id}/?login_type=pre_login`                                                | AI Kit button | unchanged                                                   |

## Files touched (~120–160 lines)

| File                                                     | Change                                                                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/library/course/constants/course-library.ts`    | `COURSE_LIBRARY_URL` → `COURSE_LIBRARY_FILTERS_URL`, plus `COURSE_LIBRARY_LIST_URL`; comments to the new contract                                                        |
| `features/library/course/models/course-library.model.ts` | `CourseListPage`; `parseCourseLibrary` → `parseLibraryFilters` + `parseCourseList`; header comment                                                                       |
| `features/library/course/services/course-facade.ts`      | the sidebar read; the list read's URL and params; AI Kit group on Masterclasses only; tab switch drops AI Kit; `filtersLoading` / `filtersError`; `reload()` covers both |
| `features/library/course/pages/course/course.html`       | the sidebar's loading and error lines read the sidebar's own state                                                                                                       |
| `docs/refactor/STATE.md`                                 | entry                                                                                                                                                                    |

Not touched: the filter components, the drawer, the card, the tabs, `core/` and `shared/`.

## Security

Both routes are `AllowAny`, and the page sends no token-dependent parameter (`login_type=pre_login`). Every selection
value sent is an id or value the API itself listed in `filters`. No auth change.

## Acceptance criteria

1. **Masterclasses:**
   - The sidebar shows Instructor, Field of Study, CAIRA Level, CPE Credits, Track and AI Kit (Additional Category
     stays hidden while UAT has none).
   - The grid shows 12 courses, and scrolling loads the rest of the 64.
2. **Filters:**
   - One instructor gives 1, CAIRA Level 1 gives 22, a track 21, CPE 2–5 63, and AI Kit 5.
   - AI Kit plus CPE under 2 gives "No courses found."
   - Clear All restores 64, and each change goes back to page 1.
3. **Tabs:**
   - Podcast and Micro Learning load with no error, show "No courses found." on UAT, and have no AI Kit group.
   - Switching to them with AI Kit selected drops it, and the badge count follows.
   - Masterclasses brings the courses back.
4. **Requests:**
   - No 400s.
   - `filter/` is read once for the sidebar, and again only for an AI Kit selection.
   - No request carries `course_type` to `filter/`, or `content_type` to the list route.
5. **Errors:**
   - A failed card read shows "Failed to Load Courses", and Try Again recovers.
   - A failed sidebar read shows "Filters couldn't load." while the cards still render.
6. **Mobile (375):** the Filter drawer has the same groups and the badge counts the selection. There's no
   sideways scrolling, and the layout is unchanged at 768 and 1440.
7. **Gates:** `pnpm lint` 0 errors, the structure check, Prettier and `pnpm build:prod`.

## How to verify

1. **Dev server (4101), Playwright, signed out and signed in:**
   - Record every `masterclass/filter*` request with its params and status.
   - Walk criteria 1–4: scroll to the end; apply single and combined filters, AI Kit, and Clear All; switch tabs with
     and without AI Kit.
2. **Errors:** stub a 500 on each read in the browser only, then use Try Again.
3. **Mobile drawer at 375,** plus screenshots at 375 / 768 / 1440.

## Risks

- **AI Kit rides on `filter/`'s own course list,** which has no `course_type`. That holds today because AI Kits are
  masterclasses only. If the backend adds `content_type` to the list route, the switch collapses to one route.
  Worth asking for, but not blocking.
- **Podcast and Micro Learning cards are still unseen,** since UAT has none (as in MIL-84).
- **The contract has already moved once.** The guards fail loudly into the error state rather than half-rendering
  if it moves again.
