# Share the landing-page rows service across offerings (MIL-179)

Refactor Task under the podcast epic; blocks MIL-176 (podcast landing page). Branch
`refactor/MIL-179-share-landing-rails`. Approved 2026-11-10 together with MIL-176's plan
(`prompts/podcast-landing-binding.md` on that branch, "Split" and Phase 1).

## Goal

The masterclass landing page's learner rows (Continue Watching, Recommended For You, Complimentary,
Because You Watched, My List, Courses you've mastered, Coming Soon) come from `MasterclassLibraryFacade`,
which sits inside `features/offerings/masterclass/` and is fixed to `course_type=course`. The podcast
landing page shows the same rows from the same `web-api/v1/masterclass/…` routes with
`course_type=podcast`. Promote the service, its model and its constants to `features/offerings/` and key
them by offering, so both pages share one service (AGENTS §3: siblings that share code promote it to
their common parent). **No behaviour change**: the masterclass and home pages send the same requests and
render the same thing.

## Locked decisions

1. **`connect(offering)`**, the `CourseDetailFacade` pattern: the facade reads nothing until the page
   connects it. The per-offering settings are one record, `LIBRARY_OFFERINGS`. Only `masterclass` is
   added here, with `courseType: 'course'`; MIL-176 adds `podcast`.
2. **Names keep the `Masterclass` prefix.** They follow the API namespace (`web-api/v1/masterclass/`
   serves every course type), like `MasterclassCourse` and `MasterclassBookmarks` in core. Renaming is
   churn with no reader benefit.
3. **The param objects lose `course_type`**; the facade adds the connected offering's. Every other
   key and value is unchanged, so the requests are byte-for-byte the same.
4. **`ComingSoonCard`** (`features/offerings/components/coming-soon-card/`) replaces the inline teaser card
   in `masterclass.html`. It injects the facade, as components on a facade page do (Remind Me, the
   in-flight state, the trailer), and takes the teaser and its rank as inputs from the carousel template.
   The markup and classes are unchanged.
5. **`MasterclassRailFilter.contentType`**, a signal defaulting to `masterclass_course`: `filter/`'s
   `content_type` comes from it, so another offering can filter its own courses. Nobody sets it here;
   the home and masterclass pages keep the default.
6. **What stays in the masterclass folder:** the hero trailer config, the Coming Soon heading (page copy),
   and the sidenav constants.

## Files touched

| File                                                                       | Change                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `features/offerings/models/masterclass-library.model.ts`                   | moved from `masterclass/models/`; adds `LibraryOffering`, `LibraryOfferingConfig`, `WebCourseType`                    |
| `features/offerings/constants/masterclass-library.ts`                      | new: the library routes, params (without `course_type`), section ids, headings, toasts, `LIBRARY_OFFERINGS`           |
| `features/offerings/services/masterclass-library-facade.ts`                | moved from `masterclass/services/`; `connect()`, `course_type` and My List from the config, `openComingSoonTrailer()` |
| `features/offerings/components/coming-soon-card/coming-soon-card.ts\|html` | new, out of `masterclass.html`                                                                                        |
| `features/offerings/masterclass/constants/masterclass.ts`                  | keeps the hero trailer config and the Coming Soon heading                                                             |
| `features/offerings/masterclass/constants/masterclass-nav.ts`              | import path                                                                                                           |
| `features/offerings/masterclass/masterclass.routes.ts`                     | import path                                                                                                           |
| `features/offerings/masterclass/pages/masterclass/masterclass.ts\|html`    | `library.connect('masterclass')`, `<app-coming-soon-card>`, drop the teaser-only imports and methods                  |
| `core/models/masterclass-rail-filter.model.ts`                             | `FilterContentType` (the contract's `content_type` values)                                                            |
| `shared/services/masterclass-rail-filter.ts`                               | `contentType` signal into `filter/`'s params                                                                          |
| `docs/refactor/STATE.md`                                                   | Now entry + step log                                                                                                  |

## Acceptance criteria

- **Masterclass page, signed out:** the hero, tracks, filter and sidenav as before.
- **Masterclass page, signed in:** the same rows, headings and order; bookmark toggles and My List
  follows; Coming Soon with Remind Me on, off, 409, 404 and failure; the trailer button on a teaser.
- **Home page:** tracks and filter as before.
- **Network:** the same requests with the same params as before, on both pages.
- `pnpm lint` 0 errors, the structure check green, `pnpm build:prod` within budget.

## Checks to run

`pnpm lint` · `pnpm format:fix` · `node scripts/check-structure.mjs` · `pnpm build:prod`

## How to verify

Dev server 4101, English. Record the masterclass page's requests (URL and params) and screenshots at
375 / 768 / 1440 on `master` and on this branch, signed out (live UAT) and signed in (stubbed `library/`,
`completed-course-section/`, `coming-soon/`, `notify-me/`, `bookmark/`), and compare. Same for the
home page's tracks and filter.

## Risks

- A missed `connect()` leaves the rows empty with no error. Covered by the signed-in comparison.
- Moving the Coming Soon card changes nothing visually only if the markup is copied exactly; compared by
  screenshot.
