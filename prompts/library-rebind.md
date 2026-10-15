# Library rebind — instructor library, instructor page, badge library → CAIRA UAT web API

**Status:** revision 2, 2026-10-15, awaiting approval. Rewritten after `d470717` (#136, Story MIL-82: MIL-83 + MIL-84)
landed on `master` and bound the **course library**. Revision 1 planned that page too; it is now done, so this prompt
covers what is left and follows the patterns #136 set. Same ground rules as `prompts/commerce-api-rebind.md`: no legacy
binding, type or helper survives in a rebound flow, and nothing touches `app-api/`.

## What changed since revision 1

| Revision 1 said                            | Now                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR1 binds the course library to `filter/`  | **Done in #136.** `course_type` is required there; tabs are fixed (`course`, `podcast`, `micro_learning`), page size 12, browser-only, Category dropped, "i" and AI Kit buttons on the cards.                                                                                |
| Server-render page 1 of each library       | #136 kept the course library browser-only. The instructor library follows it (D8); SSR for both is one follow-up ticket.                                                                                                                                                     |
| Library facades become route-scoped        | #136 kept `CourseFacade` root. Root is the right call for these lists (D7); the instructor facade matches it with a stated reason.                                                                                                                                           |
| `features/library/models/library.model.ts` | #136 put models and constants per sub-feature (`course/models/`, `course/constants/`). The instructor sub-feature does the same.                                                                                                                                             |
| Contract from the Postman export           | `postman/` is untracked since #136 (local copy kept). The export is stale: **`all-instructors-page/` now requires `course_type`** and rejects `login_type` (live, 2026-10-15), and every card's `trailer_url` became `horizontal_trailer_url` (already handled on `master`). |

## Jira

```
Story: feat(library): bind the instructor and badge libraries to the web API
Component / scope: library
Children:
  MIL-<n>  feat(library): bind the instructor library to the web API        feat/MIL-<n>-instructor-library
  MIL-<n>  feat(library): bind the instructor page to the web API           feat/MIL-<n>-instructor-page
  MIL-<n>  refactor(library): retire the badge library                      refactor/MIL-<n>-retire-badge-library
Links: prompts/library-rebind.md · prompts/course-library-binding.md (the pattern) · Postman 04 web-masterclass-all-instructors-page-v1,
       web-masterclass-instructor-detail-v1, web-masterclass-filter-v1 · 17 web-badges-page-v1
Context: the course library is bound (#136). The instructor library, the instructor page and the badge library still read
         instructor/, instructor/:id/, instructor/:id/courses/, badge-categories/ and course-badges/, all 404 on UAT.
Current behaviour: the three pages render empty or error on UAT.
Expected behaviour: the instructor library and page read the web API and link courses by UUID + slug; the badge library
         redirects to the CAIRA tracker.
Out of scope: the CAIRA tracker's own rebind (its v2 reads also 404), carousel section filters, FeatureFacade, podcast and
         micro-learning pages, SSR for the libraries, bookmarks.
Estimate: S · M · S
```

## Goal

The instructor library, `/instructor/:id/:name` and `/library/badge-library` stop calling retired routes. The first two
render live UAT data with the course library's look and states; the third is retired.

## What it read

- **`master` at `d470717`:** `features/library/course/**` (facade, model, constants, page, filters, drawer),
  `shared/ui/tabs`, `shared/components/cards/masterclass-course-card`, `core/models/masterclass-home.model.ts`
  (`MasterclassCourse`, `isMasterclassCourse`), `prompts/course-library-binding.md`, `course-library-remove-v2.md`, the
  MIL-82 entries in `docs/refactor/STATE.md`.
- **Unchanged by #136:** `features/library/instructor/**`, `features/library/badge/**`,
  `shared/components/cards/instructor-card`, `core/models/library.model.ts`, `core/guards/auth/auth-guard.ts`,
  `features.routes.ts`, `shared/components/course-about`, `course-related-section`, `core/models/feature.model.ts`.
- **Live UAT, signed out, read-only, 2026-10-15** (Postman export of 2026-10-12 for descriptions):

  | Request                                                                                                        | Answer                                                                                                                                                                                                                                                                                                                                                                     |
  | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `GET web-api/v1/masterclass/all-instructors-page/`                                                             | **400** `invalid_query`: `course_type` Field required                                                                                                                                                                                                                                                                                                                      |
  | `…/all-instructors-page/?login_type=pre_login`                                                                 | 400: `login_type` "Extra inputs are not permitted"                                                                                                                                                                                                                                                                                                                         |
  | `…/all-instructors-page/?course_type=course,podcast,micro_learning&page_size=100`                              | 200: 63 instructors, `has_next: false`. 43 have courses, 20 have none. Images set: vertical 48, horizontal 48, square 26. `video_url` on 2. `social_media` only `LinkedIn` (30 rows) with `{id, social_media_title, social_media_icon_url, social_media_url, social_media_order}`. `course_count` equals `courses.length`. Every course card passes `isMasterclassCourse`. |
  | `…/all-instructors-page/?course_type=podcast`                                                                  | 200: still 63 instructors; each `courses` / `course_count` narrowed to podcasts (all 0 on UAT)                                                                                                                                                                                                                                                                             |
  | `…/all-instructors-page/?course_type=course&search=adam`                                                       | 200: 1 row                                                                                                                                                                                                                                                                                                                                                                 |
  | `GET web-api/v1/masterclass/instructor-detail/<uuid>/`                                                         | **401** "Authentication credentials were not provided."                                                                                                                                                                                                                                                                                                                    |
  | `GET web-api/v1/masterclass/filter/?course_type=course,podcast,micro_learning&instructor=<uuid>&page_size=100` | 200: that instructor's cards (`content_type`, `course_type`, `instructors` extra)                                                                                                                                                                                                                                                                                          |
  | `GET web-api/v1/badges/page/`                                                                                  | 401 (IsAuthenticated)                                                                                                                                                                                                                                                                                                                                                      |
  | `GET instructor/`, `badge-categories/`, `course-badges/` (legacy, today's code)                                | 404                                                                                                                                                                                                                                                                                                                                                                        |
  | `GET v2/course-badges/`, `v2/caira-badges/`, `v2/webinar-badges/` (the CAIRA tracker's reads)                  | 404                                                                                                                                                                                                                                                                                                                                                                        |

## Locked decisions (flip any before approval)

- **D1 Copy #136's shape.** Per sub-feature `models/<name>.model.ts` (types, guards, `parse*`) and
  `constants/<name>.ts` (absolute URLs off `BASE_API_URL`, page size, copy). Reads are `httpResource` with `parse` at
  the boundary, `withPreviousValue`, pages accumulated in a `linkedSignal`, page 1 on the loading bar and later pages
  on `SKIP_LOADING`, `app-error-state` with retry, "Loading…" and an empty state outside the `@for`. Every import is an
  alias, and no component sets `changeDetection` (the rules on `refactor/MIL-85-drop-explicit-onpush`).
- **D2 Instructor list** reads `all-instructors-page/?course_type=course,podcast,micro_learning&search=&page=&page_size=20`.
  All three course types so `course_count` counts everything an instructor teaches. 20 rows fill the 2-, 4- and
  5-column grid. Search keeps today's 300 ms debounce and trims.
- **D3 Show every instructor the API returns**, including the 20 with no courses: the backend owns the list, and a
  client-side filter would make pages uneven. Q3 asks whether the API should drop them.
- **D4 The instructor card moves into the feature**, to `features/library/instructor/components/instructor-card`. It
  has one consumer and will take the feature's `InstructorRow`, which `shared/` cannot import. Image: vertical →
  square → horizontal → initials. Socials from `social_media`, ordered by `social_media_order`; a known title uses the
  existing `@ng-icons/svgl` icon, an unknown one shows the API's icon URL.
- **D5 Instructor page, no facade** (one profile, one course list, no shared state). Two `httpResource`s:
  - profile: `instructor-detail/<uuid>/`, request gated on the boolean `isAuthenticated()`;
  - courses: `filter/?course_type=course,podcast,micro_learning&instructor=<uuid>&page_size=100`, parsed with
    `isMasterclassCourse`.

  One grid of `app-masterclass-course-card` with trailer and "i" (through `MASTERCLASS_COURSE_INFO_DIALOG`, as the
  course library does). **No tabs** while UAT has no podcasts or micro-learning; they return with a follow-up when it
  does. Alternative: three tabs, one request each, labels shared with the course library.

- **D6 The instructor route gets `canMatch: [authGuard]`** until Q1 is answered, so a signed-out click goes to sign-in
  and comes back. The param becomes a UUID string (`numberAttribute` goes). An old numeric link reaches the API, gets
  400/404, and shows the error state; there is no id map to redirect with.
- **D7 Both library facades stay root `@Service()`**, the deliberate-exception clause in AGENTS.md §3, because the
  search term, the selection and the loaded pages should survive a visit to an instructor or course and the back
  button. `InstructorFacade` says so in a `// why:` comment. (`CourseFacade` already behaves this way; its comment is
  a one-line follow-up, not part of these PRs.)
- **D8 Browser-only reads**, as #136 kept the course library. Server-rendering page 1 of both libraries is one SEO
  ticket (Q6).
- **D9 Retire the badge library.** Its reads 404, the header link is already commented out (`nav.config.ts:8`), and the
  only web badge endpoint is the CAIRA tracker's wall (`badges/page/`, sign-in only). `library/badge-library`
  redirects to `caira-tracker`, which is the page to rebind next. Note the tracker's own reads 404 too, so the
  redirect lands on a page awaiting its rebind. Alternative: rebind the badge library to `badges/page/` now and keep
  two badge screens.

## Endpoint map

| Page                     | Legacy (delete the binding)           | New                                                                                                                     | Auth                 |
| ------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Instructor library       | `instructor/?page=&search_key=`       | `GET web-api/v1/masterclass/all-instructors-page/?course_type=course,podcast,micro_learning&search=&page=&page_size=20` | AllowAny             |
| Instructor page, profile | `instructor/:id/`                     | `GET web-api/v1/masterclass/instructor-detail/<uuid>/`                                                                  | IsAuthenticated (Q1) |
| Instructor page, courses | `instructor/:id/courses/?page=1`      | `GET web-api/v1/masterclass/filter/?course_type=course,podcast,micro_learning&instructor=<uuid>&page_size=100`          | AllowAny             |
| Badge library            | `badge-categories/`, `course-badges/` | none: redirect to `caira-tracker`                                                                                       | —                    |

## Target architecture

```
features/library/
  library.routes.ts                          badge-library → redirectTo: 'caira-tracker'  (PR3)
  instructor/
    models/instructor-library.model.ts       InstructorSocial, InstructorRow, InstructorProfile, InstructorLibraryPage;
                                             parseInstructorLibrary, parseInstructorProfile, parseInstructorCourses
    constants/instructor-library.ts          INSTRUCTOR_LIBRARY_URL, INSTRUCTOR_DETAIL_URL (':id'), INSTRUCTOR_COURSES_URL,
                                             INSTRUCTOR_LIBRARY_PAGE_SIZE = 20, INSTRUCTOR_COURSE_TYPES, copy
    services/instructor-facade.ts            root; search + page → one httpResource; accumulate; reload
    components/instructor-card/              moved from shared/components/cards, retyped (D4)
    components/instructor-hero/              retyped to InstructorProfile
    pages/instructor/                        states as the course library; card click → /instructor/<uuid>/<slug>
    pages/instructor-details/                two httpResources, one masterclass-card grid, promo video from video_url
features/features.routes.ts                  instructor route: canMatch: [authGuard]  (PR2)
```

`INSTRUCTOR_COURSES_URL` names the same route as `COURSE_LIBRARY_URL`. It is declared once in the instructor
constants rather than imported across sibling sub-features; if a third caller appears, both move to
`features/library/constants/`.

## Phases / PRs (each under ~400 changed lines, branched from `master`)

**PR1 `feat(library): bind the instructor library to the web API`** (S)

- New model and constants; `InstructorFacade` rewritten; `instructor.ts|html` with error/empty/loading states; the card
  moved and retyped (its story moves with it).
- Delete: `search_key`, `pagination_data` / `parseNextPage` paging, the four `*_link` fields from the card.
- ~+230 / −120.

**PR2 `feat(library): bind the instructor page to the web API`** (M)

- `instructor-details.ts|html` on the two reads (D5), `instructor-hero` retyped, the route guard and string param (D6),
  `view_instructor` with the UUID and name.
- Delete: `core/models/library.model.ts` (`InstructorListItem`, last consumers gone), the `{masterclass, nano}` bucket
  types, the `Horizontal` / `Hover` / `Square` / `Vertical` / `Tabs` usage on this page, `promo_video` /
  `about_me` / `first_name` plumbing.
- Keep: `FEATURE_ROUTES.instructor` (FeatureFacade keys sections by name) and
  `RELATED_CONTENT_ROUTES.getInstructorCourses` (used by `shared/components/course-related-section`). Both belong to
  the podcast / micro-learning rebind.
- ~+200 / −230.

**PR3 `refactor(library): retire the badge library`** (S, D9)

- `library.routes.ts` redirect; remove the footer link (`footer.ts:73`), the SEO row (`seo.constants.ts:104`) and the
  footer-overlay entry (`footer-overlay.config.ts:18`).
- Delete `badge/**` (page, facade, `badge-library-hero`, `badge-spot-animation` with its baseline stylesheet entry) and
  `shared/components/cards/badge-card` (no other consumer). Delete `badge.model.ts` members left with no consumer; keep
  `caira-badge.model.ts` and `Utils.claimBadge`, which the tracker uses.
- `node scripts/check-structure.mjs --prune`.
- ~+10 / −600.

## Security

- Nothing reaches `app-api/` (ESLint enforces). Tokens only through the interceptors; the AllowAny reads carry the
  learner token when signed in, which the API documents as an optional overlay.
- `instructor-detail/` is gated on the boolean `isAuthenticated()` and the route on `authGuard`, never on the token.
- `search` is trimmed and debounced before it reaches a URL. The instructor id in the route is a UUID string passed
  to the API as a path segment; anything else gets the API's 400/404 and the error state.

## Acceptance criteria

PR1

- [ ] `/us/accounting/library/instructor-library` shows 20 instructors, then the rest of the 63 on scroll, and the
      sentinel goes. Every request carries `course_type=course,podcast,micro_learning`; none goes to `instructor/`.
- [ ] Typing "adam" sends one request after the debounce and shows 1 card; clearing restores the list from page 1.
- [ ] Cards show the vertical image (fallbacks per D4) and the LinkedIn icon when present.
- [ ] A faked 500 shows the error state; retry recovers. No results shows the empty state.
- [ ] Back from an instructor page keeps the search term and the loaded pages (D7).

PR2

- [ ] Signed out, a card click lands on `/auth/login?redirect=…`; after sign-in, `/instructor/<uuid>/<slug>` shows the
      hero, bio, promo video when `video_url` is set, and the instructor's course cards.
- [ ] A card's trailer and "i" work as on the course library; a card click lands on `/masterclass/<uuid>/<slug>`.
- [ ] An unknown UUID or an old numeric id shows the error state.
- [ ] `view_instructor` fires once per instructor with the UUID.
- [ ] No `InstructorListItem` and no `instructor/` legacy request left in `features/library`.

PR3

- [ ] `/us/accounting/library/badge-library` redirects to `/us/accounting/caira-tracker`.
- [ ] No footer link, SEO row or footer-overlay entry for the badge library; `badge-categories/` and `course-badges/`
      are gone from `src/app`; the structure baseline shrank.

All

- [ ] `pnpm lint` 0 errors, structure check, Prettier, `CI=true pnpm build:prod` green (state the environment).
- [ ] Parity with production at 375 / 768 / 1440 for the instructor library and page, with the intentional
      differences listed (masterclass cards instead of the legacy cards; no tabs on the instructor page).

## Checks

```bash
pnpm lint
pnpm format:fix
CI=true pnpm build:prod
```

## How to verify (dev on 4101, headless Playwright as #136 did)

1. Instructor library, signed out: record every `all-instructors-page/` request; scroll to the end; search and clear;
   fake a 500 and retry; 375 / 768 / 1440 with no horizontal scroll.
2. Instructor page: signed out → sign-in redirect; signed in → profile + course grid; trailer, "i" and a card click;
   an old numeric id → error state.
3. Badge library URL → CAIRA tracker.

## Backend questions

- **Q1** `instructor-detail/` is IsAuthenticated, while the list carrying the same profile is AllowAny. Can it be
  AllowAny with the optional overlay, so the instructor page is public (and indexable)? D6 guards the route until then.
- **Q2** `all-instructors-page/` now requires `course_type` and rejects `login_type`, which the 2026-10-12 export
  doesn't show. Confirm the contract and share a fresh export.
- **Q3** Should the instructor list include instructors with no courses (20 of 63 on UAT), or can the API drop them?
- **Q4** Is `filter/?instructor=<uuid>` the intended source for an instructor's courses, or will
  `instructor-detail/` carry them?
- **Q5** Confirm the badge library is retired in favour of the CAIRA tracker's `badges/page/` (D9).
- **Q6** Both list endpoints say "NO CACHE YET". Is a cache planned before the libraries are server-rendered?

## Risks

- **The OnPush branch must absorb #136 before it merges** (see "Findings on #136"); these PRs are written to its
  rules, so they stay green either way.
- **Old instructor links die** (D6). The only in-app entry besides the library is `shared/components/course-about`,
  used by podcast, micro-learning and two legacy dialogs, which already link with legacy numeric ids that 404.
- **D9 redirects to a page that is itself unbound** on UAT. Retiring still halves the badge screens to rebind.
- **Podcast and micro-learning cards are untested** on the instructor page: UAT has none.

## Findings on #136 (not fixed in these PRs)

1. **Relative imports in 6 files** (`course-facade.ts`, `course.ts`, `course-filters.ts`, `course-filters-drawer.ts`,
   `constants/course-library.ts`, `shared/ui/tabs/tabs.ts`). They fail the relative-import ratchet on
   `refactor/MIL-85-drop-explicit-onpush` once `master` is merged into it. Fix there: aliases, then `--prune`.
2. **`shared/ui/tabs/tabs.ts`** gained `variant` on `master` and still sets `ChangeDetectionStrategy.OnPush`; the
   OnPush branch removes that line. The merge conflicts on the import line: keep `master`'s file without OnPush.
3. **`CourseFacade` is root without a stated reason** (D7 gives one); a one-line `// why:` follow-up.
4. **`shared/components/course-about`** links to `/instructor/<numeric id>`; it breaks for good after PR2 and belongs
   to the podcast / micro-learning rebind.
