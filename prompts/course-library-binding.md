# Bind the course library filters and course list to the web filter API (MIL-84)

Second of two subtasks under Story MIL-82 (`Bind the course library page to the web filter API`), on
`feat/MIL-82-course-library-binding`, after MIL-83 (`77968679`, the v2 bindings removed). Same PR.

## Assumptions

1. **Tabs, as the user set them:**

   | Tab            | `course_type`    |
   | -------------- | ---------------- |
   | Masterclasses  | `course`         |
   | Podcast        | `podcast`        |
   | Micro Learning | `micro_learning` |

   There's no Nano Learning tab, even though the API accepts `nano_learning`. The labels follow production.

2. **The Category filter goes.** The API has no category options, and it answers `category=` with
   `400 "Extra inputs are not permitted"`. Every other production group has a counterpart.
3. **Every card links to the masterclass course page** (`/masterclass/<id>/<slug>`), which is what the shared web card
   does. The backend treats podcasts and reels as courses, but UAT has none yet (`course_type=podcast` or
   `micro_learning` answers `count: 0`), so the podcast and micro-learning links can't be tried until it does.
4. **No bookmark on the cards yet.** The shared web card has none. `POST web-api/v1/masterclass/bookmark/{id}/` exists,
   but it's its own ticket, and production's bookmark icon isn't matched in this PR.

## Goal

The course library page shows UAT's filter options and courses, each filter and tab narrows the grid, and scrolling
loads more, as production does, from one route: `GET web-api/v1/masterclass/filter/`.

## What I read

- **Postman, `web-masterclass-filter-v1`** (2026-10-12 export), checked live on UAT today:
  - **Params:** `course_type` required, comma-separated. Optional, comma-separated, OR within a param and AND across
    params: `instructor`, `field_of_study`, `additional_category`, `level`, `cpe_credit` (`lt_2` / `2_to_5` / `gt_5`),
    `track` and `content_type`. Paging is `page` and `page_size` (default 6, ceiling 100). Any undeclared param is a 400.
  - **`data.filters`:** every option, not narrowed by the selection.
    - `instructors {id, name, designation, square_image_url}` (43)
    - `fields_of_study {id, name, cpe_credit}` (10)
    - `additional_categories` (0 on UAT)
    - `levels {id, name, number, subject}` (3)
    - `cpe_credit {value, label}` (3)
    - `tracks {id, slug, name}` (3)
    - `content_types {value, label, children}` (4, including `ai_kit`)
  - **`data.applied`:** the selection, normalised.
  - **`data.courses`:** a pagination block (`count`, `page`, `has_next`…) of home-page course cards. All 64 live cards
    pass the existing `MasterclassCourse` guard.
  - **Live results:** instructor → 1, CPE under 2 → 11, track → 21, AI Kit → 5, and two params AND-ed → 10. Page 2
    works with `page` or `courses.page`.
- **The page after MIL-83:** tabs and the empty state only. `CourseFacade` holds `courseType`. `course-filters` and
  `course-filters-drawer` are presentational, typed on the core model's `CourseFilterGroup` / `CourseFilterSelection`,
  whose keys are the v2 param names.
- **`shared/components/cards/masterclass-course-card`:** renders `MasterclassCourse` (core
  `masterclass-home.model.ts`) in the vertical design. It's a plain link, with trailer and info as outputs; the home
  and masterclass pages use it. Its guard `isCourse` is module-private.
