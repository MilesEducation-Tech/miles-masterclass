# Reels landing page on the web API (MIL-181, story 1 of the reels epic)

Story 1 of the epic "Reels: remove the old binding and rebind to the new Postman collection". Branch `feat/MIL-181-reels-landing-binding`, off `master`
(`bd153073`, 4.2.0). The stories after it are listed under **Epic** at the end, with the reel access rules the user
decided on 2026-11-12. Those rules apply to the player (Story 2), not to this page.

## Goal

Two steps, in this order, for `/:country/:profession/micro-learning`:

1. **Remove the old binding.** Every read the page makes today goes to a legacy route, and every one of them
   answers 404 on UAT, so the page shows only its hero and FAQ there now. The page's calls, its legacy models and
   its legacy cards come out first; nothing of the old shape is patched or mapped onto the new one.
2. **Rebind with the new Postman collection.** The page is rebuilt on the routes and response shapes of the new
   collection (details under **Step 2**). On the web API a reel is a course with `course_type` `nano_learning` or
   `micro_learning` (UUID id), served by the same `web-api/v1/masterclass/…` routes as masterclass and podcast,
   with the same card. The page asks for both types at once: `course_type=nano_learning,micro_learning`.

The page keeps today's rows and order, and gets them from the shared `MasterclassLibraryFacade`, connected to a new
`reels` offering. The learner rows come from the reels' own route, `reels-activity/`, instead of `library/`.

## Step 1: remove the old binding

| What the page uses today                                                                            | Legacy route or shape                                                                                    | In this story                                                                                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Continue Watching, tracks, My List, mastered, Coming Soon: five `FeatureFacade.getResource(…)` rows | `FEATURE_ROUTES` (recently viewed, tracks, bookmarks, completed classes, coming soon) and `TRACK_ROUTES` | Removed from the page                                                                           |
| The cards: `app-vertical`, `app-coming-soon`                                                        | the legacy `Content` shape                                                                               | Removed from the page                                                                           |
| The carousels' legacy `filterConfig` (`courseType: 'nano_learning'`, numeric `trackId`)             | the legacy filter                                                                                        | Removed from the page                                                                           |
| The hero's "Start Watching" feed read                                                               | `NANO_LEARNING_ROUTES.getCourseList` (cursor-paged, numeric ids)                                         | Removed from the page                                                                           |
| The router-state hand-off to the player                                                             | `NANO_LEARNING_HANDOFF_KEY`, `NanoLearningPage`                                                          | The page stops sending it. The player still reads it until Story 2 removes its own old binding. |

