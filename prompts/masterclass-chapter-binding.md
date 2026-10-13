# Bind the masterclass chapter page to `course-detail`

## Assumptions

1. **New Story, new branch.** This is feature work, not MIL-62. Create a Story and branch from `master` once the MIL-62
   PR is merged, e.g. `feat/MIL-<n>-masterclass-chapter-binding`. Say so if you want it elsewhere.
2. **Scope is what you asked for: the chapter page's data comes from `course-detail`.** That covers:
   - the chapter list, the current, previous and next chapter, and its text
   - the video stream and the poster
   - the transcript
   - the learner's progress, as the API reports it
   - the CPE/preview mode, including switching it (it is a `course-detail` parameter)
   - the lock state and the final-assessment entry point

   **Not in scope:** saving progress (`chapter-start` + `course-progress-update`), the chapter quiz
   (`quiz-questions` / `quiz-submit`), and the assessment and feedback pages. Those are the follow-up tickets below.

3. **Signed-in field types come from Postman, the live signed-out response, and your screenshot**
   (`course_mode: "cpe"`, `course_is_locked: true`). I cannot call `post_login` myself, because UAT sends no OTP to
   temp mail. Every learner field is typed nullable and checked at the trust boundary, so a surprise lands in the
   page's error state rather than on screen.

## Goal

`/…/masterclass/:courseId/:courseTitle/chapter/:chapterId/:chapterTitle` renders the real chapter for a signed-in
learner:

- its name, description, poster and HLS stream
- the previous and next chapter cards, with their quiz counts
- the transcript
- resume and seek rules from the learner's progress
- the CPE/preview mode and the final-assessment entry

All of it comes from one `course-detail` read. It replaces the retired `v2/` routes, which answer 404 for any id, and
the `Number(id)` that turned UUIDs into `NaN`.

## What I read

- **Page:** `masterclass-chapter.ts|html`.
  - It loads through `ChapterFacade.loadCourse({ id: Number(id) })`, which calls `v2/:course_type/details/` and
    `v2/chapters/`. Both are 404 on UAT, and so are podcast's `v2/podcast/details/` and `v2/chapters/`.
  - It tracks progress via `v2/user/myclassactivity/` with numeric ids, and switches mode via the legacy
    `setCpeMode` POST.
- **`ChapterFacade`:**
  - The legacy read (`courseLoad()`), `trackActivity`, `selectCpeMode`, `submitQuizAnswer`, `fetchQuizReport`.
  - Shared with the podcast chapter page and `ChapterQuiz`.
- **Shared player `offerings/components/video-chapter`:**
  - **Used by:** the masterclass and podcast chapter pages only. Micro-learning only mentions it in a comment.
  - **Inputs:** the legacy `CourseChapter`, `ChapterWiseDetails` and `UserAssessmentDetails`.
  - **Template and logic read:**
    - `id`, `chapter_name`, `chapter_thumbnail`, `description`, `video_url`, `video_duration`
    - `play_history.is_completed` and `.time_status`
    - `quiz_details.questions` and `.overall_chapter_questions`
    - `chapterWiseDetails.status`, and `userAssessmentDetails.status` (`Exam_Passed` / `Retake`)
  - **Transcript:** fetched from `v2/course-content/` through `MasterclassFacade`.
- **`ChapterQuiz`:** it reads `current.chapter_name` and `.chapter_thumbnail`, and saves through
  `ChapterFacade` (legacy).
- **`CourseDetailFacade`** (`offerings/services`, built in MIL-25):
  - It reads `web-api/v1/masterclass/course-detail/{id}/?login_type=…&chapters.page_size=100`, parsed by
    `parseCourseDetail`.
  - It exposes `course()` and `chapters()` (each with a `slug`), `loadError()` and `notFound()`.
  - It is provided on the course page's `''` child route only.
