# Reel player on the web API (MIL-182, story 2 of the reels epic)

Story 2 of the epic "Reels: remove the old binding and rebind to the new Postman collection". Branch
`feat/MIL-182-reels-player-binding`, cut from MIL-181 and rebased onto `master` (`1f489408`) after #254 merged. The
epic and the reel access rules are in `prompts/reels-landing-binding.md`.

## Goal

Two steps, in this order, for the reel player (`/:country/:profession/micro-learning/:courseId/:courseTitle`):

1. **Remove the old binding.** Every read and write the player makes today goes to a legacy route, all of them 404
   on UAT, so the player shows "Failed to load reel" there. Its legacy calls, models and client-side rules come out
   first; nothing of the old shape is patched or mapped onto the new one.
2. **Rebind with the new Postman collection** (`postman/`, "Merged Masterclass App 7", export of 2026-11-03): the
   reel feed and its anchor, the access rules, progress, CPE / Preview mode, bookmark, share, About, Transcript and
   Glossary, and old numeric links. Types come from the new responses, reads are `httpResource`, writes go through
   `ApiClient`.

The steps after a reel (chapter quiz, final assessment, report, feedback, certificate) are Story 3. Until then
their buttons show one notice and make no request (see **Boundary with Story 3**).

## What was read

- The player: `micro-learning.routes.ts`; `pages/micro-learning-course/micro-learning-course.ts|html`;
  `components/micro-learning-reel-card`, `-reel-nav`, `-top-bar`, `-about-panel`, `-filter-sheet`,
  `-episode-grid`; `services/micro-learning-course-facade.ts` (1,017 lines); `models/micro-learning-course.model.ts`;
  `constants/micro-learning.ts`.
- What the podcast and masterclass pages already run on, to reuse: `CourseDetailFacade` (`connect()`, the
  `about-course/?slug=` lookup for old links, `parseCourseDetail`, `readCourseStepRefusal`), `COURSE_DETAIL_API`,
  `CourseChapterFacade` (the progress tracker: play vs seek, the furthest point, a save every 15 s, on pause, at the
  end and on leaving), `MasterclassCourseAbout` and the dialog-scoped `CourseDetailFacade` in
  `MasterclassCourseInfoDialog`, `MasterclassBookmarks`, `SUBSCRIPTION_DIALOG`, `setupCourseSeo`
  (`WebCourseSeoSource`).
- Postman: `web-masterclass-reels-feed-v1`, `-reels-feed-anchor-v1`, `-course-mode-v1`, `-chapter-start-v1`,
  `-course-progress-update-v1`, `-bookmark-v1`, `-course-detail-v1`, `-about-course-v1`.
- **Live UAT, 2026-11-12** (`course_type=nano_learning,micro_learning`):

  | Read                                          | Answer                                                                                                                   |
  | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `reels-feed/?login_type=pre_login`            | `{login_type, reels: <page>, filters}`; 4 reels; `page`/`page_size` and `reels.page`/`reels.page_size` both page it      |
  | `reels-feed/<uuid>/`                          | `{login_type, anchor, reels}`; `anchor` is the reel, `reels` the feed without it (count 3)                               |
  | `reels-feed/<unknown uuid>/`                  | 404                                                                                                                      |
  | `reels-feed/?login_type=post_login`, no token | 401                                                                                                                      |
  | a reel, signed out                            | `user_state.course_is_locked: true`, `chapter.hls_video_url: null`, `vertical_trailer_url` set                           |
  | `course-detail/<reel uuid>/`                  | the same keys as a masterclass's (`chapters[].transcript_text`, `miscellaneous_data.glossary`), both null on UAT's reels |
  - A feed item is the card (`MasterclassCourse` keys) plus `course_type`, `vertical_trailer_url`,
    `is_subscription_excluded`, `is_individually_purchasable`, `like_count`, `chapter` (`id`, `name`,
    `duration_seconds`, `hls_video_url`, `total_quiz_questions`) and `user_state` (`course_mode`,
    `course_is_locked`, `last_watched_position_seconds`, `max_watched_duration_seconds`, `is_video_completed`,
    `is_chapter_completed`, `assessment_status`, `feedback_submitted`, `action_status`, `liked_by_me`,
    `certificate_url`).
  - `user_state.cpe_mode_available` comes back live but is in neither the docs nor the collection, so the player
    doesn't read it (see **Risks**).

