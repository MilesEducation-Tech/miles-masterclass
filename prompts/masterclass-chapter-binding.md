# Bind the masterclass chapter page to `course-detail` (MIL-67)

Second subtask of Story MIL-65 (`feat(offerings): bind the masterclass chapter page to the web API`), on
`feat/MIL-65-masterclass-chapter-page-binding`, after MIL-66 (`prompts/masterclass-chapter-remove-v2.md`) removed the
retired v2 bindings. Both commits land in one PR.

**Revised 2026-10-13.** The first draft was written before the split. Re-checking it against the code, live UAT and the
current Postman export changed four things: the player, `chapter-start`, the final-assessment card and the lock
ladder. They are in "What changed since the first draft".

## Assumptions

1. **One read, one write.** The page reads `course-detail` (post-login) and calls `chapter-start` when a chapter opens.
   Saving progress and the chapter quiz stay follow-ups.
2. **The signed-in shape is known.** Postman says both login states "carry the identical key set". The live pre-login
   payload gives every key and its type, and the Postman examples captured from live calls give the signed-in values
   (`user_chapter_progress` booleans and numbers, `enrollment {started_at, expires_at, days_remaining}`). Every learner
   field is still typed nullable and checked at the trust boundary.
3. **I can't sign in on UAT** (no OTP mail to temp inboxes). The signed-in flow is verified with intercepted responses
   built from real payloads (see "How to verify"), and by you with a real account.

## What changed since the first draft

| Draft said                                         | Now                                                                                                                                                                       | Why                                                                                                                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retype the shared `video-chapter`; podcast adapter | **A new offering-wide player on the facade**, `offerings/components/course-chapter-player`. `video-chapter` stays untouched for podcast                                   | No adapter, no edits to podcast (dead on UAT anyway), and the player injects its facade as the reviewer asks. It's offering-wide like `CourseDetailFacade`, so podcast moves onto it later and `video-chapter` is then deleted |
| Final-assessment entry: `'start'`                  | **Hidden** until the assessment ticket                                                                                                                                    | "Start Exam" calls `user-assessment/start_assessment/`, which is gone (Django "Page not found"). The web `assessment-start` belongs to that ticket                                                                             |
| `chapter-start` in follow-up 1                     | **In MIL-67**                                                                                                                                                             | Postman: "THE FIRST WRITE OF THE WHOLE LEARNING FLOW. A learner has no `UserEnrollment` until this runs". The `mode=` switch is stored on the enrollment, so it can't work without it                                          |
| All chapter state on `CourseDetailFacade`          | **A route-scoped `CourseChapterFacade`** on the chapter route, injecting the hoisted `CourseDetailFacade`. `CourseDetailFacade` gains only the model fields and `setMode` | `CourseDetailFacade` is already 391 lines and serves the course page. The chapter page's state and actions get their own facade                                                                                                |

## Goal

`/…/masterclass/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle` shows a signed-in learner the real chapter:

- the chapter's name, description, poster and HLS stream, with resume and seek rules from their progress
- the previous and next chapter cards, the next one locked when the server's ladder says so
- the transcript, from the payload
- CPE or preview mode: asked once if not set, and the "Switch to CPE Mode?" prompt after chapter 1 in preview
- a locked course, locked chapter or unknown chapter sends the learner back to the course page with a reason

## What I read

- **The page after MIL-66:** route inputs, the back link and an unbound player.
- **`CourseDetailFacade`** (391 lines):
  - It reads `course-detail` on `httpResource`, `post_login` when signed in, with `parseCourseDetail` at the trust
    boundary.
  - It exposes `course()`, `chapters()` (with `slug`), `notFound()` and `loadError()`, and is connected by
    `connect()`.
  - It's provided on the course page's `''` child only. `watch()` opens chapter 1.
- **The legacy `video-chapter`:**
  - Inputs and outputs only (two facades use it). It covers the quiz panel, the final-assessment cards, Track Quiz and
    a transcript fetched from `v2/course-content/`.
  - Podcast is its only other user, and podcast's routes are 404 on UAT.