- **Contract** (Postman, and a live UAT call for this course):
  - Each chapter carries `id` (UUID), `name`, `mini_description`, `order`, `duration_seconds`,
    `total_quiz_questions` and `horizontal_thumbnail_url`, plus:
    - **`hls_video_url`:** stripped to `null` whenever `course_is_locked`.
    - **`transcript_text`:** HTML, sent signed out too.
    - **`is_locked`:** the chapter ladder.
    - **`show_quiz`**
    - **`user_chapter_progress`:** `is_video_completed`, `is_video_seekable`, `is_mcq_completed`,
      `is_chapter_completed`, `last_watched_position_seconds`, `current_watched_duration_seconds`,
      `max_watched_duration_seconds`, `completed_at` and `quiz_attempted`, all `null` until the learner starts.
  - **Course-level:** `course_is_locked`, `course_mode`, `is_preview_mode`, `show_final_assessment`,
    `final_assessment_submitted`, `exam_rules` and `enrollment`.
  - **`mode=cpe|preview`** is post-login only. It sets the mode stored on the enrolment; omit it to keep the stored
    one.

## Locked decisions

1. **One read: `CourseDetailFacade`.**
   - Its provider moves from the course page's `''` child to the `:courseId/:courseTitle` parent route. The course
     page and every chapter page then share one instance: Watch Now and chapter → chapter make no new request.
   - The chapter page calls `connect('masterclass', params)`, as the course page does. The course-info dialog keeps
     its own instance.
2. **Model, from the contract** (`offerings/models/course-detail.model.ts`):
   - `MasterclassChapter` gains `hls_video_url`, `transcript_text`, `is_locked`, `show_quiz` and
     `user_chapter_progress: MasterclassChapterProgress`. The progress fields are all nullable; types go in the model
     file.
   - `MasterclassCourseDetail` gains `course_is_locked`, `course_mode: 'cpe' | 'preview' | null`,
     `is_preview_mode`, `show_final_assessment`, `final_assessment_submitted` and `exam_rules`. Only fields this page
     reads are added.
   - The `isChapter` / course guards check each new field.
3. **Facade additions** (state stays in the facade; the page and player read it):
   - `selectChapter(id)`
   - `chapterNavigation`: previous, current, next and index over `chapters()`
   - `isCpeMode` (`course_mode === 'cpe'`)
   - `isCourseLocked`
   - `finalAssessmentEntry`: see decision 5
   - `setMode(mode)`: re-reads `course-detail` with `mode=` (replaces the legacy `setCpeMode` POST)
   - `chapterPath(chapter)`
