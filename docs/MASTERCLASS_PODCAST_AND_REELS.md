# Podcasts and reels — Masterclass web API v1

How podcasts, micro-learning reels and nano-learning reels are served by the `web-api/v1/masterclass/` surface,
and how far this app is from it today. Read this before rebinding the podcast or micro-learning pages.

**Contract source:** the backend's "Masterclass API Surface" export (captured 2026-10-08, updated 2026-10-14;
71 routes across the `api/v1/`, `app-api/v1/` and `web-api/v1/` tiers), section "Course, podcast and reel". That
section is **declared from the code and URLconf on 2026-10-13, not captured**: every captured card on the page is
the masterclass course _From Financials to Advisory Insights_, so no podcast or reel payload has been seen yet.
Checked against live UAT (signed out, GET only) on 2026-10-15. Section 8 has what UAT actually holds.

The web app calls only `api/v1/` and `web-api/v1/`, never `app-api/` (AGENTS.md §6; ESLint enforces it). The
`app-api/v1/masterclass/` rows in the export are the mobile app's.

**The envelope.** Every response is `{success, message, data}`. `success` follows the HTTP status, and a failure
is `success: false` with `data.status: "error"`, `data.reason` and `data.errors[]`. An absent value is `null`,
never `""`, so `value.length` / `value.trim()` need `value ?? ''`.

## 1. The four course types

One set of routes serves four kinds of course. Every route returns **the same keys for all four**, pre- and
post-login. Only the values and the behaviour differ.

| `course_type`    | What it is            | `content_type` (legacy) | `reels_subtype` (legacy) | Frontend URL segment |
| ---------------- | --------------------- | ----------------------- | ------------------------ | -------------------- |
| `course`         | a masterclass course  | `Courses`               | `null`                   | `masterclass`        |
| `podcast`        | a podcast course      | `Podcast`               | `null`                   | `podcast`            |
| `nano_learning`  | a nano-learning reel  | `Reels`                 | `Nano Learning`          | `micro-learning`     |
| `micro_learning` | a micro-learning reel | `Reels`                 | `Micro Learning`         | `micro-learning`     |

