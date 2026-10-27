# MIL-128: filter on every masterclass rail

Status: **approved and implemented (2026-10-27)**, with assumption 1 (the new facade) as proposed, plus two shared
fixes found while verifying (see "Changes from the plan"). Branch `feat/MIL-128-masterclass-rail-filter`, off `master` (`2f493dde`).

## Goal

Every course rail on `/us/accounting/masterclass` gets the filter icon beside its heading:

- the signed-in rails: Continue Watching, Recommended For You, Complimentary, Because You Watched, My List and Courses you've mastered;
- the track rails, signed in or out.

The icon opens the filter dialog. It lists only the options that the rail's own courses have, so each rail shows different choices. Applying it narrows that rail and no other. A count badge on the icon shows how many options are selected. The hero is not a rail, so it doesn't get the icon.

## What I read

- **The page:** `pages/masterclass/masterclass.ts|html`.
  - The signed-in rails come from `MasterclassLibraryFacade` (route-scoped) and render through `#railTpl`.
  - The tracks come from the root `MasterclassHomeFacade` and render through their own copy of the same carousel, card and placeholder.
- **`shared/components/carousel/carousel.ts|html`:**
  - The heading row draws a filter button only when `filterConfig.filterEnabled` is set.
  - In API mode, `SectionFiltersFacade` reads `v2/filters/`, which is a 404 on UAT.
  - Client mode reads `course_category_details`, `instructor_details` and `cpe_credits` from the cards, but masterclass cards carry none of those fields.
  - Podcast and micro-learning use both modes, so the masterclass page keeps `filterEnabled` off and doesn't touch that code.
- **`shared/dialogs/filter-dialog/filter-dialog.ts|html`:** the dialog that podcast and micro-learning open.
  - Its data is `{ [group]: { id, name, selected }[] }`, and it closes with the same shape (all options unselected after "Clear All"), or with nothing when dismissed.
  - Its `labelMap` already names the groups `instructors`, `fields_of_study`, `additional_categories`, `caira_levels` and `cpe_credits`.
  - `core/models/library-filters.model.ts` (`GROUP_TO_FILTER_KEY`) orders them Instructor, Category, Field of Study, Additional Category, CAIRA Level, Credit.
- **UAT, checked 2026-10-27 (public routes, no token):**
  - **`GET web-api/v1/masterclass/filter/?content_type=masterclass_course&page_size=100`:**
    - 64 rows, `has_next: false`, about 56 KB.
    - Every row carries `instructors: {id, name}[]` (all 64 have at least one) and `additional_categories: {id, name}[]` (empty on all 64).
    - `data.filters.levels` lists the 3 CAIRA levels, each `{id, name, number, subject}`.
  - **Rail cards:**
    - The `library/`, `completed-course-section/` and `tracks-page/` cards carry `fields_of_study: {id, name, cpe_credit}[]` and `total_cpe_credits`.
    - They carry no instructors and no level. The `filter/` rows' `program_level` is `null` on all 64, and `subject` is "CAIRA" on all 64, so neither stands in for the level.
  - **Levels:** `filter/?content_type=masterclass_course&page_size=100&level=<id>` answers 22, 31 and 11 rows, which adds up to 64. Every masterclass has exactly one level.
  - **Credits:**
    - The server's `cpe_credit` buckets are `lt_2`, `2_to_5` and `gt_5`.
    - `2_to_5` includes 2: it returns 63 courses with 2 to 3 credits, and `gt_5` returns the one course with 6 credits.
    - UAT has no course with exactly 5 credits.
- **Category:** the backend confirmed (2026-10-27) that Category and Field of Study are the same thing, so the dialog has one "Field of Study" group.

## Locked decisions

1. **The groups, in this order:**

   | Group               | Where its data comes from      |
   | ------------------- | ------------------------------ |
   | Instructor          | `filter/` rows                 |
   | Field of Study      | the rail's cards               |
   | Additional Category | `filter/` rows                 |
   | CAIRA Level         | the three level reads          |
   | Credit              | the cards' `total_cpe_credits` |
   - There is no Category group.
   - Each group lists only the options that at least one of the rail's courses has. Instructors and fields of study are sorted A–Z, and levels by number.
   - An empty group is left out, so Additional Category stays hidden on UAT today.

2. **The credit buckets match the server's:**
   - "Less than 2 credits" is `< 2`.
   - "2 to 5 credits" is `2–5`, inclusive.
   - "Greater than 5 credits" is `> 5`.
   - A course whose credits are `null` matches no bucket.
3. **Matching:** a course matches when, for every group that has a selection, it has at least one of the selected options. That's OR within a group and AND across groups, the same as the library sidebar.
4. **The course data loads on the first open, once per page visit.**
   - The first time any rail's icon is clicked, one `filter/` read builds each course's instructors and additional categories.
   - Then one `filter/?level=<id>` read per level (3 today) builds each course's level.
   - These 4 reads are shared by every rail and kept until the learner leaves the page.
   - A visitor who never filters pays nothing.
   - While the reads run, the global loading bar shows and the icons are disabled. The dialog opens when they finish.