- **`shared/ui/tabs`:** underline style only. Production's pill tabs came from `shared/ui/tab-strip`
  (`rounded-full` track, `bg-primary` active pill), which the shared-UI rebuild (#44) replaced.
- **`shared/ui/error-state`:** title, message and a retry output; the payment pages use it.

## Locked decisions

1. **One read.** `CourseFacade` holds one `httpResource` on `filter/` with:
   - `course_type` from the tab;
   - each non-empty selection group, comma-joined;
   - `page` and `page_size`. `COURSE_LIBRARY_PAGE_SIZE = 12` fills 2, 3 and 4 columns evenly.

   The response is parsed at the boundary by `parseCourseLibrary` (types and guards in the feature's model). A
   renamed or retyped key lands in `error()`, not half-rendered on screen.

2. **Cards reuse `MasterclassCourse`.** `core/models/masterclass-home.model.ts` exports its existing card guard as
   `isMasterclassCourse`. That's a one-word export with no behaviour change, so the library's parser checks cards
   exactly as the home page does.
3. **Facade state:** `courseType` (the tab), `selection` (keyed by the new param names, with string UUID values) and
   `page`.
   - A tab or selection change goes back to page 1 and clears the list.
   - The selection is kept across tabs, as it was before MIL-83.
4. **Filter groups are built in the facade,** in production's order, with the labels in constants:

   | Group               | Options from                               | Param                 |
   | ------------------- | ------------------------------------------ | --------------------- |
   | Instructor          | `instructors`                              | `instructor`          |
   | Field of Study      | `fields_of_study`                          | `field_of_study`      |
   | Additional Category | `additional_categories`                    | `additional_category` |
   | CAIRA Level         | `levels`                                   | `level`               |
   | CPE Credits         | `cpe_credit`                               | `cpe_credit`          |
   | Track               | `tracks`                                   | `track`               |
   | AI Kit              | the `ai_kit` entry of `content_types` only | `content_type`        |
   - Option labels come from the API.
   - A group with no options is hidden, which is Additional Category on UAT today.
   - The other content types are left out, because the tabs already cover them, and `masterclass_course` matches all
     64 courses anyway.
   - The groups come from the latest answer and are kept while the next one loads, since they don't depend on the
     selection.

5. **The list:**
   - Pages accumulate, and the next one loads when the sentinel scrolls into view and `has_next` is true.
   - Page 1 drives the global loading bar. Later pages use `SKIP_LOADING`, because the grid shows its own "Loading…"
     at the bottom.
6. **States:**
   - First load: "Loading filters…" in the sidebar and "Loading…" under the grid.
   - Error: `app-error-state` ("Failed to Load Courses"), whose retry reloads the read.
   - Nothing matches: "No courses found."
7. **Pill tabs.** Shared `app-tabs` gains `variant: 'line' | 'pill'`, a class map merged with `cn()`.
   - `line` is the default and is unchanged for every current caller: login, badge, instructor-details and the admin
     pages.
   - `pill` is the old tab-strip look.
   - The course library uses `pill`, left-aligned with the grid as on production, with the mobile Filter button
     beside it. _Revised after the user compared it with production:_ it was centred at first.
   - A `Pill` story is added.
8. **Cards:** `app-masterclass-course-card` in the vertical layout. Its trailer opens `Utils.openVideoDialog`. There's
   no "i" button, because its dialog lives in `features/offerings`, which a feature can't import.
9. **The filter components are retyped** to the library model (`LibraryFilterGroup` and `LibraryFilterSelection`, with
   string values). _Revised after the user compared it with production:_ the options are production's checkbox rows
   in a 288px scroll area (`ngpListbox` used directly, as the accordion already is), not the shared `app-listbox`,
   which is a bordered popover-style box the admin forms use.
10. **Dead code goes from the core model.** `COURSE_TYPE_TABS`, `CourseTypeTab` and `CourseFilterGroup` were the
    library's alone. Everything the carousel uses stays.

## Endpoint map

| Call                                                                     | In this subtask |
| ------------------------------------------------------------------------ | --------------- |
| `GET web-api/v1/masterclass/filter/?course_type=…&page=…&page_size=12&…` | **new**         |
| `v2/library-filters/`, `v2/library/`                                     | gone (MIL-83)   |
| `POST web-api/v1/masterclass/bookmark/{id}/`                             | own ticket      |

## Files touched

| File                                                                                        | Change                                          |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `src/app/features/library/course/models/course-library.model.ts`                            | **new**: types, guards, `parseCourseLibrary`    |
| `src/app/features/library/course/constants/course-library.ts`                               | **new**: tabs, group labels, page size, route   |
| `src/app/features/library/course/services/course-facade.ts`                                 | the read, the state, the groups and the paging  |
| `src/app/features/library/course/pages/course/course.ts\|html`                              | sidebar, pill tabs, Filter button, grid, states |
| `src/app/features/library/course/components/course-filters/course-filters.ts`               | retyped                                         |
| `src/app/features/library/course/components/course-filters-drawer/course-filters-drawer.ts` | retyped                                         |
| `src/app/shared/ui/tabs/tabs.ts`, `tabs.stories.ts`                                         | `variant` input and a `Pill` story              |
| `src/app/core/models/masterclass-home.model.ts`                                             | export the card guard                           |
| `src/app/core/models/library-filters.model.ts`                                              | drop the three library-only exports             |
| `docs/refactor/STATE.md`                                                                    | entry                                           |

About 350–400 changed lines. With MIL-83 (−258 / +9), the PR's net change is small.

## Security

The route is public (`AllowAny`). A signed-in token only adds bookmark state, which isn't read here. No auth changes.
Every selection value sent is an id or value the API itself listed.

## Acceptance criteria

1. **Masterclasses:** the sidebar shows Instructor, Field of Study, CAIRA Level, CPE Credits, Track and AI Kit with
   UAT's options. The grid shows 12 courses, and scrolling loads the rest of the 64.
2. **Filtering:**
   - Each group narrows the grid; for example, one instructor gives 1 course and AI Kit gives 5.
   - Two groups combine.
   - "Clear all" restores the full list.
   - Each change goes back to page 1.
3. **Tabs:**
   - Podcast and Micro Learning send `course_type=podcast` and `micro_learning`, and show "No courses found." on UAT.
   - Masterclasses brings the courses back.
   - The tabs are pills, as in production.
4. **Requests:** every request has exactly the declared params. There's no 400, and no request to `v2/`.
5. **Mobile (375):**
   - the Filter button opens the drawer with the same groups;
   - its badge counts the selection;
   - "Done" closes it;
   - there's no horizontal scroll.
6. **Errors:** a failed read shows the error state, and "Try Again" recovers.
7. **Parity:** the layout matches production at 375, 768 and 1440 px, apart from the intentional differences listed in
   the report (no Category, no bookmark, no info button).
8. **Other tab callers** (login, badge library, instructor details, admin) look unchanged.
9. **Gates:** `pnpm lint` 0 errors, the structure check, Prettier, and `CI=true pnpm build:prod` green.

## How to verify

1. **Headless (Playwright) on 4101, signed out:** record every `filter/` request and its params.
   - Load the page, scroll to the end, apply single and combined filters, clear them, and switch the tabs.
   - Then fake a 500 and use "Try Again".
2. **Visual:** compare with `milesmasterclass.com/in/accounting/library/course-library` at 375, 768 and 1440.
3. **Regression:** the login page and badge library tabs are unchanged.

## Risks

- **Podcast and micro-learning cards are untested** (assumption 3), because UAT has none.
- **The bookmark icon is missing** compared with production (assumption 4).
- **The shared `app-tabs` change touches every caller.** The default stays `line`, so nothing else should change;
  criterion 8 checks it.
- **`docs/refactor/STATE.md`** will conflict with the MIL-65 PR, as noted in MIL-83.

## Commit (MIL-84)

- **Summary:** `feat(library): bind the course library filters and courses to the web filter API`
- **Description:** names MIL-84, the route, the tab mapping, the filter groups, the pill tabs and the dropped Category
  filter.

## Revision 2026-10-14: the "i" and AI Kit buttons (the user compared the cards with production)

Production's card hover has a round play button, an "AI Kit" button on courses that have one, and an "i" button. The
library card has only "Trailer". Both were left out of the first pass: "i" because its dialog lives in
`features/offerings`, AI Kit because its route was gone.

### What I found

- **"i":** the home page already opens the course-info dialog without importing `features/offerings`, through the
  core token `MASTERCLASS_COURSE_INFO_DIALOG` that `app.config.ts` binds. The card has `showInfo` / `info` for it.
- **AI Kit flag:** every web card carries `has_additional_resources {has_exercise_files, has_ai_kit, has_ai_labs,
has_tools}`. Checked live on `filter/`, `highlight/`, `ai-labs/` and `tracks-page/`; the five AI Kit courses have
  `has_ai_kit: true`.
- **AI Kit content:** the legacy button read `v2/dashboard/:id/additional-resources/` (now a 404) and opened the
  "Additional Resources" links dialog. The same items now sit in
  `course-detail/{id}/?login_type=pre_login` → `data.course_details.miscellaneous_data`:
  - `ai_kit {id, name, description, icon_url, url}`, or `null`; the url is a PDF;
  - `exercise_files [{name, url, order}]`, or `null`;
  - `tools [{id, name, icon_url}]`, which has no link.

  Postman has no dedicated route. UAT answers it signed out.

### Decisions

1. **"i":** the library passes `[showInfo]="true"` and opens the dialog through `MASTERCLASS_COURSE_INFO_DIALOG`,
   exactly as the home page does.
2. **The card model:** `MasterclassCourse` gains `has_additional_resources` (the four booleans), checked by the
   shared guard. All four card routes send it.
3. **The card:** a new `showAiKit` input (default off, like `showInfo`) and an `aiKit` output. When it's on and the
   course has `has_ai_kit`, the buttons follow production and the legacy card: a round play button, the "AI Kit"
   button (robot icon) and "i". Otherwise "Trailer" and "i" as today. The home and masterclass pages don't turn it on,
   so they don't change.
4. **The click:** `CourseFacade.openAiKit(course)` reads `course-detail/{id}/?login_type=pre_login` once through
   `ApiClient`, parses only `miscellaneous_data` (a library-local guard, since `features/offerings` can't be
   imported), and opens the shared "Additional Resources" links dialog with the AI Kit and any exercise files, as the
   legacy button did. Tools have no link and are left out. A failed read or an empty list toasts, as before.

### Files

- `core/models/masterclass-home.model.ts`: `has_additional_resources` and its guard.
- `shared/components/cards/masterclass-course-card/*`: `showAiKit`, `aiKit` and the button row; the story gets an
  AI Kit case.
- `features/library/course/models/course-library.model.ts`, `constants/course-library.ts`: the resource types and
  parse, and the route.
- `features/library/course/services/course-facade.ts`: `openAiKit`.
- `features/library/course/pages/course/course.ts|html`: `showInfo`, `showAiKit` and the two handlers.

About 120–150 changed lines.

### Verify

- On hover, an AI Kit course shows play, AI Kit and "i"; any other course shows Trailer and "i", matching production.
- "i" opens the course-info dialog. AI Kit opens "Additional Resources" with the PDF link, and the read is one
  `course-detail` call.
- The home and masterclass cards look the same as before.