- **Read `course_type` only.** It sits on every course row and supersedes `content_type` and `reels_subtype`.
  (The library's AI Kit filter still reads `content_type`. That is a filter value, not a type check.)
- "Reels" in the header nav means both reel types. The URL segment is the kebab-case `micro-learning` for both,
  while the API tokens are snake_case. Never use one where the other belongs.
- "Masterclass" is the product, and `course` is the type. A masterclass course page reads `course_type: "course"`
  on `course-detail/`.

## 2. `course_type` on requests

| Route kind                                                                                                                                                                                      | `course_type`                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every list route (`tracks-page/`, `highlight/`, `ai-labs/`, `filter/`, `library/`, `reels-feed/`, `course-section/`, `completed-course-section/`, `courses-by-level/`, `all-instructors-page/`) | **Required.** One or more values, comma-separated: `?course_type=nano_learning,micro_learning`. Missing, empty or unknown is a `400 invalid_query` ("Field required"). It never defaults to `course`. |
| Single-course GETs (`course-detail/<id>/`, `about-course/`, `course-progress/<id>/`, …) and every POST                                                                                          | **Not taken.** The id in the path names the course.                                                                                                                                                   |
| `coming-soon/`, `levels/`, `levels-progress/`, `feedback-responses/`, `instructor-detail/<id>/`                                                                                                 | Not taken. A coming-soon row has no type.                                                                                                                                                             |
| `global-search/`                                                                                                                                                                                | Optional, and no client sends it: the server infers it when the whole `q` is `reels`, `podcast`, `nano learning` or `micro learning`. A sent value wins.                                              |

Route-specific rules:

- **`reels-feed/`** takes only `nano_learning` and/or `micro_learning`. `course_type=podcast` is a 400 ("is not a
  reel"), verified live.
- **`library/`**: the `popular` and `bookmarked` rails show **every** type whatever `course_type` says. The
  other rails follow it. Verified live: `course_type=micro_learning` returned 10 popular rows, all
  `course_type: "course"`.
- **This app's choice for the home and masterclass rails** (MIL-XXX, 2026-10-15): `course_type=course`
  (`MASTERCLASS_COURSE_TYPE` in `core/constants/masterclass.ts`), because those cards link to `/masterclass/`.

## 3. Behaviour by type

The keys don't differ by type, but the behaviour does. The nano reel is the structural outlier: it is the only
type with no chapter quiz, and the only one that erases watch progress on a failed attempt.

| Type             | Chapter quiz | Final assessment          | On a fail                                           | Notes                                                                              |
| ---------------- | ------------ | ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `course`         | per chapter  | pass mark per course      | retake, progress kept                               | chapters unlock in order                                                           |
| `podcast`        | per chapter  | pass mark per course      | retake, progress kept                               | a chapter may serve **`.mp3`** as well as `.m3u8`, in the same `hls_video_url` key |
| `micro_learning` | yes          | pass mark per course      | retake, progress kept                               | a one-chapter course                                                               |
| `nano_learning`  | **none**     | 2 questions, 100% to pass | **watch progress ERASED**: rewatch, then exam again | always **0.2 CPE** (NASBA 7.02.10); 10 to under 20 minutes                         |

The rules a podcast or reel inherits from the course flow (captured on the course):

1. **Enrol / start.** `POST chapter-start/<chapter_id>/` creates the enrolment and is idempotent. Chapter N+1
   stays locked until chapter N is complete.
2. **Watch.** Completion is judged on `max_watched_duration_seconds`, so a progress update must carry the full
   duration to complete.
3. **Quiz** (not on nano). `is_mcq_completed` flips only when the answered count reaches the config's
   `questions_to_show`. A chapter is complete only when its video **and** its quiz are.
4. **Final assessment.** `assessment-start/` draws or resumes a sitting, then `assessment-questions/` and
   `assessment-submit/`. The captured course answer is `{passed, score_percent, answers[], next_step:
"feedback"}`. The summary also declares `action_status`, and `progress_reset` for a failed nano reel; neither
   is captured yet.
5. **Feedback.** `feedback-submit/` awards the badge, the CPE and the certificate.

## 4. CPE mode and Preview mode

These apply to all four types alike. Both need access to the course: a CAIRA enrolment, an Ops grant or a live
subscription.

| Mode      | What the learner gets                                                 | Rules                                                                                                                                  |
| --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `cpe`     | video, quizzes, final assessment, feedback, badge, CPE, certificate   | the full flow                                                                                                                          |
| `preview` | **video only**: no quiz, no assessment, no feedback, never any credit | switching mode **erases in-flight progress**, and the mode **locks** once the final assessment is attempted (`409 course_mode_locked`) |

- **Switch:** `POST web-api/v1/masterclass/course-mode/<course_id>/` with exactly `{"mode": "cpe"}` or
  `{"mode": "preview"}`. Any other key is refused. (No card yet.)
- **Read:** `course_mode` and `is_preview_mode` on `course-detail/` and `course-progress/`.
- `course-detail/?login_type=post_login` also takes `mode` (post-login only).

## 5. Reel `action_status`

A reel card's next-step button is **decided by the server**. Render the button you are handed; never derive one
from progress, assessment or feedback fields.

| `action_status` | Meaning                                            | Applies to  |
| --------------- | -------------------------------------------------- | ----------- |
| `null`          | no mode chosen, Preview, or still watching         | nano, micro |
| `TAKE_QUIZ`     | video watched, chapter quiz pending                | micro       |
| `TAKE_EXAM`     | ready for the final assessment                     | nano, micro |
| `RETAKE_EXAM`   | last attempt failed, progress kept                 | micro       |
| `REWATCH`       | attempt failed, watch progress erased; watch again | nano        |
| `FEEDBACK`      | assessment passed, feedback pending                | nano, micro |
| `DOWNLOAD`      | done; the certificate is available                 | nano, micro |

## 6. The web routes a podcast or reel uses

All under `web-api/v1/masterclass/`. "No card" means the route is declared but no payload was captured.

**Lists** (all paginated: see "Paging" below)

| Route                                        | Params                                                                                                                                    | Notes                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET reels-feed/`                            | `course_type` (nano/micro only), `login_type`, `page`, `page_size`                                                                        | the feed, unwatched first. No card. Live: `data: {login_type, reels: <page>}`                                                                                                                        |
| `GET reels-feed/<course_id>/`                | same                                                                                                                                      | the feed opened on one reel: the anchor, then the rest. No card                                                                                                                                      |
| `GET library/`                               | `course_type`, `login_type`, `<rail>.page`                                                                                                | rails `popular`, `latest`, `in_progress`, `bookmarked`, `recommended`, `complimentary`, `because_you_watched`, plus `company_name`. `post_login` without a token: `authentication_required`. No card |
| `GET filter/`                                | `course_type`, `instructor`, `field_of_study`, `additional_category`, `level`, `cpe_credit`, `track`, `content_type`, `page`, `page_size` | the course library page (bound by MIL-84)                                                                                                                                                            |
| `GET tracks-page/`, `highlight/`, `ai-labs/` | `course_type`, plus each route's own params                                                                                               | home and masterclass rails; `course_type=course` here                                                                                                                                                |

**One course** (no `course_type`; the id is a UUID)

| Route                                                                                                                                                         | Use                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET course-detail/<id>/?login_type=…`                                                                                                                        | the course page. `course_details` carries `course_type`, `course_mode`, `is_preview_mode`, `enrollment`, `exam_rules`, `horizontal_trailer_url`, and `chapters` (a page: `hls_video_url`, `duration_seconds`, `show_quiz`, `total_quiz_questions`, `is_locked`, `transcript_text`, `user_chapter_progress`) |
| `GET about-course/?course_id=` or `?slug=`                                                                                                                    | the About content (exactly one of the two)                                                                                                                                                                                                                                                                  |
| `GET enrollment/<id>/`                                                                                                                                        | the 365-day enrolment window                                                                                                                                                                                                                                                                                |
| `POST bookmark/<id>/`                                                                                                                                         | toggle the bookmark                                                                                                                                                                                                                                                                                         |
| `POST chapter-start/<chapter_id>/`                                                                                                                            | start a chapter; creates the enrolment                                                                                                                                                                                                                                                                      |
| `GET course-progress/<id>/`                                                                                                                                   | every chapter's progress plus the UI flags (`show_quiz`, `show_final_assessment`, `show_feedback`, `is_course_closed`, `course_mode`, `is_preview_mode`, …)                                                                                                                                                 |
| `POST course-progress-update/<id>/`                                                                                                                           | `{chapter_id, last_watched_position_seconds, max_watched_duration_seconds}` or `{updates: [...]}`                                                                                                                                                                                                           |
| `GET quiz-questions/<chapter_id>/`, `POST quiz-submit/<chapter_id>/`                                                                                          | the chapter quiz, one question per submit: `{question_id, selected_option_ids}`. Not for nano                                                                                                                                                                                                               |
| `POST assessment-start/<id>/`, `GET assessment-questions/<id>/`, `POST assessment-submit/<id>/`, `GET assessment-result/<id>/`, `GET assessment-report/<id>/` | the final assessment                                                                                                                                                                                                                                                                                        |
| `GET feedback-questions/<id>/`, `POST feedback-submit/<id>/`, `GET feedback-responses/?course_id=`                                                            | feedback                                                                                                                                                                                                                                                                                                    |
| `POST course-mode/<id>/`                                                                                                                                      | CPE / Preview (section 4). No card                                                                                                                                                                                                                                                                          |

**Paging.** Every `web-api/v1/` list is a block of `{slug, count, page, page_size, total_pages, has_next,
has_previous, next, previous, results}`. The default size is 6 and the ceiling is 100. A route with one list
takes `?page=` / `?page_size=`. A route with several lists addresses each by its key, as in
`?in_progress.page=2`, and a bare `?page=` there is a 400.

## 7. What isn't captured yet

Seven routes on the surface have no captured payload. Build against the contract above and parse defensively:

- `web-api/v1/masterclass/library/`
- `reels-feed/` and `reels-feed/<course_id>/`
- `levels/`
- `course-mode/<course_id>/`
- the app-only `global-search/` and `course-mode/`

Three gaps are open on the **universal** `api/v1/masterclass/` routes. The web routes have the fix, so they
matter only to the mobile app:

1. A chapter with no quiz never completes, so a nano reel's assessment stays locked.
2. A failed nano assessment doesn't erase watch progress.
3. Preview mode isn't refused by the quiz and assessment steps.

## 8. Live UAT snapshot, 2026-10-15 (signed out, GET only)

- **No podcasts or reels exist on the new surface yet.**
  - `filter/?course_type=podcast` and `filter/?course_type=nano_learning,micro_learning`: `count: 0`.
  - `reels-feed/?course_type=micro_learning` and `?course_type=nano_learning`: `count: 0`.
  - `tracks-page/?course_type=podcast`: 4 tracks, every one empty.
  - Asking the rails for all four types returns the same rows as `course`.
- **Without `course_type`**, `highlight/`, `tracks-page/` and `ai-labs/` all answer `400 invalid_query`.
- **`course-detail/`** sends `course_type`, `content_type`, `reels_subtype`, `horizontal_trailer_url` and
  `trailer_horizontal_thumbnail_image_url`.

So nothing podcast- or reel-shaped can be verified end to end until the backend loads content on UAT.

## 9. This app vs the contract (2026-10-15)

The podcast and micro-learning pages have **not been rebound**: every read and write they make goes to the
legacy API, which answers 404 on UAT (`prompts/envelope-fallout.md`). What a rebind has to change:

**Legacy routes still called**

- Podcast:
  - reads: `v2/podcast/details/` (via `v2/:course_type/details/`), `v2/chapters/`, `v2/course-content/`,
    `v2/dashboard/related_content/`
  - writes: `v2/user/myclassactivity/`, `user/customaction/set_cpe_mode/` (which sends `masterclass_id` for a
    podcast), `user-quiz-details/`, `v2/user/toggle-bookmark/`
  - The loaders are in `features/offerings/utils/course-load.ts` and the root `MasterclassFacade`.
- Reels: `v2/nano-learning/` and `v2/nano-learning/<id>/` with cursor paging, `chapter-quiz`,
  `v2/library/:id/about/` (in `features/offerings/services/micro-learning-course-facade.ts`).
- Both:
  - `user-assessment/*`, `final-assessment/` (`final-assessment-facade.ts`)
  - `feedback-category/`, `user-feedback/*` (`feedback-facade.ts`, which always sends `master_class__id`)
  - the landing pages' `FeatureFacade` feeds (`v2/dashboard/`, `v2/user/*`, `v2/tracks/…`)

**Model and id mismatches**

- Ids are numeric everywhere: `Number(id)` / `+id` in `podcast-course.ts`, `podcast-chapter.ts`,
  `micro-learning-course.ts`, `course-feedback.ts`, `final-assessment-facade.ts` and `Utils`. A UUID becomes
  `NaN`.
- `MicroLearningReel` (`features/offerings/models/micro-learning-course.model.ts`) extends the legacy `Content`.
  It plays `video_url`, not `hls_video_url`, and needs both `id` and `chapter_id`.
- `core/models/nano-learning.model.ts` is an empty file.
- No single `course_type` union covers the four types. `CourseOffering` (`constants/course-detail.ts`) is
  `'masterclass'` only, and `toApiCourseType` (`Utils`) folds `nano_learning` into `micro_learning`.

**Behaviour the contract moves to the server**

- `action_status` is derived client-side by `deriveActionStatus`:
  - It returns `null` in Preview even when the server sent a value.
  - It is overridden locally with `TAKE_QUIZ` / `TAKE_EXAM`.
  - When the status is `null`, it is rebuilt from the feedback and assessment fields.

  Section 5 says to render the server's value as sent.

- The reel quiz branch keys on the literal `'micro_learning'` (`handleVideoEnded`), and the no-status fallback can
  still open the chapter quiz for a nano reel.
- Nothing resets local `last_activity` after a failed nano exam, so the 95% gates keep blocking heartbeats until
  a reload. The contract erases the progress server-side and answers `REWATCH`.
- Completion is client-side: `isReelCompleted` (95% of `total_duration`) and the podcast's 95% heartbeat. The
  contract judges completion on `max_watched_duration_seconds` via `course-progress-update/`.

**Players**

- `.mp3` in `hls_video_url`: `AudioChapter` handles it (anything not `.m3u8` / `.mp4` / `.ogg` / `.wav` is
  `audio/mpeg`). But `VideoChapter` and the reel card label any non-`.m3u8` URL `video/mp4`, and every check
  uses `endsWith`, which a query string breaks.
- The podcast picks its player with `podcast_format === 'Audio'`, which is case-sensitive, and the web API sends
  no `podcast_format`. The rebind has to choose the player from the source's MIME type instead.

**Links**

- Every web-API card (`MasterclassCourseCard`, the masterclass slider) links to `/masterclass/<uuid>/<slug>`.
  That includes the course library's Podcast and Micro Learning tabs. Once the backend serves those types, the
  card has to route by `course_type`: `course` → `masterclass`, `podcast` → `podcast`, and both reel types →
  `micro-learning`.
- The micro-learning landing page mixes types: `completed` sends `micro_learning` and the other lists send
  `nano_learning`.

## 10. Open questions for the backend

1. When will UAT hold podcasts and reels on the new surface? Nothing in sections 1–6 can be verified until then.
2. Should `library/`'s `popular` and `bookmarked` rails really ignore `course_type`? The Podcast and Micro
   Learning tabs would show masterclass courses.
3. The cards for `library/`, `reels-feed/` and `course-mode/`: the declared contract is all we have.
4. `assessment-submit/`'s `action_status` and `progress_reset` for a failed nano reel: what is the exact shape?
5. Does a podcast chapter say whether it is audio or video, or should the client go by the `hls_video_url`
   extension?