5. **If those reads fail:**
   - The dialog still opens with the groups the cards supply, Field of Study and Credit, and the error is logged.
   - The next open tries again.
6. **The dialog is the shared `FilterDialog`, unchanged.**
7. **The icon goes in the carousel's heading row through a new projection slot**, `<ng-content select="[carouselAction]" />`, beside the existing `filterEnabled` button.
   - The page projects its own button, styled like the carousel's (the `filterIcon` SVG, plus the count badge).
   - The carousel's other callers don't change.
8. **One rail template.** The tracks render through `#railTpl` like the signed-in rails, so the icon, carousel, card and placeholder are written once.
   - Each track's `<section>` gets an id, `masterclass-track-<slug>`.
   - The tracks' `@empty` loading skeleton and the error panel stay as they are.
9. **When a filter matches nothing:**
   - The rail keeps its heading and icon and shows "No courses match these filters." in place of the row.
   - Clearing the filter brings the row back.
10. **Selections last for the page visit**, per rail, in the route-scoped facade. A rail's selection is kept across sign-in and sign-out.

## Assumptions (please confirm)

1. **A new route-scoped facade, `services/masterclass-rail-filter-facade.ts`**, is listed on the masterclass route beside the other two. It holds the selections and the lazy course data, and opens the dialog.
   - You asked once for no facade on this page. Facades were added for the hero and the rails since then.
   - The alternative is to fold all of this into `MasterclassLibraryFacade`. That facade is about the signed-in reads, and the filter also covers the tracks, so I'd keep it separate.
2. **The level reads go away when the backend adds `level` and `instructors` to the rail cards.** That would remove all four extra reads, and Instructor and CAIRA Level would come from the cards like Field of Study. Worth asking for, but I won't wait on it.

## Target architecture

- **`constants/masterclass.ts`** gains:
  - `MASTERCLASS_FILTER_URL` (`web-api/v1/masterclass/filter/`, public, `page_size` capped at 100);
  - `MASTERCLASS_FILTER_PARAMS` (`content_type=masterclass_course`, `page_size=100`);
  - `RAIL_FILTER_CREDIT_BUCKETS` (`{ id, name, test(credits) }`);
  - `RAIL_FILTER_EMPTY` (the empty-row copy).
- **`models/masterclass-rail-filter.model.ts`**, new:
  - `RailFilterGroupKey`, which is the shared dialog's group keys;
  - `RailFilterOption` (`{ id, name }`), `RailFilterSelection` and `RailFilterDialogData`;
  - `CourseFilterIndex`: each course's instructors, additional categories and level, plus the level list;
  - `FilteredRail` (`MasterclassRail` plus the shown courses and the selected count);
  - the trust boundary: `parseFilterCourses` for the `filter/` envelope and rows, and `selectionFromDialog`, which reads the dialog's untyped result back into a selection and keeps only known groups and string ids.
- **`utils/masterclass-rail-filter.ts`**, new, all pure functions:
  - `railFilterOptions(courses, index, selection)` builds the dialog data;
  - `matchesSelection(course, selection, index)` checks one course.
- **`models/masterclass-library.model.ts`**:
  - `MasterclassRail` gains an optional `subText` (the track description);
  - a new `trackRail(track)` maps a track to a rail.
- **`services/masterclass-rail-filter-facade.ts`**, new, `@Service({ autoProvided: false })`:
  - `selections`: a signal keyed by rail id.
  - The course data: an `rxResource`, idle until the first open. Its stream reads `filter/`, then the per-level reads in parallel, through `ApiClient`.
  - `narrow(rails)` returns a `FilteredRail[]`. The page calls it inside its `computed`s.
  - `open(rail)` marks the rail as waiting and starts the read. An effect opens the dialog once the read settles, and stores the selection when the dialog closes with one.
  - `opening` disables the icons while the read runs.
  - Errors are logged.
- **`pages/masterclass/masterclass.ts`:**
  - injects the facade;
  - adds three `computed`s, `railsAboveTracks`, `trackRails` and `railsBelowTracks`, each passed through `narrow()`;
  - adds `openFilter(rail)`.
- **`pages/masterclass/masterclass.html`:**
  - the tracks' `@for` uses `#railTpl`;
  - `#railTpl` passes `rail.shown` to the carousel, projects the icon and shows the empty line.
- **`shared/components/carousel/carousel.html`** gets the one projection slot.
- **`masterclass.routes.ts`** gets the provider.

## Endpoint map

| Read                                              | When                            | Params                                          |
| ------------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| `GET web-api/v1/masterclass/filter/`              | first open of any rail's filter | `content_type=masterclass_course&page_size=100` |
| `GET web-api/v1/masterclass/filter/` × levels (3) | right after, in parallel        | the same + `level=<id>`                         |

- All of these are public, with no token and no `login_type` (`filter/` answers 400 to `login_type`).
- No existing read changes, and no `app-api/` route is used.