- **The legacy launch flow (`MasterclassFacade`):**
  - With no mode, it opens the `select-cpe-mode` dialog (`{type: 'Masterclass'}` → `{cpe_mode_status}`) before the
    chapter.
  - The MIL-25 course page dropped that step, so a new learner reaches the chapter with `course_mode: null`.
- **Live `course-detail`** (UAT, pre-login, course `bcb813bc…`, 8 chapters):
  - Chapter keys: `hls_video_url`, `transcript_text`, `is_locked`, `show_quiz`, `user_chapter_progress` (9 fields, all
    `null` before a start) and more.
  - The ladder: chapter 1 unlocked, 2–8 locked. Locked chapters carry no `transcript_text`.
  - Course keys: `course_is_locked`, `course_mode`, `is_preview_mode`, `course_pop_up_remark`, `enrollment` and the
    final-assessment flags.
- **Postman, web `course-detail`:**
  - `mode=cpe|preview` is post-login only. Omit it to keep the stored mode.
  - `409 course_mode_locked` comes with `current_mode`.
  - `401 authentication_required` for `post_login` without a token.
- **Postman, `chapter-start`:**
  - Guards run in order: `404`; `409` AI Lab lock; `403 caira_access_required`; `403 chapter_locked`;
    `200 reset_required` (the enrollment window expired and was restarted); `409 already_started_via_7dc`.
  - Its `200` returns `enrollment` and the chapter's `user_chapter_progress`.

## Endpoint map: probed on UAT today

| Call                                                                                          | Status                         | In MIL-67        |
| --------------------------------------------------------------------------------------------- | ------------------------------ | ---------------- |
| `GET web-api/v1/masterclass/course-detail/{id}/?login_type=post_login&chapters.page_size=100` | live                           | **read**         |
| the same `GET` with `&mode=cpe\|preview`                                                      | live, post-login only          | **mode switch**  |
| `POST web-api/v1/masterclass/chapter-start/{chapter_id}/`                                     | live (401 signed out)          | **chapter open** |
| `POST web-api/v1/masterclass/course-progress-update/{course_id}/`                             | live                           | follow-up 1      |
| `GET quiz-questions/{chapter_id}/`, `POST quiz-submit/{chapter_id}/`                          | live                           | follow-up 2      |
| `POST web-api/v1/masterclass/assessment-start/{course_id}/`                                   | live (401 signed out)          | follow-up 3      |
| legacy `user-assessment/start_assessment/`, `v2/course-content/`, the MIL-66 list             | gone (Django "Page not found") | not called       |

## Locked decisions

1. **Facades.**
   - **`CourseDetailFacade` moves up** to the `:courseId/:courseTitle` parent route, so the course page and every
     chapter share one instance and one `course-detail` read. The course-info dialog keeps its own instance.
   - **`CourseDetailFacade` gains `setMode(mode)`:** an `ApiClient` GET of `course-detail` with `mode=`, whose response
     replaces the course, so there is no second read. On `409 course_mode_locked` it toasts the server's message and
     changes nothing.
   - **New `CourseChapterFacade`** (`offerings/services/course-chapter-facade.ts`, `@Service({ autoProvided: false })`,
     on the chapter route). It owns:
     - `connect(chapterId)`
     - `navigation`: previous, current, next and index
     - `isCpeMode`
     - the lock redirects
     - `startChapter`, the mode prompt, `goTo(chapter)`, `openTranscript()`, and local completion