## Step 1: remove the old binding

| What the player uses today                                   | Legacy route or shape                                                                                                                                             | In this story                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| The feed and the reel by id, cursor-paged, numeric ids       | `NANO_LEARNING_ROUTES` (list, detail), `NanoLearningListResponse`, `NanoLearningPage`                                                                             | Removed                                                           |
| The landing page's hand-off                                  | `NANO_LEARNING_HANDOFF_KEY` (the landing page stopped sending it in MIL-181)                                                                                      | Removed                                                           |
| Progress: a heartbeat every 5 %, `completed` at 95 %, `exit` | `MASTERCLASS_ROUTES.myClassActivity`, `ReelActivityPayload` (numeric `chapterId`)                                                                                 | Removed                                                           |
| CPE / Preview                                                | `MASTERCLASS_ROUTES.setCpeMode` (`nano_learning_id`), the unused confirm `toggleCpeMode`                                                                          | Removed                                                           |
| Transcript and Glossary                                      | `MASTERCLASS_ROUTES.getCourseContent`                                                                                                                             | Removed                                                           |
| About                                                        | `FeatureFacade.getAbout`, `ContentAbout`, the shared `app-course-about`                                                                                           | Removed from the panel                                            |
| Bookmark                                                     | `Utils.toggleBookmarkCourse` (numeric id)                                                                                                                         | Removed from the player                                           |
| Client-side rules the contract moves to the server           | `deriveActionStatus`, `isReelCompleted` (95 %), `applyCourseDetails` / `pendingDetails`, `detailsToReel` / `canSeedReel`, `reelToContentDetails`, `examAttempted` | Removed                                                           |
| The 60-second free preview                                   | `PREVIEW_LIMIT_SECONDS`, `gated` (`Utils.canAccessCpeMode`), "Your free preview has ended"                                                                        | Removed (the API sends no stream to cut off)                      |
| The reel model                                               | `MicroLearningReel extends Content`, `ActionStatus` enum                                                                                                          | Removed (`MicroLearningOptionId` and the filter option type stay) |
| The episode grid                                             | `app-micro-learning-episode-grid` (commented out in the page, legacy `Content`)                                                                                   | Deleted, with the page's `goToEpisode` / `onGridScroll`           |

Left with no caller after this story, for the epic's clean-up Task: `Utils.toggleBookmarkCourse`'s reel branch, the
`micro_learning` keys of `FeatureFacade.getAbout`, `MASTERCLASS_ROUTES.myClassActivity` / `setCpeMode` /
`getCourseContent` (if nothing else calls them), `app-course-about` (if nothing else renders it).

## Step 2: rebind with the new Postman collection

### Locked decisions (proposed, for approval)

1. **One facade, rebuilt.** `MicroLearningCourseFacade` keeps its name, file and route (route-scoped,
   `autoProvided: false`) and is rewritten on the new types. The page and the reel card inject it; the card
   takes only its reel (see 9).
2. **The feed.** The page's `:courseId` opens `reels-feed/<uuid>/` (the anchor first, then the rest of page 1),
   `page_size=6`. Scrolling near the end reads `reels-feed/?page=n` and appends, skipping reels already listed.
   Both are `httpResource`s keyed on the reel and on the page asked for; `login_type` follows the session's boolean
   (`pre_login` on the server too, so the reel is in the server HTML; `post_login` in the browser). Signing in
   re-reads the anchor as `post_login` and the list restarts from it, so a reel unlocks in place.
3. **Old links.** A `:courseId` that isn't a UUID (an old numeric link) is looked up with
   `about-course/?slug=<:courseTitle>` first, as the course page does; an unknown one shows "We couldn't find
   this reel." The URL then carries the UUID and slug (`Location.replaceState`, as today).