4. **Ids are UUID strings end to end.** No `Number()`. Navigation uses the facade's `slug`.
5. **The shared player is retyped to the new chapter shape** (your binding brief: reshape the component's interface,
   don't map new data back into the old one).
   - `current` / `previous` / `next` become `MasterclassChapterLink | null`, `courseId` becomes `string | null`, and
     `navigate` emits the chapter id string.
   - **Field mapping:**
     - `chapter_name` → `name`
     - `chapter_thumbnail` → `horizontal_thumbnail_url`
     - `description` → `mini_description`
     - `video_url` → `hls_video_url`
     - `video_duration` → `duration_seconds`
     - the quiz count → `total_quiz_questions`
     - transcript → `transcript_text` (no request)
   - **Progress:** `play_history` → `user_chapter_progress`.
     - Seeking is free when not in CPE mode, or `is_video_seekable`, or `is_video_completed`.
     - Resume at `last_watched_position_seconds`.
     - The start percentage is `last_watched_position_seconds / duration_seconds`.
   - **Final assessment:** `chapterWiseDetails` + `userAssessmentDetails` become one input,
     `finalAssessment: 'start' | 'retake' | 'report' | 'locked' | null` (typed in the model).
     - Masterclass: `'start'` when `show_final_assessment && !final_assessment_submitted`; `'locked'` in CPE mode
       before that; `null` in preview.
     - `'report'` / `'retake'` wait for the assessment ticket. `course-detail` sends no pass/retake or session id,
       and the report page needs a session id.
   - **Quiz:** the panel takes an optional podcast-only `quiz` input (`{ chapterId: number; questions }`, legacy)
     until the quiz ticket. `ChapterQuiz`'s `current` input becomes `chapterName` + `thumbnailUrl`. The masterclass
     page passes no `quiz`, so Track Quiz is hidden there for now; "N Quiz Questions" still shows.
   - Shared by two facades, so it stays inputs/outputs (it can't inject either).
6. **The podcast chapter page keeps compiling through a temporary adapter.**
   - `podcast/utils/to-player-chapter.ts` maps its legacy chapters, and its assessment status, into the new shape.
   - Delete it when podcast moves to a web route. Podcast is 404 on UAT before and after this change.
7. **The masterclass chapter page stops using `ChapterFacade`** (and its route stops providing it).
   - No calls to `v2/…`, `myclassactivity`, the legacy `setCpeMode` or `v2/course-content/`.
   - Completion stays local: 95 % watched marks the chapter done for this visit, as today. **Saving it is the next
     ticket**, so until then, progress is not saved across reloads.
8. **Locked means back to the course page, with a toast.**
   - `course_is_locked` (no entitlement, so no stream exists): "Subscribe to watch this course".
   - The current chapter `is_locked` (the ladder): "Finish the previous chapter first".
   - An id not in the list returns to the course page too.
   - This replaces the legacy `requireCpeModeAccess` redirect.
9. **The "Switch to CPE Mode?" dialog after chapter 1** calls `facade.setMode('cpe')`, then resets the player, as
   today.

## Endpoint map

| Call                                                                                                                                   | Status                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `GET web-api/v1/masterclass/course-detail/{id}/?login_type=post_login&chapters.page_size=100[&mode=cpe\|preview]`                      | **used** (existing)        |
| `v2/:course_type/details/`, `v2/chapters/`, `v2/user/myclassactivity/`, legacy set-CPE-mode, `v2/course-content/`, chapter quiz report | **removed** from this page |
| `POST chapter-start/{chapter_id}/`, `GET course-progress/{id}/`, `POST course-progress-update/{id}/`                                   | follow-up ticket 1         |
| `GET quiz-questions/{chapter_id}/`, `POST quiz-submit/{chapter_id}/`                                                                   | follow-up ticket 2         |
| `assessment-*`, `feedback-*`                                                                                                           | follow-up tickets          |

## Phases (one commit)

1. **Model:** the new fields and guards, and the `FinalAssessmentEntry` type.
2. **Facade:** hoist the provider; add `selectChapter`, `chapterNavigation`, the mode and lock computeds,
   `finalAssessmentEntry`, `setMode` and `chapterPath`.
3. **Player:** retype `video-chapter`; add the podcast-only `quiz` input; give `ChapterQuiz` name and thumbnail inputs;
   add the podcast adapter.
4. **Page:** rewrite `masterclass-chapter.ts|html` on the facade; route providers.
5. **Checks and verification.**

## Files touched

| File                                                                                            | Change                                                      |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/app/features/offerings/models/course-detail.model.ts`                                      | new fields, guards, `FinalAssessmentEntry`                  |
| `src/app/features/offerings/services/course-detail-facade.ts`                                   | chapter state, mode, lock                                   |
| `src/app/features/offerings/masterclass/masterclass.routes.ts`                                  | hoist `CourseDetailFacade`; drop `ChapterFacade` on chapter |
| `src/app/features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter.ts\|html` | rewritten on the facade                                     |
| `src/app/features/offerings/components/video-chapter/video-chapter.ts\|html`                    | new chapter shape                                           |
| `src/app/features/offerings/components/chapter-quiz/chapter-quiz.ts\|html`                      | name and thumbnail inputs                                   |
| `src/app/features/offerings/podcast/pages/podcast-chapter/podcast-chapter.ts\|html`             | via the adapter                                             |
| `src/app/features/offerings/podcast/utils/to-player-chapter.ts`                                 | new, temporary                                              |

**Size:** about 500 changed lines, above the ~400 guideline. Most of it is the player's retype, which has to land
together with both pages that use it, so there is no clean split. The alternative is in Risks.

## Security

- **No new client privilege.** The stream URL exists only when the API grants the course; `course_is_locked` strips
  it server-side, so the page can't play what the learner isn't entitled to.
- **The transcript is CMS HTML,** rendered the same way as today (the same dialog).

## Acceptance criteria

1. **Entitled learner** (`course_is_locked: false`), on a chapter URL:
   - The real name, description, poster and stream play.
   - The previous and next cards show the right chapters and quiz counts.
   - "N Quiz Questions" matches `total_quiz_questions`.
   - The transcript opens without a network request.
2. **Navigation:** previous and next go to `…/chapter/<uuid>/<slug>` with no new `course-detail` request. Watch Now
   from the course page doesn't refetch either.
3. **CPE mode:**
   - Seeking ahead is blocked until `is_video_seekable` or the video is completed.
   - A started chapter resumes at `last_watched_position_seconds`.
   - In preview, seeking is free.
4. **Locks:**
   - `course_is_locked`: back to the course page with the subscribe toast.
   - A locked chapter: back with the "previous chapter first" toast.
   - An unknown chapter id: back to the course page.
5. **Switch to CPE Mode** re-reads `course-detail` with `mode=cpe`. The page shows CPE rules after it.
6. **No request to `v2/`** from the masterclass chapter page, and no `NaN` anywhere.
7. **Podcast:** the chapter page compiles and behaves as before (404s on UAT, as today).
8. **Gates:** `pnpm lint` 0 errors, `pnpm build:prod` green with no new warnings.

## How to verify

- **I can't sign in on UAT** (no OTP to temp mail), so the signed-in render is verified two ways:
  1. **You,** in your signed-in browser.
     - Your account shows `course_is_locked: true`, so it should land back on the course page with the subscribe
       toast. That checks criterion 4.
     - An entitled account checks criteria 1–3 and 5.
  2. **Me, with your real response.**
     - Save the `post_login` `course-detail` JSON from DevTools (Network → the request → Response → copy) into a file
       you hand me. The headless browser serves it for that URL via request interception (devtools-level; nothing is
       added to the app).
     - I check the render, navigation, resume and lock flows against it, and set `course_is_locked: false` in the
       copy to see playback paths.
- **Signed out:** the route guard still sends `/auth/login?redirect=…` (MIL-62).

## Risks

- **Field types beyond what Postman shows.** Mitigated by nullable types and guards. Your saved response settles them.
- **Progress is not saved until follow-up ticket 1.** Today it isn't saved either: `myclassactivity` is 404.
- **Size.** If you'd rather keep this PR under 400, the alternative is a separate masterclass-only player component.
  `video-chapter` would stay untouched for podcast until podcast moves, then be deleted. That means no adapter and no
  podcast edits, but two players for a while, and a duplicate template your reviewer may flag ("reuse
  components").

## Follow-up tickets

1. **Save progress:** `chapter-start` on entering a chapter (creates the enrolment; handles `403 chapter_locked`,
   `200 reset_required` and `409 already_started_via_7dc`), then `course-progress-update` for heartbeats and completion.
2. **Chapter quiz:** `quiz-questions` / `quiz-submit`; rebuild `ChapterQuiz` on them; drop the podcast-only `quiz`
   input once podcast moves.
3. **Final assessment:** the exam and report pages on `assessment-*`. Then `'report'` / `'retake'` light up.
4. **Course feedback** on `feedback-*`.
5. **Podcast:** ask the backend for `web-api` podcast routes; then remove the adapter.
