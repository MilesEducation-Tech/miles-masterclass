# MIL-127: show the signed-in rails on the masterclass page

Status: **approved and implemented (2026-10-26)**, with assumption 1 (Coming Soon held back) and assumption 3 (the
new route-scoped facade) as proposed. Branch `fix/MIL-127-masterclass-signed-in-rails`, off `master` (`70ec9353`;
`master` has since gained `093860b4`, #190, an environments-only change).

## Goal

Signed in, `/us/accounting/masterclass` shows only the hero, the track rails and the FAQ. Add the learner's own rails,
each shown only when it has courses: Continue Watching, Recommended For You, Complimentary, Because You Watched, My
List and Courses you've mastered. Signed out, the page doesn't change.

## What I read

- **The page today:** `pages/masterclass/masterclass.ts|html`.
  - **Hero:** `MasterclassHighlightFacade` (route-scoped) → `GET web-api/v1/masterclass/highlight/?all_courses.page_size=100&course_type=course`.
  - **Track rails:** the root `MasterclassHomeFacade` (shared with the home page) →
    `GET web-api/v1/masterclass/tracks-page/?login_type=…&course_type=course&tracks.page_size=100&tracks.courses.page_size=100`.
  - Then the FAQ, and the sidenav from `constants/masterclass-nav.ts`. Its comment says the old rails "left the page
    with their APIs; add an entry back only with the section it points at."
- **Old bindings (the user asked to remove them first):** there are none left on this page.
  - The signed-in rails used to come from `FeatureFacade` (`v2/user/recently_viewed/`, `v2/user/bookmarks/`,
    `v2/user/completed_classes/`, `v2/dashboard/?filter=coming_soon`, …). They were removed from this page in an
    earlier rebind.
  - `FeatureFacade` and those `v2/` routes still feed the podcast and micro-learning pages, so they stay. Removing
    them is those pages' own work.
  - The hero and tracks calls match the Postman contract param for param and answer 200 on UAT today. Rebinding them
    would change nothing.
- **Postman** (local export, 16 Oct), checked against UAT today:
  - **`GET web-api/v1/masterclass/library/`** (`web-masterclass-library-v1`). "Every course rail in one read".
    - Requires `login_type` and `course_type`. `post_login` without a token is a 401.
    - Rails: `popular`, `latest`, `in_progress`, `bookmarked`, `recommended`, `complimentary`,
      `because_you_watched`, each its own pagination block. There's also `company_name`, which names the firm for
      Complimentary.
    - Each rail pages on its own key. `in_progress.page_size=100` is accepted, but a bare `page_size` is a 400 ("the
      page must name it").
    - `course_type` narrows every rail except `popular` and `bookmarked`, and every card carries `course_type`.
    - Signed out (`pre_login`), the learner rails come back as empty blocks.
    - The notes say: "Track, completed and coming soon are served by `tracks-page/`, `completed-course-section/` and
      `coming-soon/`."
  - **`GET web-api/v1/masterclass/completed-course-section/?course_type=course`**: needs a token (401 without one).
    Returns `{status, heading, subheading, all_courses}`, where `all_courses` is a pagination block of course rows.
  - **`GET web-api/v1/masterclass/coming-soon/`**: public, `results` as a pagination block. **0 rows on UAT**, and
    the notes document no row keys (they say the shape matches no other route).
  - **Cards:** UAT's `library/` rows carry `id, slug, title, short_description, thumbnails, horizontal_trailer_url,
fields_of_study, total_cpe_credits, has_individual_badge, included_for_caira, has_additional_resources,
course_type, …`. They pass the existing `isMasterclassCourse` guard: the same card as the track rails.
- **The shared `app-coming-soon` card** is typed on the legacy `Content` model, and its "Remind Me" button goes
  through the legacy bookmark.

## Locked decisions

1. **Nothing to unbind.** The hero and the tracks stay exactly as they are. `FeatureFacade` stays for podcast and
   micro-learning.
2. **One new route-scoped service:** `services/masterclass-library-facade.ts`, `@Service({ autoProvided: false })`,
   listed on the masterclass route beside `MasterclassHighlightFacade`, the same pattern.
   - **Two reads**, each requested only when `isAuthenticated()` is true and only in the browser (the token lives
     there). Signed out, no request is made.
   - **`library/`:**
     - `login_type=post_login`, `course_type=course`.
     - `<rail>.page_size=100` for `in_progress`, `recommended`, `complimentary`, `because_you_watched` and
       `bookmarked`, so every course arrives in one read, as the track rails do (ceiling 100).
     - `popular.page_size=1` and `latest.page_size=1`: the route always returns them, but the page doesn't show them
       (the hero comes from `highlight/`).
   - **`completed-course-section/`:** `course_type=course`, `all_courses.page_size=100`.
3. **Types are rebuilt from the responses,** in `models/masterclass-library.model.ts` (the feature's model):
   - **`MasterclassLibrary`:** `{ companyName: string | null; inProgress, recommended, complimentary,
becauseYouWatched, bookmarked: MasterclassCourse[] }`.
   - **`parseMasterclassLibrary`:** checks the envelope, `company_name` and each rail's block, with each row through
     `isMasterclassCourse` plus a `course_type` string.
   - **`parseCompletedSection`:** checks `all_courses.results` the same way.
   - A drifted answer lands in the resource's `error()`. The rails then hide, and the error is logged, as the hero
     does.
4. **My List is the masterclass bookmarks only.** `bookmarked` isn't narrowed by `course_type`, so the facade keeps
   `course_type === 'course'` rows. A bookmarked podcast doesn't belong on this page.
5. **Order and headings** (copy in `constants/masterclass.ts`):

   | Section id           | Heading                                                                                 | Source                      | Sidenav                                    |
   | -------------------- | --------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------ |
   | `masterclass-home`   | (hero)                                                                                  | `highlight/`                | Home (unchanged)                           |
   | `continue-watching`  | Continue Watching                                                                       | `in_progress`               | **Continue Watching**, `lucideClock`       |
   | —                    | Recommended For You                                                                     | `recommended`               | —                                          |
   | —                    | Complimentary Courses for {company_name} Employees (or "Complimentary Courses" if none) | `complimentary`             | —                                          |
   | —                    | Because You Watched                                                                     | `because_you_watched`       | —                                          |
   | `masterclass-tracks` | (track names)                                                                           | `tracks-page/`              | Tracker (unchanged)                        |
   | `my-list`            | My List                                                                                 | `bookmarked`                | **My List**, `lucideBookmark`              |
   | `completed-courses`  | Courses you've mastered                                                                 | `completed-course-section/` | **Completed Courses**, `lucideCheckCircle` |
   | `masterclass-faq`    | (FAQ)                                                                                   | —                           | FAQ (unchanged)                            |
   - **Because You Watched** has no single "watched" course on this route: the rail is the related courses of every
     course passed. So the heading is the plain "Because You Watched".
   - **Sidenav entries** show only while their rail has courses, as the Tracker entry does today.

6. **Rendering:**
   - The facade exposes two lists of `{ id, heading, courses }`: the rails above the tracks and the rails below them.
   - The page renders each list with one `@for` over the existing `app-carousel` + `app-masterclass-course-card`
     (`layout="horizontal"`, `showInfo`, trailer and info handlers), so the markup isn't repeated six times.
   - Each rail is `@defer (on viewport; prefetch on idle)` with the same sized placeholder the track rails use. They
     sit below the hero, never in the first viewport.
   - Empty rails aren't rendered. There's no skeleton while the read loads, so a learner with no progress doesn't see
     rows flash and vanish.
7. **No filter button on any rail** (separate ticket).

## Assumptions (the reviewer's first stop)

1. **Coming Soon is held back.** UAT has no coming-soon rows and Postman documents none, so its type can't be built
   from a real response. The shared card's "Remind Me" also needs a rebind to `POST web-api/v1/masterclass/bookmark/{id}/`.
   I'd ask the backend for a sample row and add Coming Soon as a follow-up. **Say if you want it built now on an
   assumed shape instead.**
2. **The signed-in rows look like the signed-out ones.** I can only call `library/` signed out (the learner rails
   are empty there), so the `in_progress` and other signed-in rows are assumed to have the same card shape as
   `popular`/`latest`, which Postman's notes support. A real signed-in capture of `library/` and
   `completed-course-section/` from your browser's network tab would confirm it before the PR. If a progress field
   exists, it's a candidate for the Continue Watching card, but the card stays as the track rails' card unless you
   ask.
3. **A new service on this page.** Memory says the masterclass landing page keeps its logic in the page unless you
   say otherwise. The page already has the route-scoped `MasterclassHighlightFacade`, so the library reads follow it
   rather than crowding `masterclass.ts`.

## Endpoint map

| Call                                                                                                | Before      | After                    |
| --------------------------------------------------------------------------------------------------- | ----------- | ------------------------ |
| `GET web-api/v1/masterclass/highlight/`                                                             | hero        | unchanged                |
| `GET web-api/v1/masterclass/tracks-page/`                                                           | track rails | unchanged                |
| `GET web-api/v1/masterclass/library/?login_type=post_login&course_type=course&…page_size=…`         | —           | **new**, signed in only  |
| `GET web-api/v1/masterclass/completed-course-section/?course_type=course&all_courses.page_size=100` | —           | **new**, signed in only  |
| `GET web-api/v1/masterclass/coming-soon/`                                                           | —           | held back (assumption 1) |

## Files touched (~250 lines)

| File                                                                    | Change                                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `features/offerings/masterclass/models/masterclass-library.model.ts`    | **new**: types and parsers                                        |
| `features/offerings/masterclass/services/masterclass-library-facade.ts` | **new**: the two reads, the rail lists, My List filter, error log |
| `features/offerings/masterclass/constants/masterclass.ts`               | routes, page sizes, headings                                      |
| `features/offerings/masterclass/constants/masterclass-nav.ts`           | the three sidenav entries; comment updated                        |
| `features/offerings/masterclass/masterclass.routes.ts`                  | provide the new facade                                            |
| `features/offerings/masterclass/pages/masterclass/masterclass.ts\|html` | the rails above and below the tracks; sidenav visibility          |
| `docs/refactor/STATE.md`                                                | entry                                                             |

Not touched: `MasterclassHighlightFacade`, `MasterclassHomeFacade`, `FeatureFacade`, the shared carousel and card,
the home page.

## Security

The reads are gated on the boolean `isAuthenticated()`, never on the token. The bearer goes through the interceptor.
Nothing is requested signed out or on the server. No new input reaches an API.

## Acceptance criteria

1. **Signed in, with data:** each rail with courses appears in the order above, under its heading. Complimentary
   names the company. My List shows only masterclasses. The sidenav gains Continue Watching, My List and Completed
   Courses only while their rails have courses.
2. **Signed in, no learner data:** the page looks as it does today (hero, tracks, FAQ). There are no empty headings.
3. **Signed out:** no change, and no `library/` or `completed-course-section/` request is made.
4. **Cards:** they open the course page; trailer and info work as on the track rails.
5. **Errors:** a failed or drifted read hides those rails and logs it. The hero and tracks are unaffected.
6. **375 / 768 / 1440 px:** no sideways scrolling.
7. **Gates:** `pnpm lint` 0 errors, the structure check, Prettier, `pnpm build:prod`.

## How to verify

1. **Signed out, on dev 4101:** the network shows only `highlight/` and `tracks-page/`.
2. **Signed in, real account, in your browser:** the rails match your progress, bookmarks and completions.
3. **Signed in, headless (rails filled in the browser only, never in the PR):**
   - Every rail with rows, `company_name` set, and a bookmarked podcast that must not appear.
   - Empty rails, then a 500 on each read.
   - Screenshots at 375 / 768 / 1440.

## Risks

- **Signed-in row shapes are unseen** (assumption 2). The guards fail loudly into the log rather than half-rendering.
- **`library/` returns `popular`/`latest` regardless.** Asking for one row each keeps the read small (about 8 KB
  signed out).
- **Without Coming Soon** the ticket is partly open until the backend shares a row.

## Revision 2026-10-26: the AI Kit button (the user's call, after comparing the cards)

The rails had no AI Kit button: the shared card drew it in its vertical layout only, and only the course library
turned it on. The user asked for it in this ticket, after checking that the API sends the data. The card bookmark
icon and the footer "Continue Learning" bar are their own tickets.

### What I checked (UAT, 2026-10-26)

- Every `tracks-page/` and `library/` card carries `has_additional_resources.has_ai_kit`. It is `true` on 6 track
  cards, which are 5 courses (one sits in two tracks): exactly the 5 that `filter/?content_type=ai_kit` returns.
- `course-detail/{id}/?login_type=pre_login` for each of the 5 has `miscellaneous_data.ai_kit` with a PDF `url`.

### Decisions

1. **One implementation for both pages.** The click logic moves out of the course library, since a feature can't
   import another:
   - `core/models/course-resources.model.ts`: the types and `parseCourseResources`;
   - `core/constants/course-resources.ts`: the route and the copy;
   - `shared/services/course-ai-kit.ts`: the read and the "Additional Resources" dialog.

   The course library's `openAiKit` now delegates, with no behaviour change.

2. **The masterclass page turns it on** for the track rails and the signed-in rails (`showAiKit`, `aiKit` →
   `CourseAiKit.open`).
3. **The card's horizontal layout gains the button:** Trailer, AI Kit (the vertical layout's gradient ring), "i".
   The home page and instructor details don't turn it on, so they don't change. A `HorizontalWithAiKit` story is
   added.

### Verified (dev 4101)

- **Signed out:** 6 AI Kit buttons across 68 track cards. One opens "Additional Resources" with the PDF link, after
  one `course-detail` call.
- **Signed in:** an AI Kit course on Recommended For You shows the button and opens its kit. Continue Watching (no
  kit) shows none.
- **Course library:** the AI Kit filter gives 5 cards, and the vertical card's button still opens the dialog.
- **Home page:** 68 cards, no AI Kit button.

### The dialog's close button (the user's screenshot of the expected dialog)

- **The close button:** `UtilsDialog`'s close "X" is a dark filled circle again (`bg-background/80
backdrop-blur-sm`, 40 px). #133 had made it a bare ghost icon. The fill stays on hover; the icon turning white is
  the cue. Every `UtilsDialog` gets it.
- **The kit's description:** the row's second line is the kit's `description`. All 5 kits on UAT send `null`, so it
  reads "AI Kit" there; a kit with a description shows it.
- **Matching the expected dialog side by side:**
  - The gradient panel was capped at 500 px inside `app-dialog`'s 512 px (`max-w-lg`) frame, which left a 6 px
    grey strip down each side. The cap is now `md:max-w-lg`.
  - The X is `size="20" strokeWidth="2"`.
  - Checked at 1440 (frame and panel both 512) and 375 (both 338, no overflow).
