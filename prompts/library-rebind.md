# MIL-95: bind the instructor library and the instructor page to the web API

**Status:** revision 3, 2026-10-15, awaiting approval.

**Branch:** `feat/MIL-95-instructor-library-binding`, cut from `master` `e3fc330`. It is one branch for the Story, with
one commit per subtask, as for MIL-82 and MIL-65.

**What changed since revision 2:**

- Production is now the design and flow reference.
- The instructor page gets its tabs back (D5 flipped).
- The work follows the three Jira subtasks.
- The badge library is out: it becomes its own ticket (see the end).

**Ground rules:**

- No legacy binding, type or helper survives in a rebound flow.
- Nothing touches `app-api/`.

## Jira

```
Story    MIL-95  feat(library): bind the instructor library and instructor page to the web API
  Sub 1  MIL-?   refactor(library): drop the retired instructor bindings
  Sub 2  MIL-?   feat(library): bind the instructor library to all-instructors-page
  Sub 3  MIL-?   feat(library): bind the instructor page to instructor-detail
```

The subtask numbers go into the commit messages. Send them when you have them.

## Assumptions (read first)

1. **Subtask 1 deletes the legacy code rather than stubbing it.** Four pieces are typed on the legacy
   `InstructorListItem`, so none can survive its removal without a stand-in type:
   - the instructor card
   - `instructor-hero`
   - `InstructorFacade`
   - the two pages' reads

   **What subtask 1 leaves:**
   - The library page keeps its heading and search box and shows "No instructors found."
   - The instructor page keeps its Back link.

   **What comes back:** subtasks 2 and 3 bring the facade and hero back at their old paths, and the card at its new
   path. The squash diff therefore reads as a move plus a retype. This is the MIL-87 → MIL-88 shape: remove
   everywhere first, then rebind.

2. **The instructor page needs sign-in for now.** `instructor-detail/` answers 401 when signed out, while production's
   page is public. This is the one intended difference from production, and it lasts until the backend answers Q1.
3. **The `instructor-detail/` shape comes from the Postman export, not a live call.** The call needs a token, and UAT
   sends no OTP, so I can't sign in.
   - **The export's live-captured 200** (`postman/`, refreshed 2026-10-15) is a list row without `courses`,
     `course_count` and `created_at`: `id, name, designation, bio, horizontal_image_url, vertical_image_url,
square_image_url, video_url, social_media`. The parser checks exactly those.
   - **If UAT drifts from it:** the parse fails loudly and shows the error state, never half a page.
   - **How I verify it:** in the browser, with that captured body stubbed in flight.
4. **One PR of about 800 changed lines**, which is over the ~400 guide. About 330 of those are deletions. If you want
   it smaller, subtasks 1 + 2 can ship as one PR and subtask 3 as a second, from the same branch.

## Production reference (design and flow only)

Production is an older release of this same app, still on the old backend. So the layout we need already exists in our
templates, and only the data changes. Nothing on production is used as data.

**Instructor library:**

- **Header:** "Masters of the AI Accounting Era" with its subtitle, and a "Search instructors" box on the right.
- **Cards:** photo cards in 2 / 3 / 4 / 5 columns. Each shows the photo, name, job title and a LinkedIn chip in the top
  corner.
- **Navigation:** clicking a card opens the instructor page.
- **Paging:** more instructors load as you scroll.
- **Production bug, not copied:** "No instructors found." shows next to "Loading…" for about 5 s, because the
  loading check is commented out in `instructor.html`.

**Instructor page,** from top to bottom:

- Back link
- Header: a large photo behind a round one, then the name, job title and social links
- About
- Promo (video)
- "Courses by {first name}", with **Masterclass / Podcast / Micro Learning** tabs and course cards showing Trailer,
  "i" and CPE
- **Production bug, not copied:** the browser title is the generic site title.

## What it read