Left with no caller after this story, deleted in the epic's clean-up Task (with the player's leftovers) so this PR
stays reviewable: `FeatureFacade.getResource` and its `FeatureResource` rows engine, and the shared `app-coming-soon`
card. `app-vertical` keeps its users (the player's episode grid, partners).

## Step 2: rebind with the new Postman collection

- **The collection:** `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`, the "Merged
  Masterclass App 7" export of 2026-11-03, the newest there is. Checked against live UAT on 2026-11-12 (below).
- **Types come from the new responses**, not from the old models: the `reels-activity/` rows are typed and
  guarded from its response (`ReelsActivity`, `parseReelsActivity`); the tracks, Coming Soon, filter and bookmark
  use the web types the masterclass and podcast pages already parse (`MasterclassCourse`,
  `MasterclassComingSoonCourse`), which the reel cards pass. Every answer passes a guard at the boundary.
- **Reads** are `httpResource` + `apiUrl()` on the facade; **writes** (bookmark, Remind Me) go through
  `ApiClient.call()`, then the affected read reloads.
- **The cards' inputs take the new shape** (`MasterclassCourse`); the response is never mapped back into `Content`.

## What was read

- The reels feature: `micro-learning.routes.ts`, `pages/micro-learning/micro-learning.ts|html`,
  `components/micro-learning-hero`, and the player's `MicroLearningCourseFacade` (for the hand-off it reads).
- The podcast landing page, which went through this same rebind (MIL-176, `prompts/podcast-landing-binding.md`):
  `pages/podcast/podcast.ts|html`, `constants/podcast.ts`.
- The shared pieces:
  - `services/masterclass-library-facade.ts`, `constants/masterclass-library.ts` and
    `models/masterclass-library.model.ts` (offerings level, `connect(offering)`, `LIBRARY_OFFERINGS`);
  - `core/models/masterclass-home.model.ts` (`MasterclassCourse`, `isMasterclassCourse`, `trackRail`);
  - `shared/components/cards/masterclass-course-card` (its vertical layout is the `app-vertical` design,
    class for class, over `MasterclassCourse`);
  - `shared/services/masterclass-rail-filter.ts` (`contentType` already allows `reel`);
  - `MasterclassBookmarks`, `CourseAiKit`, `ComingSoonCard`, `swiperConfigOdd` / `swiperConfigComingSoon`.
- Postman: `web-masterclass-reels-activity-v1`, `-tracks-page-v1`, `-coming-soon-v1`, `-filter-v1`,
  `-bookmark-v1`, `-reels-feed-v1`, `-reels-feed-anchor-v1`.
- **Live UAT, 2026-11-12, signed out** (`course_type=nano_learning,micro_learning`):

  | Read                                                                           | Answer                                                                                             |
  | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
  | `tracks-page/` (`tracks.page_size=100`, `tracks.courses.page_size=100`)        | 4 tracks; 3 hold reels (1, 1 and 2, all `micro_learning`), "Firm-Wide AI Operating Model" is empty |
  | `reels-activity/` (`continue_watching.page_size=100`, `my_list…`, `mastered…`) | 200, three empty blocks signed out (`pre_login`)                                                   |
  | `reels-activity/` with a bare `page_size`                                      | **400**, as on `library/`: each rail pages on its own key                                          |
  | `coming-soon/`                                                                 | 200, empty                                                                                         |
  | `filter/?content_type=reel`                                                    | the 4 reels                                                                                        |
  - A reel card passes `isMasterclassCourse` and adds `course_type`, `vertical_trailer_url`, `chapter`,
    `user_state`, `like_count`, `is_subscription_excluded`, `is_individually_purchasable` and `reels_subtype`.
  - `reels-activity/` rows are the feed's items (card, `chapter`, `user_state`), already narrowed to the asked
    `course_type`. Unlike `library/`'s `bookmarked`, My List needs no narrowing here.
  - UAT has no `nano_learning` reel yet; the backend has been asked for test data (see **Risks**).

## Locked decisions (proposed, for approval)

1. **One rows service for all three offerings.** `MasterclassLibraryFacade` gains a `reels` entry in
   `LIBRARY_OFFERINGS`. Two config changes make it fit:
   - `courseType` becomes `courseTypes: readonly WebCourseType[]`, sent comma-joined. Masterclass
     (`['course']`) and podcast (`['podcast']`) send exactly today's query strings.
   - A new `learnerRows: 'library' | 'reels-activity'` picks the signed-in read. Masterclass and podcast keep
     `library/` + `completed-course-section/`; reels read `reels-activity/` (one call for all three rows).
2. **Rows, in today's order:**
   1. Continue Watching (`continue_watching`)
   2. the tracks (`tracks-page/`, read by the facade itself: `ownTracks: true`)
   3. My List (`my_list`)
   4. Courses you've mastered (`mastered`)
   5. Coming Soon on Reels

   Headings are as today. An empty row is hidden.

3. **Cards.** The shared `MasterclassCourseCard` in its vertical (9:16) layout, which is today's `app-vertical`
   design over the web card. It gains one input, `pathSegment` (default `masterclass`), so a reel links to
   `/<country>/<profession>/micro-learning/<uuid>/<slug>`. The bookmark sits top right; on hover the card shows
   fields of study, short description, CAIRA badge, Trailer (and AI Kit when the reel has one).
   - **Trailer** opens the reel's `vertical_trailer_url` (falling back to `horizontal_trailer_url`) in the shared
     video dialog. `MasterclassCourse` gains an optional `vertical_trailer_url`, checked by its guard.
   - **The "i" (course info) button is left off** until Story 2, as podcast did: the info dialog lives in the
     masterclass sub-feature and the reel About panel comes with the player.
4. **Bookmarks** go through the root `MasterclassBookmarks` (`bookmark/<uuid>/`; a reel is a course). A change
   anywhere re-reads `reels-activity/`, so My List follows it.
5. **Filters.** Every row gets the shared rail filter with `content_type=reel`.
6. **Coming Soon** shows signed in only, with Remind Me, as on the masterclass and podcast pages. Today's reels
   page also shows it signed out, where Remind Me can't work: an intentional difference.
7. **"Start Watching"** (the hero's button) opens the first reel of the first track, which is already on the
   page and in the server HTML, so it needs no request of its own. With no tracks it scrolls to the rows, as
   today. Today it opens the first reel of the feed; the feed and the tracks hold the same reels, but the first
   one may differ. (The alternative is a one-row `reels-feed/` read; say so if you prefer it.)
8. **Hero and FAQ stay as they are.**
9. **Signed in or out, no paywall here.** Every card and the hero open the reel; the player decides what plays
   (the access rules under **Epic**). On this page:

   | Visitor                    | Sees                                                                        |
   | -------------------------- | --------------------------------------------------------------------------- |
   | Signed out                 | hero, the tracks, FAQ. The bookmark sends them to sign-in and back.         |
   | Signed in, no subscription | hero, their own rows, the tracks, Coming Soon. Bookmark and Remind Me work. |
   | Signed in, subscribed      | the same as above                                                           |

## Assumptions (reviewer, read first)

- **Card links before Story 2.** Until Story 2 merges, a card opens the player at the reel's UUID, and the player
  still reads the legacy routes by numeric id. On UAT the player fails today either way; Story 2 fixes it. The
  player's hand-off key (`NANO_LEARNING_HANDOFF_KEY`) stays until then; this page just stops sending it.
- **Signed-in rows are stubbed.** No test account token: `reels-activity/` `post_login` rows are stubbed from the
  live feed items, which the contract says they are.
- **SSR.** Signed out, the tracks render on the server and the browser reuses the response. Signed in, the
  learner rows load in the browser only, where the token lives.
- **`pathSegment` on a shared card** is a plain string input, so `shared/` still knows no feature.

## Size

About 450 changed lines, one PR: the facade and its config about 120, the page about 250 (mostly the old
template's deletions), the card, model and route a few each. If review needs it smaller, the facade change
(decision 1) goes first as its own PR, with masterclass and podcast unchanged.

## Target code

```
features/offerings/
  models/masterclass-library.model.ts    ← LibraryOffering + 'reels'; courseTypes; learnerRows; ReelsActivity + parseReelsActivity
  constants/masterclass-library.ts       ← LIBRARY_OFFERINGS.reels; REELS_ACTIVITY_URL / _PARAMS; the reels row configs
  services/masterclass-library-facade.ts ← courseTypes param; reelsActivity resource; rows by learnerRows
  micro-learning/
    constants/reels-landing.ts           ← new: REELS_FILTER_CONTENT_TYPE, REELS_COMING_SOON_HEADING / _SECTION_ID
    pages/micro-learning/micro-learning.ts|html ← rewritten on the facade, like podcast.ts|html
    micro-learning.routes.ts             ← providers: [MasterclassLibraryFacade, MasterclassRailFilter] on ''
core/models/masterclass-home.model.ts    ← MasterclassCourse.vertical_trailer_url? (+ guard)
shared/components/cards/masterclass-course-card/masterclass-course-card.ts ← pathSegment input
```

```ts
// models/masterclass-library.model.ts
export type LibraryOffering = 'masterclass' | 'podcast' | 'reels';
export interface LibraryOfferingConfig {
  courseTypes: readonly WebCourseType[];        // sent as `course_type=a,b`
  ownTracks: boolean;
  learnerRows: 'library' | 'reels-activity';    // which signed-in read builds the learner rows
}
export interface ReelsActivity {
  continueWatching: LibraryCourse[];
  myList: LibraryCourse[];
  mastered: LibraryCourse[];
}
export function parseReelsActivity(raw: unknown): ReelsActivity; // envelope → three pageOf(isLibraryCourse) blocks

// constants/masterclass-library.ts
reels: { courseTypes: ['nano_learning', 'micro_learning'], ownTracks: true, learnerRows: 'reels-activity' },
export const REELS_ACTIVITY_URL = `${environment.API.baseUrl}web-api/v1/masterclass/reels-activity/`;
export const REELS_ACTIVITY_PARAMS = {
  login_type: 'post_login',
  'continue_watching.page_size': RAIL_PAGE_SIZE,
  'my_list.page_size': RAIL_PAGE_SIZE,
  'mastered.page_size': RAIL_PAGE_SIZE,
} as const;

// services/masterclass-library-facade.ts
private readonly reelsActivity = httpResource<ReelsActivity>(…); // signed in, browser, learnerRows === 'reels-activity'
readonly railsAboveTracks; // reels: [Continue Watching]
readonly railsBelowTracks; // reels: [My List, Courses you've mastered]
// myListSync reloads whichever learner read the offering uses
```

```html
<!-- micro-learning.html, per row (the podcast page's shape) -->
<section [id]="rail.id">
  @defer (on viewport; prefetch on idle) {
  <app-carousel [cards]="rail.shown" [heading]="…" [swiperConfig]="swiperConfigOdd">
    <button carouselAction … (click)="railFilter.open(rail)">filter icon + count</button>
    <ng-template let-course>
      <app-masterclass-course-card
        [course]="course"
        layout="vertical"
        pathSegment="micro-learning"
        [showAiKit]="true"
        [showBookmark]="true"
        [bookmarked]="bookmarks.isBookmarked(course)"
        (trailer)="openTrailer($event)"
        (aiKit)="openAiKit($event)"
        (bookmark)="bookmarks.toggle($event)"
      />
    </ng-template>
  </app-carousel>
  } @placeholder { heading + 9:16 card skeletons, fixed height }
</section>
```

## Endpoint map

| Row                                  | Route (all `course_type=nano_learning,micro_learning`)                     | Auth                  | Read by                 |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------- | ----------------------- |
| Continue Watching, My List, mastered | `GET web-api/v1/masterclass/reels-activity/?login_type=post_login`         | signed in             | facade `reelsActivity`  |
| tracks                               | `GET web-api/v1/masterclass/tracks-page/?login_type=pre_login\|post_login` | both                  | facade `tracks`         |
| Coming Soon                          | `GET web-api/v1/masterclass/coming-soon/`                                  | signed in (page rule) | facade `comingSoon`     |
| Remind Me                            | `POST api/v1/masterclass/coming-soon/<uuid>/notify-me/`                    | signed in             | `toggleReminder`        |
| Bookmark                             | `POST web-api/v1/masterclass/bookmark/<uuid>/`                             | signed in             | `MasterclassBookmarks`  |
| Filter                               | `GET web-api/v1/masterclass/filter/?content_type=reel`                     | public                | `MasterclassRailFilter` |
| AI Kit                               | the existing `CourseAiKit` read                                            | public                | `CourseAiKit`           |

## Phases

1. **Remove the old binding (Step 1), first:** take the page's `FeatureFacade` rows, `ApiClient` feed read,
   hand-off, `Vertical` / `ComingSoon` cards and legacy `filterConfig` out. The page then renders the hero and
   FAQ only, the same as on UAT today.
2. **Rebind the facade (Step 2):** `courseTypes` and `learnerRows` in the config (masterclass and podcast
   unchanged), the `reelsActivity` read and its parser, built from the new collection's response, and the reels
   rows. Check the masterclass and podcast pages send the same requests as before.
3. **Card and model:** `pathSegment` on `MasterclassCourseCard`; optional `vertical_trailer_url` on
   `MasterclassCourse` and its guard.
4. **Rebind the page:** `reels-landing.ts` constants; rebuild `micro-learning.ts|html` on the facade
   (`connect('reels')`, `railFilter.contentType.set('reel')`); route providers; "Start Watching" from the
   first track.
5. **Confirm nothing old is left on the page:** no `FeatureFacade`, `NANO_LEARNING_*`, `Content` or legacy
   `filterConfig` import in `micro-learning.ts|html`. Nothing shared is deleted here (see Step 1 for what the
   clean-up Task takes).
6. **Write-up:** `docs/refactor/STATE.md` (Now entry, step log; MIL-178 marked merged as #251 and the podcast
   epic closed), then the checks and the verification.

## Files touched

| File                                                                             | Change                                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `features/offerings/models/masterclass-library.model.ts`                         | `reels`, `courseTypes`, `learnerRows`, `ReelsActivity`, `parseReelsActivity` |
| `features/offerings/constants/masterclass-library.ts`                            | config entries, `REELS_ACTIVITY_*`, reels row configs                        |
| `features/offerings/services/masterclass-library-facade.ts`                      | `reelsActivity` read, rows by `learnerRows`, joined `course_type`            |
| `core/models/masterclass-home.model.ts`                                          | optional `vertical_trailer_url` + guard                                      |
| `shared/components/cards/masterclass-course-card/masterclass-course-card.ts`     | `pathSegment` input                                                          |
| `features/offerings/micro-learning/constants/reels-landing.ts`                   | new                                                                          |
| `features/offerings/micro-learning/pages/micro-learning/micro-learning.ts\|html` | rewritten                                                                    |
| `features/offerings/micro-learning/micro-learning.routes.ts`                     | providers on `''`                                                            |
| `docs/refactor/STATE.md`                                                         | Now entry + step log                                                         |

## Security requirements

- Reads go through `httpResource` + `apiUrl()`; mutations through `ApiClient.call()`. No hand-attached headers.
- Signed-in reads are gated on the boolean `isAuthenticated()`, never the token.
- Every response passes a guard in `parse`; a drifted answer lands in `error()`, not on screen.
- No `app-api/`.

## Acceptance criteria

- **Network:** the page sends no legacy request; every call is `web-api/v1/` or `api/v1/`, and every list call
  carries `course_type=nano_learning,micro_learning` (the filter: `content_type=reel`).
- **Signed out:** hero, the reel tracks (UAT: 3 tracks, 4 reels), FAQ. No learner rows, no Coming Soon. The track
  list is in the server HTML.
- **Signed in:** Continue Watching above the tracks; My List and Courses you've mastered below them; Coming Soon
  last. Empty rows are hidden.
- **Cards:** 9:16 artwork, CAIRA badge, bookmark top right; hover shows fields of study, description, Trailer
  (AI Kit when there is one); a click opens `/<c>/<p>/micro-learning/<uuid>/<slug>`.
- **Trailer** plays the vertical trailer; a reel without one toasts "Trailer Not Found", as elsewhere.
- **Bookmark:** signed out, sign-in and back; signed in, it toggles with a toast and My List follows without a
  reload.
- **Filter:** opens on every row with reel facets; a selection narrows the row; "No courses match these filters."
  when nothing matches.
- **Start Watching** opens the first track's first reel; with no tracks it scrolls to the rows.
- **States:** skeletons hold the layout; a failed tracks read shows "We couldn't load the reels." with Try again;
  a failed learner read hides its rows and logs.
- **Masterclass and podcast pages unchanged:** same requests, rows, filter, Coming Soon and Remind Me.
- **Layout:** 375 / 768 / 1440 match today's page, apart from the listed differences (no "i" button until Story
  2; Coming Soon signed in only).
- **Gates:** `pnpm lint` 0 errors; `node scripts/check-structure.mjs` green (prune if a relative import goes
  away); `pnpm build:prod` within budget.

## Checks to run

```bash
pnpm lint
pnpm format:fix
node scripts/check-structure.mjs
pnpm build:prod
```

## How to verify

- **Dev server:** `pnpm start` (4101), English. Restart it after `build:prod`.
- **Signed out, live UAT:** `/us/cpa/micro-learning`. Tracks render; the network shows only `tracks-page/`
  (+ `filter/` on a filter click); `curl -s localhost:4000/us/cpa/micro-learning` after
  `pnpm build` and the `serve:ssr` script carries the reel titles.
- **Signed in, stubbed:** `reels-activity/` and `coming-soon/` stubbed with reel cards from the live feed. Check
  every row, empty-row hiding, bookmark (stubbed 200 / 500) and My List re-read, Remind Me (200 / 409 / 500),
  filter, Start Watching, and a 500 on `tracks-page/`.
- **Regression:** the masterclass and podcast pages signed out and signed in (same query strings, rows, filter,
  Coming Soon, Remind Me), and the home page's tracks.
- **Layout:** screenshots at 375 / 768 / 1440 before and after.

## Risks

1. **The facade change could regress masterclass or podcast.** Mitigation: their configs produce byte-identical
   query strings, checked in the network panel before and after.
2. **`reels-activity/` `post_login` is unverified live** (no test token). Stubbed from the contract and the feed
   item; one live check once a session is available.
3. **UAT data:** no `nano_learning` reel, and the 4 `micro_learning` reels are test rows. Ask the backend to add
   one nano reel and one micro reel with quiz questions and a transcript (they exist on the other backend's
   UAT). This page only lists them, so it isn't blocked.
4. **"Start Watching" may open a different first reel than today** (decision 7).

## Out of scope

- The player and its access rules (Story 2), the steps after a reel (Story 3), and deleting the legacy reel code
  (the clean-up Task).
- Likes (`like_count`, `liked_by_me`): the heart stays the My List bookmark.

## Epic

**Reels: remove the old binding and rebind to the new Postman collection.** Every reels page drops its legacy
routes (all 404 on UAT) and is rebuilt on the new collection (`postman/`, "Merged Masterclass App 7", export of
2026-11-03): types from the new responses, `httpResource` for reads, `ApiClient` for writes. Reels use
`course_type=nano_learning,micro_learning`. A `micro_learning` reel ends in a chapter quiz; a `nano_learning` reel
ends in the final assessment.

Every story runs the same two steps, in order: **1. remove the old binding**, **2. rebind with the new
collection**.

**Story 1: Reels landing page** (`feat/MIL-181-reels-landing-binding`, this plan)

1. Remove: the five `FeatureFacade` rows, the legacy feed read behind "Start Watching" and its hand-off, the
   legacy `Content` cards and filter.
2. Rebind: Continue Watching, My List and mastered from `reels-activity/`; tracks from `tracks-page/`; Coming
   Soon from `coming-soon/`; filters from `filter/?content_type=reel`; bookmark through `bookmark/<uuid>/`.

**Story 2: Reel player** (`feat/MIL-XXX-reels-player-binding`)

1. Remove: the player facade's legacy feed and detail reads (`NANO_LEARNING_ROUTES`, numeric ids, cursor
   paging), the router-state hand-off, the legacy progress write (`MASTERCLASS_ROUTES.myClassActivity`), the
   legacy mode switch (`MASTERCLASS_ROUTES.setCpeMode`), the legacy transcript and glossary read
   (`MASTERCLASS_ROUTES.getCourseContent`), the client-side 60-second preview, and the legacy reel model.
2. Rebind: `reels-feed/` and its `<uuid>/` anchor (page-based); the access rules below; progress
   (`chapter-start/`, `course-progress-update/`); CPE / Preview (`course-mode/`); bookmark; share; About
   (`about-course/`); Transcript and Glossary (`course-detail/`); old numeric links resolved by
   `about-course/?slug=`.

**Story 3: After the reel** (`feat/MIL-XXX-reels-learning-steps`)

1. Remove: the "quiz isn't available" stub (`CHAPTER_QUIZ_UNAVAILABLE`), the legacy final-assessment start
   (`Utils.startFinalAssessment`), the reel's feedback route on the legacy `FeedbackFacade` (webinar keeps it)
   and the legacy certificate dialog on the reel.
2. Rebind: the server's `action_status` button; the chapter quiz (`quiz-questions/`, `quiz-submit/`); the final
   assessment, report and feedback on the shared pages; the certificate (`user_state.certificate_url`).

**Task: Remove the legacy reels code** (`refactor/MIL-XXX-remove-legacy-reels-code`)

Delete the shared legacy code the stories left with no caller: `FeatureFacade.getResource` and its
`FeatureResource` rows engine, the `app-coming-soon` card, `NANO_LEARNING_ROUTES` and the legacy reel models,
and whatever else is left with no user.

### Reel access rules (user, 2026-11-12, for Story 2)

The trailer plays for anyone who can't watch the reel (option 1); the full reel plays for anyone entitled to it.
The server decides entitlement: `user_state.course_is_locked` on the feed, which also covers free and bought
reels. The player never works it out from the subscription record, so a subscriber whose `user-details/` read is
late or failed is never paywalled.

| Learner                                              | How the player knows                                                                           | What plays                                                             | The reel's button                                                         | Other actions                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Signed out**                                       | not signed in; feed read `pre_login` (every reel locked, no stream)                            | `vertical_trailer_url`, muted, looping; the vertical thumbnail if none | "Sign in to watch" → `/auth/login?redirect=<this reel>`                   | Bookmark and CPE mode → sign in. Share, About, Transcript, Glossary open. |
| **Signed in, not subscribed**                        | `post_login`, `course_is_locked: true`                                                         | the trailer, as above                                                  | "Subscribe to watch" → the app's subscription dialog (as the course page) | Bookmark works. CPE mode → the subscription dialog. No quiz or exam.      |
| **Signed in, subscribed** (or a free or bought reel) | `post_login`, `course_is_locked: false`, `chapter.hls_video_url` set                           | the full reel                                                          | Preview until the learner picks CPE, then the server's `action_status`    | Everything.                                                               |
| Subscribed, but outside CAIRA                        | `user_state.cpe_mode_available: false`, or `403 caira_enrollment_required` from `course-mode/` | the full reel, in Preview                                              | no CPE button; the server's message if CPE is refused                     | As above, without CPE mode.                                               |

- Signing in, or coming back after subscribing, re-reads the feed `post_login`, so the reel unlocks in place.
- The 60-second free preview goes: the API sends no stream to a learner who can't watch, so there is nothing to
  cut off.
- Open for Story 2: a reel that is `is_subscription_excluded` (a subscriber still can't watch it). The button
  then can't say "Subscribe"; ask product what it says, since buying a single reel goes to the plan page today.

## As built (2026-11-12)

Built as planned. Three details the plan didn't spell out:

- **`REELS_PATH_SEGMENT`** (`micro-learning/constants/reels-landing.ts`) holds the URL segment, which both the
  cards' `pathSegment` and "Start watching" use.
- **The learner-rows switch is named `learnerRows`** on `LibraryOfferingConfig`, typed `LearnerRowsSource`.
  `railsAboveTracks` / `railsBelowTracks` branch on it, and so does the bookmark re-read.
- **The tracks skeleton and the row placeholders are 9:16**, sized to `swiperConfigOdd` (1.5 / 3 / 4.5 cards per
  view), so the cards land where the placeholder was.