4. **Access** (the user's rules, 2026-11-12). The server decides: `user_state.course_is_locked`.

   | Learner                              | Plays                                                               | Overlay and button                                                     |
   | ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
   | Signed out                           | `vertical_trailer_url`, looping, no tracking; the thumbnail if none | "Sign in to watch" → `/auth/login?redirect=<this reel>`                |
   | Signed in, `course_is_locked: true`  | the trailer, as above                                               | "Subscribe to watch" → the subscription dialog (`SUBSCRIPTION_DIALOG`) |
   | Signed in, `course_is_locked: false` | `chapter.hls_video_url`                                             | none; the mode and step button (5, 6)                                  |

   Signed out, the bookmark and the CPE button go to sign-in; share, About, Transcript and Glossary stay open.
   Locked, the bookmark works; the CPE button opens the subscription dialog. The overlay sits over the trailer's
   bottom third so the trailer stays visible. The rail's cart button (a link to the plan page on excluded or
   individually sold reels) is removed: the cart is out of scope for now (user, 2026-11-12).

5. **Progress** (entitled and signed in only). On a reel's first play in the visit: `chapter-start/<chapter id>/`
   (it creates the enrolment), then, when `course_mode` is null, `course-mode/<id>/ {mode: 'preview'}` without a
   toast: today's rule that a reel with no mode starts in Preview. Then the chapter page's tracker: the playhead
   and the furthest point played straight through, saved to `course-progress-update/<id>/` every 15 s of play, on
   pause, at the end, on leaving the reel and on leaving the page; a seek never counts as watched. The answer
   updates the reel's own state. Resume starts from `last_watched_position_seconds`. `reset_required` (an expired
   window) says so and re-reads the reel; refusals go through `readCourseStepRefusal`, as on the chapter page.
6. **CPE / Preview.** The button says "Watch in CPE mode" while the reel is in Preview, and one click posts
   `course-mode/<id>/ {mode: 'cpe'}` (no picker, as today). On a 200 the reel's progress resets
   (`progress_reset`) and playback restarts from 0. `403 caira_enrollment_required` (a learner outside CAIRA) shows
   the server's message and stays in Preview; `409 course_mode_locked` shows its message. The CPE / Preview tag on
   the card reads `user_state.course_mode`.
7. **The step button reads the server.** In CPE mode the button shows `user_state.action_status` as sent (Take
   Quiz, Take Final Assessment, Retake Final Assessment, Rewatch, Submit Feedback, Download Certificate), else
   Play / Pause / Resume. After the save that finishes a reel, the player re-reads that reel
   (`reels-feed/<id>/?page_size=1`, its `anchor`) so the button moves on. Rewatch restarts playback from 0 (the
   server has already erased the progress). The other steps are Story 3.
8. **Bookmark** goes through the root `MasterclassBookmarks` (`bookmark/<uuid>/`; a reel is a course), so the
   landing page's My List follows it. The heart reads `bookmarks.isBookmarked(reel)`.