- **Code on this branch:**
  - `features/library/instructor/**`: the facade, both pages and the hero
  - `shared/components/cards/instructor-card`: one consumer, no story
  - `core/models/library.model.ts`: `InstructorListItem`, used only by the files above
  - `features/features.routes.ts`, lines 91–96 and the `premiere/…/expert/…` redirect at line 119
  - The course library (#136) as the pattern: `course/constants/course-library.ts`,
    `course/models/course-library.model.ts`, `course/services/course-facade.ts` and `course/pages/course/*`
  - `core/guards/auth/auth-guard.ts`, which redirects with `?redirect=`
  - `Utils.slugify`
  - `core/models/masterclass-home.model.ts`: `isMasterclassCourse`
- **The Postman export in `postman/`, refreshed 2026-10-15** (`Merged_Masterclass_Backend_All_APIs`, folder
  `04. Masterclass - Learning Flow (web)`):
  - `all-instructors-page/`: `course_type` is required (any of `course`, `podcast`, `nano_learning`,
    `micro_learning`); `page_size` defaults to 6, ceiling 100; anything else is a 400. Public with an optional
    signed-in overlay; no cache yet.
  - `instructor-detail/`: IsAuthenticated, with a live-captured 200 (Assumption 3). The export shows 403 when
    signed out; live UAT answers 401. Either way the page never calls it signed out.
  - `filter/`: `instructor` takes UUIDs; `page_size` defaults to 6, ceiling 100.
- **Live UAT, signed out, read-only, re-checked 2026-10-15:**

  | Request                                                                               | Answer                                                                                                                                                                                                                                                                                                                                   |
  | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `all-instructors-page/` without `course_type`                                         | **400** `invalid_query`: "course_type Field required". `login_type` → 400 "Extra inputs are not permitted".                                                                                                                                                                                                                              |
  | `all-instructors-page/?course_type=course,podcast,micro_learning&page_size=20&page=1` | 200, 63 instructors in total. `data`: `count, page, page_size, total_pages, has_next, has_previous, next, previous, results`. A row: `id` (UUID), `name`, `designation`, `bio`, `horizontal_image_url`, `vertical_image_url`, `square_image_url`, `video_url`, `social_media[]`, `course_count`, `courses[]`, `created_at`. **No slug.** |
  | the same with `&search=adam`                                                          | 200, 1 row                                                                                                                                                                                                                                                                                                                               |
  | `filter/?course_type=course&instructor=<Adam's uuid>&page_size=100`                   | 200, 1 card, `has_next: false`. Every card passes `isMasterclassCourse`.                                                                                                                                                                                                                                                                 |
  | the same with `course_type=podcast` / `micro_learning`                                | 200, 0 cards (UAT has none)                                                                                                                                                                                                                                                                                                              |
  | `instructor-detail/<uuid>/`                                                           | **401** "Authentication credentials were not provided."                                                                                                                                                                                                                                                                                  |
  | `instructor/`, `instructor/:id/`, `instructor/:id/courses/` (today's code)            | 404                                                                                                                                                                                                                                                                                                                                      |

  More data facts:
  - Image coverage: vertical 48 of 63, horizontal 48, square 26.
  - `video_url` is set on 2 instructors.
  - `social_media` is LinkedIn only, on 30 rows. Each entry is
    `{id, social_media_title, social_media_icon_url, social_media_url, social_media_order}`.
  - 20 instructors have no courses.

## Locked decisions (flip any before approval)

- **D1 Copy #136's shape.**
  - **Files:** models in `instructor/models/instructor-library.model.ts` (types, guards, `parse*`). Constants in
    `instructor/constants/instructor-library.ts` (absolute URLs off `BASE_API_URL`, page size, tabs, copy).
  - **Reads:** `httpResource` with `parse` at the boundary and `withPreviousValue`. Pages accumulate in a
    `linkedSignal`. Page 1 drives the loading bar; later pages use `SKIP_LOADING`.
  - **States:** `app-error-state` with retry, "Loading…", and an empty state outside the `@for`.
  - **Code rules:** every import is an alias, and nothing sets `changeDetection`.
- **D2 The instructor list query:**
  `all-instructors-page/?course_type=course,podcast,micro_learning&search=&page=&page_size=20`.
  - All three types, so `course_count` counts everything an instructor teaches.
  - 20 rows fill the 2-, 4- and 5-column grids.
  - Search keeps today's 300 ms debounce and trims the term.
- **D3 Show every instructor the API returns**, including the 20 with no courses. The backend owns the list (Q3).
- **D4 The card moves into the feature,** to `instructor/components/instructor-card`. It has one consumer, and it takes
  the feature's `InstructorRow`, which `shared/` can't import.
  - **Image:** vertical, then square, then horizontal, then initials.
  - **Socials:** `social_media`, sorted by `social_media_order`. A known title (LinkedIn, YouTube, Instagram, Facebook)
    uses the existing `@ng-icons/svgl` icon; an unknown title shows the API's icon URL. One helper in the model
    serves both the card and the hero.
  - **Clickable card:** the name becomes a real link stretched over the card, replacing today's `role="button"` div
    plus `router.navigate`. The social chips sit above that link.
- **D5 (flipped) Instructor page: tabs as on production, no facade.** The page has one profile and one course list,
  and shares nothing with other components. Its reads stay in the page as today, the way `/masterclass` does it.
  - **Profile:** `instructor-detail/<uuid>/`, requested only when the boolean `isAuthenticated()` is true.
  - **Courses:** one `filter/?course_type=<tab>&instructor=<uuid>&page_size=100` read for the **active** tab, parsed
    with `isMasterclassCourse`. Tabs: `course` "Masterclass", `podcast` "Podcast", `micro_learning` "Micro Learning".
    They use production's labels and the default `app-tabs` variant.
  - **Cards:** `app-masterclass-course-card` with Trailer and "i" (`MASTERCLASS_COURSE_INFO_DIALOG`), as the course
    library uses it. No AI Kit, matching production. Bookmarks are out of scope.
  - **Grid:** 1 / 2 / 3 columns, as today's Masterclass tab.
  - **Empty tab:** "No {label} courses yet.", shown only when the tab isn't loading and has no error.
  - **Heading:** "Courses by {first word of `name`}". The API has no separate first name.
  - **Hero:** keeps its markup and is only retyped:
    - backdrop: `horizontal_image_url`
    - round photo: square, then vertical, then hidden
    - About: `bio`
    - Promo: `video_url`, with `horizontal_image_url` as the poster
- **D6 The route:**
  - **Guard:** `canMatch: [authGuard]` until Q1 is answered, so a signed-out visitor goes to sign-in and comes back.
  - **Param:** becomes a UUID string; `numberAttribute` goes. An old numeric link reaches the API, gets a 400 or 404,
    and shows the error state. No id map exists to redirect with (Q2).
- **D7 `InstructorFacade` stays a root `@Service()`.** It's a deliberate exception under AGENTS.md §3: the search term
  and loaded pages should survive a visit to an instructor and the Back button. It says so in a `// why:` comment.
- **D8 Browser-only reads,** as #136 kept the course library. Server-rendering the libraries is a separate SEO ticket.

## Endpoint map

| Page                     | Legacy (deleted in subtask 1)    | New                                                                                                                     | Auth                 |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Instructor library       | `instructor/?page=&search_key=`  | `GET web-api/v1/masterclass/all-instructors-page/?course_type=course,podcast,micro_learning&search=&page=&page_size=20` | AllowAny             |
| Instructor page, profile | `instructor/:id/`                | `GET web-api/v1/masterclass/instructor-detail/<uuid>/`                                                                  | IsAuthenticated (Q1) |
| Instructor page, courses | `instructor/:id/courses/?page=1` | `GET web-api/v1/masterclass/filter/?course_type=<tab>&instructor=<uuid>&page_size=100`                                  | AllowAny             |

## Target architecture

```
features/library/instructor/
  models/instructor-library.model.ts   InstructorSocial, InstructorRow, InstructorLibraryPage, InstructorProfile,
                                       InstructorCourseTab; parseInstructorLibrary, parseInstructorProfile,
                                       parseInstructorCourses; socialLinksOf(), photoOf(), firstNameOf()
  constants/instructor-library.ts      INSTRUCTOR_LIBRARY_URL, INSTRUCTOR_DETAIL_URL, INSTRUCTOR_COURSES_URL,
                                       INSTRUCTOR_LIBRARY_PAGE_SIZE = 20, INSTRUCTOR_COURSE_TYPES,
                                       INSTRUCTOR_COURSE_TABS, INSTRUCTOR_SOCIAL_ICONS, copy
  services/instructor-facade.ts        root (D7): search + page → one httpResource, pages accumulated, reload
  components/instructor-card/          new path (D4)
  components/instructor-hero/          retyped to InstructorProfile
  pages/instructor/                    loading / empty / error states; cards link to /instructor/<uuid>/<slug>
  pages/instructor-details/            profile + active-tab courses; tabs; promo video
features/features.routes.ts            instructor route: canMatch: [authGuard] (D6)
```

`INSTRUCTOR_COURSES_URL` is the same route as `COURSE_LIBRARY_URL`. It is declared once in the instructor constants
rather than imported from a sibling sub-feature. If a third caller appears, both move to `features/library/constants/`.

## Subtasks (one commit each)

**Subtask 1: `refactor(library): drop the retired instructor bindings`** (about −330)

- **Delete:**
  - `core/models/library.model.ts`. `BaseInstructorDetails` stays in `feature.model.ts` for its other users.
  - `shared/components/cards/instructor-card/*`
  - `instructor/services/instructor-facade.ts`
  - `instructor/components/instructor-hero/*`
- **`pages/instructor`:** keeps the heading and search box and shows "No instructors found." The debounce and the
  click handler go with the facade.
- **`pages/instructor-details`:** keeps the Back link. Removed:
  - both reads
  - the `{masterclass, nano}` bucket types
  - the `Horizontal`, `Hover`, `Vertical` and `Square` card usage
  - the `promo_video`, `about_me` and `first_name` plumbing
  - the `view_instructor` effect
- **Tidy-up:** the remaining imports become aliases, then `node scripts/check-structure.mjs --prune`.
- **Check:** no request goes to `instructor/`, and both routes load with no console error.

**Subtask 2: `feat(library): bind the instructor library to all-instructors-page`** (about +260)

- The model's list half, the constants, the rewritten `InstructorFacade`, and the new `instructor-card`.
- **`pages/instructor`:**
  - States: "Loading…" shows only while loading, the empty state only after a load with no rows, and the error
    state has a retry.
  - Paging: the scroll sentinel stays while `has_next` is true.
  - Search: debounced at 300 ms.

**Subtask 3: `feat(library): bind the instructor page to instructor-detail`** (about +230)

- The model's profile and courses half, `instructor-hero` retyped, and `pages/instructor-details` per D5.
- The route guard and string param (D6).
- `view_instructor` fires once per instructor, with the UUID and `name`.

## Security

- **Tokens:** only through the interceptors. The AllowAny reads carry the learner token when signed in; the API
  documents it as an optional overlay.
- **Auth checks:** `instructor-detail/` is requested only when the boolean `isAuthenticated()` is true, and the route
  is gated by `authGuard`. Neither looks at the token.
- **Search:** the term is trimmed and debounced before it reaches a URL, and goes as a query param.
- **Instructor id:** goes to the API as a path segment. Anything that isn't a known UUID gets the API's 400 or 404
  and the error state.
- **Social and image URLs:** come from the API and render through `[href]` and `ngSrc`, with Angular's URL
  sanitising. Links open with `rel="noopener noreferrer"`.

## Acceptance criteria

**Subtask 1**

- [ ] No `InstructorListItem`, `instructor/` request or `shared/components/cards/instructor-card` left in `src/`.
- [ ] `/us/accounting/library/instructor-library` and `/us/accounting/instructor/<x>/<y>` load with no console error.

**Subtask 2**

- [ ] The library shows 20 instructors, then the rest of the 63 as you scroll, and the sentinel goes. Every request
      sends `course_type=course,podcast,micro_learning`.
- [ ] "No instructors found." never shows while loading.
- [ ] Typing "adam" sends one request after the debounce and shows 1 card. Clearing the search restores the list
      from page 1.
- [ ] Cards show the photo, following D4's fallbacks, and the LinkedIn chip when one is set. The chip opens LinkedIn;
      the rest of the card opens `/instructor/<uuid>/<slug>`.
- [ ] A faked 500 shows the error state, and Retry recovers.
- [ ] Back from an instructor page keeps the search term and the loaded pages (D7).

**Subtask 3**

- [ ] Signed out, a card leads to `/auth/login?redirect=…`. Signed in, `/instructor/<uuid>/<slug>` shows:
  - the hero and About
  - Promo, when `video_url` is set
  - "Courses by {first name}" on the Masterclass tab
- [ ] Each tab sends one `filter/` request with its `course_type`. Podcast and Micro Learning show the empty copy on
      UAT.
- [ ] Trailer and "i" work as on the course library, and a card opens `/masterclass/<uuid>/<slug>`.
- [ ] An unknown UUID or an old numeric id shows the error state, and Retry works.
- [ ] `view_instructor` fires once per instructor, with the UUID.

**All**

- [ ] `pnpm lint` (0 errors), the structure check, Prettier and `CI=true pnpm build:prod` are green, with the
      environment stated.
- [ ] Parity with production at 375, 768 and 1440 px, with no horizontal scroll. Intended differences:
  - masterclass cards on the instructor page
  - sign-in required (D6)
  - no "No instructors found." while loading

## Checks

```bash
pnpm lint
pnpm format:fix
CI=true pnpm build:prod
```

## How to verify (dev server on 4101, headless Playwright as for #136 and MIL-65)

1. **Library, signed out:**
   - Record every `all-instructors-page/` request and scroll to the end.
   - Search "adam", then clear.
   - Fake a 500, then Retry.
   - Check 375, 768 and 1440 px.
2. **Instructor page, signed out:** a card click lands on sign-in with `redirect`.
3. **Instructor page, signed in:** use a dummy `ACCESS_TOKEN` and client-side navigation. Stub `instructor-detail/` in
   flight with the export's captured body, re-pointed at a real instructor's list row (Assumption 3); `filter/` stays
   live.
   - Check the hero, About and Promo, using Alex Lee or another instructor with `video_url` set.
   - Switch tabs and confirm one request per tab.
   - Trailer, "i" and a card click.
   - An old numeric id shows the error state.
   - Check 375, 768 and 1440 px.

## Backend questions

- **Q1:** `instructor-detail/` is IsAuthenticated, while the list that carries the same profile is AllowAny. Can it be
  AllowAny with the optional overlay? That would make the instructor page public and indexable, as on production.
  D6 guards the route until then.
- **Q2:** Production links use numeric ids (`/instructor/<number>/<slug>`), and the API uses UUIDs. Is there
  an old-id lookup, like `about-course/` for course slugs? Without one, every indexed or shared instructor link breaks.
- **Q3:** Should the list include instructors with no courses (20 of 63 on UAT)?
- **Q4:** Is `filter/?instructor=<uuid>` the intended source for an instructor's courses, or will `instructor-detail/`
  carry them? The export's `instructor-detail/` example has no courses.

## Risks

- **The detail shape is checked against the export only** (Assumption 3). If UAT drifts from it, every signed-in
  visitor sees the error state until the parser is fixed. One signed-in call closes this.
- **Old instructor links die** (D6, Q2). This includes the `premiere/:courseId/expert/:name` redirect
  (`features.routes.ts:119`) and `shared/components/course-about`, which links with legacy numeric ids. Both already
  404 today and belong to the podcast and micro-learning rebind.
- **Podcast and Micro Learning cards are unseen** on UAT. The cards share `isMasterclassCourse` with the course library,
  where those tabs are also empty.
- **PR size** (Assumption 4).

## Not in MIL-95

- **The badge library** gets its own ticket. Revision 2's analysis still holds:
  - Its reads (`badge-categories/`, `course-badges/`) return 404.
  - The header link is already commented out.
  - The only web badge read is the CAIRA tracker's `badges/page/`, which needs sign-in and was rebound in #132.
  - Recommendation: redirect `library/badge-library` to `caira-tracker` and delete `badge/**` and
    `shared/components/cards/badge-card`. Also remove its footer link (`footer.ts:73`), its SEO row and its
    footer-overlay entry.
- **`CourseFacade` has no `// why:` for being root.** That's a one-line follow-up. #136's other findings (relative
  imports, OnPush in `tabs.ts`) are already fixed on `master`.
- **Not touched:** server rendering of the libraries, bookmarks, and FeatureFacade's `FEATURE_ROUTES.instructor` and
  `RELATED_CONTENT_ROUTES.getInstructorCourses`. The last two belong to the podcast and micro-learning rebind.