## Phases

1. Constants, model and parser, and the pure utils.
2. The facade and the route provider.
3. The carousel slot, the page's computeds, and the template (tracks moved onto `#railTpl`).
4. Gates, then Playwright on dev.

## Changes from the plan

Verifying in the browser turned up two existing bugs in shared code that this feature exposes. Both are fixed here:

1. **The carousel showed the badge in place of every card.**
   - `Carousel` finds its card template with `contentChild(TemplateRef)`, which searches descendants.
   - The projected filter button's `@if` (the badge) is a template too, and it comes first, so every slide
     rendered the badge.
   - The query is now `{ descendants: false }`. All 23 carousel callers put their card `<ng-template>` directly
     inside `<app-carousel>`, so none of them changes.
2. **The filter dialog filled the whole screen with grey.**
   - `FilterDialog` passes `panelClass="p-0 max-w-full"`. On top of the frame's `w-full`, that stretches the panel
     across the screen while the content stays at 60vw, leaving a grey band on the right.
   - It's now `p-0 md:w-auto max-w-full`: the panel fits its content from `md` up and stays full width on phones.
   - Measured: the panel is the content's width plus 5 px at 375, 768 and 1440.
   - Podcast and micro-learning open the same dialog, so they get the fix too.

## Files touched

New:

- `src/app/features/offerings/masterclass/models/masterclass-rail-filter.model.ts`
- `src/app/features/offerings/masterclass/utils/masterclass-rail-filter.ts`
- `src/app/features/offerings/masterclass/services/masterclass-rail-filter-facade.ts`

Changed:

- `src/app/features/offerings/masterclass/constants/masterclass.ts`
- `src/app/features/offerings/masterclass/models/masterclass-library.model.ts`
- `src/app/features/offerings/masterclass/masterclass.routes.ts`
- `src/app/features/offerings/masterclass/pages/masterclass/masterclass.ts|html`
- `src/app/shared/components/carousel/carousel.ts|html`
- `src/app/shared/dialogs/filter-dialog/filter-dialog.html`
- `prompts/masterclass-rail-filter.md`
- `docs/refactor/STATE.md`

It came to about 600 changed source lines, 428 of them in the three new files, over the ~300 estimate.

## Security

- The reads are public catalogue data, and no user input reaches a URL.
- The dialog's result is untyped, so it's parsed back into known groups and string ids before use.

## Acceptance criteria

- **Icons:**
  - Signed out, each track rail has the icon.
  - Signed in, every visible rail has it.
  - The hero has none.
- **Dialog:**
  - The first open makes exactly 1 + (number of levels) `filter/` requests. Later opens on any rail make none.
  - Each rail's dialog lists only its own courses' instructors, fields of study, levels and credit buckets, in the order above, with no Category group.
  - Additional Category is absent on UAT.
- **Apply:**
  - Applying narrows only that rail.
  - The badge shows the number of selected options.
  - Reopening shows the selection checked.
  - "Clear All" restores the row and removes the badge.
- **A filter with no matches** shows "No courses match these filters." The row comes back on clear, with no stale or missing slides.
- **Failure:** if the `filter/` reads fail (500), the dialog opens with Field of Study and Credit only, the error is logged, and the next open retries.
- **Unchanged:**
  - the hero, the sidenav and the section ids of the signed-in rails;
  - the AI Kit, trailer and info buttons;
  - the podcast and micro-learning filters.
- No layout shift on the tracks, and no overflow at 375 / 768 / 1440.

## Checks

- `pnpm lint`
- `pnpm format:fix`
- `pnpm check:structure`
- `pnpm build:prod`

## How to verify

1. Start the dev server and open `http://localhost:4101/us/accounting/masterclass`.
2. Signed out, click a track's filter icon.
   - Network shows `filter/?content_type=masterclass_course&page_size=100` and three `…&level=` reads.
   - The dialog lists that track's instructors, fields of study, levels and credits.
3. Pick an instructor and apply.
   - Only that track narrows, and the badge reads 1.
   - Open another track's icon: no new requests.
4. Sign in and repeat on Continue Watching and My List.
5. Pick options that match nothing, and check the empty line. Clear All, and check that the row comes back.
6. In DevTools, block `filter/`, reload and open a filter. Field of Study and Credit still appear.

## Risks

- **Over 100 masterclasses:**
  - `filter/` caps `page_size` at 100.
  - Past 100 courses, any course beyond the first page would have no instructor or level data, so an Instructor or CAIRA Level filter would hide it.
  - UAT has 64. Paging the read is a small follow-up when the catalogue nears 100.
- **Request cost:** the first open costs 4 requests, about 120 KB. The backend change in assumption 2 removes them.
- **The `filter/` URL is now in two features**, the library and masterclass. Moving it to `core/` is its own refactor PR.
- **The shared dialog's styling** (light hover rows on a dark panel) is unchanged. Restyling it would touch podcast and micro-learning too.