2. **Model** (`course-detail.model.ts`, only what's read, with guards):
   - **`MasterclassChapter` gains:**
     - `hls_video_url: string | null`
     - `transcript_text: string | null`
     - `is_locked: boolean`
     - `user_chapter_progress: MasterclassChapterProgress`, every field nullable
   - **`MasterclassCourseDetail` gains:**
     - `course_is_locked: boolean`
     - `course_mode: 'cpe' | 'preview' | null`
     - `course_pop_up_remark: string | null`
   - **New `ChapterStartResult`:** `reset_required`, `is_locked` and `user_chapter_progress`.
   - **Kept as `string`:** `chapter-start`'s refusals are read through the existing error reader, and the `reason`
     codes stay plain strings.
3. **Opening a chapter**, in order, once the course has loaded:
   - **`course_is_locked`:** back to the course page, with `course_pop_up_remark` or "Subscribe to watch this course".
   - **A chapter id not in the list:** back to the course page.
   - **The chapter `is_locked`:** back, with "Finish the previous chapter first".
   - **Otherwise `POST chapter-start`:**
     - `403 chapter_locked`: back, with the same message.
     - Any other `403`/`404`/`409`: back, with the server's message.
     - `200 reset_required: true`: an info toast ("Your enrolment restarted, so your progress was reset"), then the
       course is re-read.
   - **After a successful start, if `course_mode` is null:** open the existing `select-cpe-mode` dialog, then
     `setMode()`. Closing it without a choice goes back to the course page.
4. **Player** (`offerings/components/course-chapter-player/`, injects `CourseChapterFacade`):
   - **Shows:** the video (shared `VideoJs`), name, description, poster, the previous and next cards with "N Quiz
     Questions" (`total_quiz_questions`), and the transcript button (shown only when `transcript_text` is set; it opens
     the existing HTML dialog with no request).
   - **CPE mode** (`course_mode === 'cpe'`): seeking ahead is blocked (`PlayerMode.CPE`) unless `is_video_seekable` or
     `is_video_completed`. Preview mode seeks freely.
   - **Resume:** at `last_watched_position_seconds` when the video isn't completed, in both modes.
   - **The next card** is disabled with a lock hint when `next.is_locked`.
   - **At the end of a video:** in preview, chapter 1 offers "Switch to CPE Mode?" (→ `setMode('cpe')`, then the
     player resets), and later chapters go to the next unlocked chapter. CPE mode does nothing (the quiz comes in
     follow-up 2).
   - **Analytics:** the player's `video_start`, `video_progress` and `video_complete` events carry over. `chapter_complete`
     waits for follow-up 1, which actually records completion.
   - **Not shown:** the quiz panel, Track Quiz and the final-assessment cards (decision 6).
5. **The page** (`masterclass-chapter.ts|html`) connects both facades from its route inputs and renders the back link
   and the player: a skeleton while loading, and the facade's error state with a retry on `loadError()`.
6. **Final assessment is hidden.** Its start route is gone, and the exam and report pages are follow-up 3.
7. **Completion is local.** At 95 % watched the chapter is marked done for this visit only. **The server's ladder does
   not move** until progress (follow-up 1) and, in CPE mode, the quiz (follow-up 2) are saved, so the next chapter
   stays locked after chapter 1. This is the biggest limit of this ticket; it's in Risks.
8. **IDs are UUID strings throughout,** with no `Number()`. URLs use the facade's `slug`.

## Files touched

| File                                                                                            | Change                                        |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `src/app/features/offerings/models/course-detail.model.ts`                                      | new fields, guards, `ChapterStartResult`      |
| `src/app/features/offerings/constants/course-detail.ts`                                         | the `chapter-start` route and lock copy       |
| `src/app/features/offerings/services/course-detail-facade.ts`                                   | `setMode`                                     |
| `src/app/features/offerings/services/course-chapter-facade.ts`                                  | **new**                                       |
| `src/app/features/offerings/components/course-chapter-player/course-chapter-player.ts\|html`    | **new**                                       |
| `src/app/features/offerings/masterclass/masterclass.routes.ts`                                  | hoist `CourseDetailFacade`; chapter providers |
| `src/app/features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter.ts\|html` | connect and render                            |
| `docs/refactor/STATE.md`                                                                        | progress entry                                |

**Not touched:** `chapter-quiz`, `ChapterFacade` and the podcast pages. `video-chapter` gets one class swap: the player
card's `#18232f`, already repeated in two files, became a `player-card` token in `styles.css`. Its two existing uses
(`video-chapter.html` and `chapter-skeleton.html`) moved to the token too, which keeps the same colour and is needed
because the structure check flags a hex that equals a token.