9. **The reel card injects the facade** (the team's facade rule): it keeps its `reel` input (the row it draws) and
   reads everything else (active, preloaded, muted, the source, the overlay, the button, the tag) and calls every
   action (bookmark, share, button, menu, player events) on the facade. The page stops relaying outputs.
10. **About** opens the side panel, which now provides its own `CourseDetailFacade`, connected to the reel
    (`connect('reels', …)`), and renders the shared `MasterclassCourseAbout`, the way the masterclass course-info
    dialog does. `COURSE_DETAIL_API` gains `reels` (`urlSegment: 'micro-learning'`), which Story 3's exam pages
    need too.
11. **Transcript and Glossary** read `course-detail/<uuid>/` once per reel, on demand, cached for the visit:
    the chapter's `transcript_text` and `miscellaneous_data.glossary`, in the HTML dialog as today. None says
    "No transcript is available for this reel." (and the glossary's twin), as today.
12. **Share** stays `Utils.openShareDialog()`, with the reel's URL.
13. **SEO** keeps `setupCourseSeo({ kind: 'microLearning' })`, fed the active reel through a small computed in
    the page that names the `WebCourseSeoSource` keys (`name`, `mini_description`, …) from the feed item.

### Boundary with Story 3

Take Quiz, Take Final Assessment, Retake Final Assessment, Submit Feedback and Download Certificate show "This
step isn't available yet." (the existing `CHAPTER_QUIZ_UNAVAILABLE` notice, renamed `REEL_STEP_UNAVAILABLE`) and
make no request: their legacy flows (`Utils.startFinalAssessment`, the reel's `feedback` route on
`FeedbackFacade`, `Utils.openCertificateDownloadDialog`) can't run on a UUID. Story 3 replaces the notice with the
quiz, the shared exam / report / feedback pages and the certificate, and removes the reel's legacy `feedback`
route. The end of a reel in CPE mode only saves and re-reads (7); Story 3 adds the hand-off.

### Not in this story

- The top bar's filter sheet: its button is commented out in the top bar, and the sheet opens with no options and
  changes nothing. The feed's `filters` block and `field_of_study=` would bind it; that is a separate small ticket
  if wanted.
- Likes (`like_count`, `liked_by_me`): the heart stays the My List bookmark.

## Assumptions (reviewer, read first)

- **`course-detail/` for a reel passes `parseCourseDetail`**: same keys as a masterclass's on UAT (checked
  2026-11-12); confirmed in the browser before About is built on it.
- **Progress on a reel = one chapter**: the feed's `chapter` is the reel's only chapter, so
  `course-progress-update/` gets that chapter's id.
- **Signed-in reads are stubbed**: no test token. `post_login` feed items, `course-mode/`, `chapter-start/` and
  `course-progress-update/` answers are stubbed from the contract; one live pass once a session is available.
- **No reel on UAT is playable or has a transcript**: the entitled path is verified with a stubbed
  `hls_video_url` (a public test stream), and the transcript / glossary with stubbed text.

## Size and split (decided 2026-11-12: split in two)

The facade is rewritten (about 1,000 lines out, 600 in), the card about half rewritten, a new model, and the
page trimmed. As one PR that is about 1,500 changed lines, two thirds of them deletions. Under ~400 per PR it
splits into two tickets:

| PR  | Ticket                                         | What                                                                                                                                                                                                                                           | ≈ lines                  |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| A   | MIL-182 (this branch)                          | Step 1 in full; the model; the feed, old links and access (decisions 1–4); bookmark, share, About, Transcript, Glossary (8–13); the card on the facade (9). The entitled reel plays in whatever mode the server has; no progress is saved yet. | ~1,000, mostly deletions |
| B   | new ticket, `feat/MIL-XXX-reels-progress-mode` | Progress (5), CPE / Preview (6) and the server's step button (7).                                                                                                                                                                              | ~450                     |

The user chose the split (2026-11-12). PR A is this branch; PR B gets its own ticket and branch, cut from this one.

## Target code

```
features/offerings/
  models/reel.model.ts                      ← new: Reel, ReelChapter, ReelUserState, ReelActionStatus, ReelFeedPage,
                                              ReelAnchor, parseReelFeed, parseReelAnchor, parseCourseModeResult
  models/micro-learning-course.model.ts     ← keeps MicroLearningOptionId and MicroLearningFilterOption only
  constants/reels.ts                        ← new: REEL_COURSE_TYPES (LIBRARY_OFFERINGS.reels uses it too),
                                              REELS_FEED_URL, REELS_FEED_PAGE_SIZE, REEL_ACCESS_COPY, REEL_STEP_LABELS
  constants/micro-learning.ts               ← CHAPTER_QUIZ_UNAVAILABLE → REEL_STEP_UNAVAILABLE
  constants/course-detail.ts                ← COURSE_DETAIL_API.reels
  models/course-detail.model.ts             ← CourseOffering + 'reels'
  services/micro-learning-course-facade.ts  ← rewritten
  micro-learning/
    micro-learning.routes.ts                ← providers: [MicroLearningCourseFacade] (unchanged); the feedback
                                              route stays for Story 3
    pages/micro-learning-course/            ← trimmed: connect(), scroll, SEO adapter; no relayed outputs
    components/micro-learning-reel-card/    ← injects the facade; trailer / overlay / server state; no 60 s preview
    components/micro-learning-about-panel/  ← providers: [CourseDetailFacade]; MasterclassCourseAbout
    components/micro-learning-episode-grid/ ← deleted
```

```ts
// models/reel.model.ts
export type ReelCourseType = 'nano_learning' | 'micro_learning';
export type ReelActionStatus =
  | 'WATCH_IN_CPE_MODE' | 'TAKE_QUIZ' | 'TAKE_EXAM' | 'RETAKE_EXAM' | 'REWATCH' | 'FEEDBACK' | 'DOWNLOAD';
export interface ReelChapter { id: string; name: string; duration_seconds: number;
  hls_video_url: string | null; total_quiz_questions: number }
export interface ReelUserState { course_mode: CourseMode | null; course_is_locked: boolean;
  last_watched_position_seconds: number | null; max_watched_duration_seconds: number | null;
  is_video_completed: boolean; is_chapter_completed: boolean;
  assessment_status: 'not_attempted' | 'failed' | 'passed'; feedback_submitted: boolean;
  action_status: ReelActionStatus | null; liked_by_me: boolean; certificate_url: string | null }
export type Reel = MasterclassCourse & { course_type: ReelCourseType; vertical_trailer_url: string | null;
  chapter: ReelChapter; user_state: ReelUserState };
export interface ReelFeedPage { reels: Reel[]; page: number; hasNext: boolean }
export interface ReelAnchor { anchor: Reel; rest: ReelFeedPage }

// services/micro-learning-course-facade.ts (public surface)
connect(params: Signal<{ courseId: string; slug: string }>): void;  // the page's constructor
readonly reels: Signal<Reel[]>; readonly activeReel: Signal<Reel | null>;
readonly loading / notFound / loadError; reload(); loadNextPage();
access(reel): 'guest' | 'locked' | 'open'; source(reel): VideoSource[]; buttonLabel(reel): string;
onButton(reel); bookmark(reel); share(reel); openAbout(reel); openTranscript(reel); openGlossary(reel);
navigateToReel(id); onScrollSelect(id); muted / toggleMute(); isActive(id); isPreloaded(id);
// player events, keyed by the reel: videoTime(reel, t, d); videoPaused(reel); videoEnded(reel); leaveReel(reel)
```

## Endpoint map

| What                       | Route (`web-api/v1/masterclass/` unless noted)                                                                       | Auth                                | Read or write                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| The feed, opened on a reel | `GET reels-feed/<uuid>/?login_type=&course_type=nano_learning,micro_learning&page_size=6`                            | public (`post_login` needs a token) | `httpResource`                          |
| The next pages             | `GET reels-feed/?login_type=&course_type=…&page=n&page_size=6`                                                       | same                                | `httpResource`                          |
| A reel's fresh state       | `GET reels-feed/<uuid>/?…&page_size=1` (its `anchor`)                                                                | signed in                           | `ApiClient` read after a finishing save |
| An old numeric link        | `GET about-course/?slug=`                                                                                            | public                              | `httpResource`                          |
| Start                      | `POST chapter-start/<chapter id>/`                                                                                   | signed in                           | `ApiClient.call`                        |
| Progress                   | `POST course-progress-update/<course id>/ {chapter_id, last_watched_position_seconds, max_watched_duration_seconds}` | signed in                           | `ApiClient.call`, `SKIP_LOADING`        |
| Mode                       | `POST course-mode/<course id>/ {mode}`                                                                               | signed in                           | `ApiClient.call`                        |
| Bookmark                   | `POST bookmark/<uuid>/`                                                                                              | signed in                           | `MasterclassBookmarks`                  |
| About                      | `GET course-detail/<uuid>/` through the panel's own `CourseDetailFacade`                                             | public                              | `httpResource`                          |
| Transcript, Glossary       | `GET course-detail/<uuid>/` on demand, cached                                                                        | public                              | `ApiClient` read, parsed                |

## Phases

1. **Remove the old binding** (Step 1): the legacy calls, model, client-side rules, the 60-second preview and the
   episode grid. The page compiles against an empty feed.
2. **Model and constants:** `reel.model.ts` with its guards, `constants/reels.ts`, `COURSE_DETAIL_API.reels`.
3. **Feed:** anchor and pages, old links, URL sync, the active reel, scroll and next / previous, the empty and
   error states, SEO.
4. **Access and the card:** the card on the facade; trailer vs stream; the two overlays; the cart button removed.
5. **Bookmark, share, About, Transcript, Glossary.**
6. **(PR B if split) Progress, mode and the step button.**
7. **Write-up:** `STATE.md`, `docs/MASTERCLASS_PODCAST_AND_REELS.md` §9; checks; verification.

## Files touched

| File                                                                                           | Change                                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `features/offerings/models/reel.model.ts`                                                      | new                                                |
| `features/offerings/models/micro-learning-course.model.ts`                                     | legacy reel types removed                          |
| `features/offerings/models/course-detail.model.ts`                                             | `CourseOffering` + `'reels'`                       |
| `features/offerings/constants/reels.ts`                                                        | new                                                |
| `features/offerings/constants/micro-learning.ts`                                               | notice renamed and reworded                        |
| `features/offerings/constants/course-detail.ts`                                                | `COURSE_DETAIL_API.reels`                          |
| `features/offerings/constants/masterclass-library.ts`                                          | `LIBRARY_OFFERINGS.reels` uses `REEL_COURSE_TYPES` |
| `features/offerings/services/micro-learning-course-facade.ts`                                  | rewritten                                          |
| `features/offerings/micro-learning/pages/micro-learning-course/micro-learning-course.ts\|html` | trimmed                                            |
| `features/offerings/micro-learning/components/micro-learning-reel-card/*`                      | on the facade; trailer, overlays, server state     |
| `features/offerings/micro-learning/components/micro-learning-about-panel/*`                    | own `CourseDetailFacade`, `MasterclassCourseAbout` |
| `features/offerings/micro-learning/components/micro-learning-episode-grid/*`                   | deleted                                            |
| `docs/refactor/STATE.md`, `docs/MASTERCLASS_PODCAST_AND_REELS.md`                              | Now entry, step log; §9                            |

## Security requirements

- Reads through `httpResource` + `apiUrl()` (the on-demand ones through `ApiClient` with a guard); writes through
  `ApiClient.call()`. No hand-attached headers; no `app-api/`.
- Signed-in reads gated on the boolean `isAuthenticated()`; `post_login` only in the browser.
- Every response passes a guard; a drifted answer lands in an error state, not on screen.
- The player never decides entitlement: it plays what the server sends and shows the overlay the server's flag
  calls for.

## Acceptance criteria

- **Network:** no legacy request from the player; every call is `web-api/v1/` or `api/v1/` and every feed call
  sends `course_type=nano_learning,micro_learning`.
- **Opening:** a card or "Start watching" opens the player on that reel, then the rest of the feed; scrolling to
  the end loads the next page; next / previous and scroll move the active reel and the URL (UUID + slug); a
  refresh opens the same reel; an old numeric link opens the right reel; an unknown id shows "We couldn't find
  this reel."; a failed read shows an error with Try again.
- **Signed out:** every reel plays its vertical trailer with "Sign in to watch", which goes to sign-in and back to
  the same reel; bookmark and CPE go to sign-in; share, About, Transcript and Glossary work.
- **Signed in, locked:** the trailer with "Subscribe to watch", which opens the subscription dialog; bookmark
  works.
- **Signed in, entitled:** the full reel plays (stubbed stream); no overlay.
- **Bookmark** posts the reel's UUID, flips and toasts; the landing page's My List follows.
- **About** shows the reel's details; **Transcript / Glossary** show the text, or "No transcript is available for
  this reel." / its glossary twin.
- **PR B:** first play sends `chapter-start/`, then `course-mode/ preview` when the reel has no mode; saves every
  15 s of play, on pause, at the end and on leaving, never counting a seek; resume from the saved position; "Watch
  in CPE mode" switches, resets and restarts; `403 caira_enrollment_required` and `409 course_mode_locked` show
  the server's message; the step button follows `action_status`, and Rewatch restarts; the other steps show the
  notice.
- **Layout:** 375 / 768 / 1440 match today's player, apart from the new overlays.
- **Gates:** `pnpm lint` 0 errors; `node scripts/check-structure.mjs` green (prune what improves);
  `pnpm build:prod` within budget.

## Checks to run

```bash
pnpm lint
pnpm format:fix
node scripts/check-structure.mjs
pnpm build:prod
```

## How to verify

- **Dev server:** `pnpm start` (4101), English; restart it after `build:prod` if it goes stale.
- **Signed out, live UAT:** open a reel from the landing page and from "Start watching"; scroll, next / previous,
  refresh, an old numeric link, an unknown id; the trailer and "Sign in to watch"; share, About, Transcript,
  Glossary.
- **Signed in, stubbed:** feed items with `course_is_locked: true` (overlay, subscription dialog) and `false` with
  a public test stream (plays); bookmark; PR B's start, progress, mode and step-button paths, including each
  refusal.
- **Regression:** the landing page (MIL-181's checks), the masterclass and podcast course pages and the masterclass
  course-info dialog (they share `CourseDetailFacade` and `MasterclassCourseAbout`).
- **Layout:** 375 / 768 / 1440 screenshots before and after.

## Risks

1. **No playable reel on UAT** (every reel is locked signed out, and no test account): the entitled path is
   verified on stubs only. Ask the backend for a test account with a subscription, or one free reel.
2. **`cpe_mode_available`** is live but undocumented. The player relies on the `403 caira_enrollment_required`
   refusal instead; ask the backend whether the flag is meant to hide the CPE button.
3. **The page-1 overlap.** The anchor's `reels` leaves the anchor out, but later pages may repeat it; the append
   skips reels already listed.
4. **Two reads of `course-detail/`** when a learner opens About and then Transcript on the same reel (the panel's
   facade and the facade's cache don't share). Small; noted, not optimised.
5. **Between PR A and PR B** (if split) an entitled learner can watch but nothing is saved. Both land before the
   release, or B follows A closely.

## As built: PR A (2026-11-12)

Built as planned for PR A (Step 1 in full; decisions 1–4 and 8–13), with these details:

- **The reel card's menu now opens beside its button.** It is portalled to the body, and ng-primitives writes its
  `left` / `top` but never `position`, so without `absolute` it fell to the bottom of the page (the user avatar
  menu documents the same trap). It was never reachable before, because the player never loaded.
- **The access overlay has no button of its own:** the reel's main button says "Sign in to watch" /
  "Subscribe to watch", so there is one action per state.
- **`COURSE_DETAIL_API.reels.modeLabel` is `'Micro Learning'`**, the name the mode picker already knows.
- **`CHAPTER_QUIZ_UNAVAILABLE` (`constants/micro-learning.ts`) is deleted** with its last user; PR B adds the step
  notice it needs.
- **The poster is `NgOptimizedImage`** (`fill`), and the CPE credits pill shows the API's `total_cpe_credits`.
- **No progress is saved and the mode can't be changed in PR A**: an entitled reel plays and pauses in whatever
  mode the server has, and the CPE / Preview tag shows it.
- **The rail's cart button is removed** (user, 2026-11-12: the cart is out of scope for now), with its facade
  rule and the `is_subscription_excluded` / `is_individually_purchasable` keys the model read for it.