**Size:** about 550–650 changed lines (two new files make up most of it). Together with MIL-66's −285, the PR is over
the ~400 guide. Each subtask is one commit, so it reviews commit by commit.

## Security

- **No new privilege.** The stream URL only exists when the API grants the course (`course_is_locked` strips it
  server-side), and `chapter-start` re-checks the ladder and the entitlement.
- **The transcript is CMS HTML,** shown through the existing HTML dialog, as the glossary is.
- **`mode=` is sent only post-login**, as the API requires.

## Acceptance criteria

1. **Entitled learner:** the chapter's name, description, poster and stream play. "N Quiz Questions" matches
   `total_quiz_questions`, and the transcript opens with no request.
2. **One read:** course page → Watch Now, and chapter → previous chapter, make no new `course-detail` request.
   `chapter-start` fires once per chapter opened.
3. **Seeking and resume:** in CPE mode, seeking ahead is blocked until the chapter is seekable or completed, and a
   started chapter resumes at its position. Preview mode seeks freely.
4. **Locks:** a locked course, a locked chapter (from `course-detail` or a `403 chapter_locked`), or an unknown id lands
   on the course page with the matching message. `reset_required` shows its toast and re-reads.
5. **Mode:** `course_mode: null` asks once; the choice is stored (`mode=`), and closing the dialog goes back. "Switch to
   CPE Mode?" after chapter 1 in preview applies CPE rules. A `409 course_mode_locked` shows the server's message.
6. **No `v2/` request, no `NaN`,** and no request to any retired route from this page.
7. **Podcast is unchanged:** none of its files change.
8. **Gates:** `pnpm lint` 0 errors, `pnpm build:prod` green with no new warning, and the structure check passes.

## How to verify

1. **Headless (Playwright) on your dev server,** with a dummy `ACCESS_TOKEN` cookie (devtools-level; nothing is added
   to the app):
   - **`course-detail`:** served from the live pre-login payload, edited to signed-in values. `course_is_locked: false`,
     each chapter's `hls_video_url` set to the course's real HLS trailer, `course_mode` set to null, `cpe` or
     `preview`, and progress values taken from the Postman example.
   - **`chapter-start`:** served from the Postman `200` example, and from each refusal in turn.
   - **Checked:** criteria 1–6 at 1440, 768 and 375.
2. **You, signed in:**
   - An account without the subscription should land back on the course page with the subscribe message.
   - An entitled account should play chapter 1.
   - If you can, save the real `post_login` `course-detail` response (Network → Response → copy) so I can re-run step
     1 against it.

## Risks

- **The ladder doesn't advance (decision 7).** After chapter 1, a learner can't open chapter 2 until follow-ups 1 and 2
  land. Without `chapter-start` and progress, nothing worked before either, but this is the first version where they
  will notice. Follow-up 1 should come straight after.
- **The size of the PR** (above).
- **A new learner's `course_mode`** after `chapter-start` may already default to a mode, in which case the dialog never
  shows. That's fine either way.
- **A merge conflict with MIL-62** in `masterclass.routes.ts`, now with the provider hoist as well. Keep the guard, the
  hoisted `CourseDetailFacade` and the chapter's new provider.
- **Signed out on this branch,** a chapter URL asks for `pre_login`, sees `course_is_locked` and goes back with the
  subscribe message. MIL-62's `authGuard` makes that path unreachable once it merges.

## Follow-up tickets

1. **Save progress:** `course-progress-update` heartbeats and completion, `chapter_complete` analytics, and the ladder
   advancing. **Next.**
2. **Chapter quiz:** `quiz-questions` and `quiz-submit`, in the new player.
3. **Final assessment:** `assessment-start`, the exam and the report, and then the player's final-assessment card.
4. **Course feedback** on `feedback-*`.
5. **Watch Now resume:** open the learner's current chapter rather than chapter 1 (`masterclass_course_last_user_activity`
   or the progress read).
6. **Podcast:** ask the backend for `web-api` podcast routes, move podcast onto the new player, and delete
   `video-chapter`.
