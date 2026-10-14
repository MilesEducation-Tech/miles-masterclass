# Save chapter progress on the masterclass chapter page (MIL-79, MIL-65 subtask)

Third subtask of Story MIL-65 (`feat(offerings): bind the masterclass chapter page to the web API`), on
`feat/MIL-65-masterclass-chapter-page-binding`, after MIL-66 and MIL-67 (committed as `5ccc7df`). Same PR, at the user's
request.

## Assumptions

1. **Jira: MIL-79**, a subtask of MIL-65.
2. **Request body: the single-chapter form** `{ chapter_id, last_watched_position_seconds, max_watched_duration_seconds }`.
   - Postman's template shows that form and an `updates` list together, and the route "accepts a single chapter or
     bulk list".
   - The body is strict: an undeclared key is a 400. If UAT refuses this form, the bulk form with one item is the
     fallback, a one-line change.
3. **The server decides completion.** The client reports positions honestly and reads `is_video_completed`,
   `is_video_seekable`, `is_locked` and the rest back from the response. It never marks a chapter done on its own.
4. **I can't sign in on UAT** (no OTP mail). The flow is checked with intercepted responses built from the Postman
   examples, and by the user with a real account.

## Goal

Watching a chapter is saved to the server, so:

- the next visit resumes where the learner stopped;
- CPE seeking opens once the server says so;
- the chapter list and the next card show the server's lock state as soon as it changes, with no reload.

## The limit to know up front

**In CPE mode, saving progress alone does not unlock the next chapter.** The Postman example captured from a live call
shows chapter 1 with `is_video_completed: true` but `is_mcq_completed: false` and `is_chapter_completed: false`, and
chapter 2 still `is_locked: true`. The next chapter opens only after the chapter quiz, which is the next subtask
(`quiz-questions` / `quiz-submit`).

Preview mode has no quiz. Postman doesn't say whether its ladder moves on the video alone; this change will show it on
UAT.

## What I read

- **Postman, `web-masterclass-course-progress-update-v1`:**
  - `POST web-api/v1/masterclass/course-progress-update/{course_id}/`, JWT required.
  - **Guards, in order:** a strict body `400`; `404` course; `403 caira_access_required`; `200 reset_required` (the
    window expired and was reset); `400` "Not enrolled. Start a chapter first."; and a closed course, which answers
    `200` and changes nothing.
  - **Locked or unknown chapters** come back under `skipped`, not as an error.
  - **The response is the whole course's progress:**
    - per chapter: `chapter_id`, `is_locked`, `show_quiz`, `current_progress_seconds`, and `progress {…}`;
    - course-level: `show_final_assessment`, `final_assessment_submitted` and `enrollment`.
- **Postman, `web-masterclass-course-progress-get-v1`:** the same map as a read. It isn't needed, because
  `course-detail` and the update's response already carry it.
- **The code today:**
  - `CourseChapterFacade` marks a chapter watched at 95 % in the page only (`watchedHere`).
  - `VideoJs` emits `timeUpdate`, `paused` and `ended`. The player forwards only the percentage.
  - The old `ChapterFacade.trackActivity` sent at every 5 % and on pause, exit and completion, to the retired
    `v2/user/myclassactivity/`.
- **HTTP:** the app uses the XHR backend (no `withFetch`), so a request can't be made to survive closing the tab
  (`keepalive`).

## Locked decisions

1. **When it saves:**
   - every `PROGRESS_SAVE_INTERVAL_SECONDS` (15 s) of playback, matching the legacy 5 % on a 5-minute chapter;
   - on pause;
   - when the video ends;
   - when the learner moves to another chapter;
   - when they leave the page.

   Closing the tab loses at most the last 15 s.

2. **What it sends:**
   - `last_watched_position_seconds`: the position now.
   - `max_watched_duration_seconds`: the edge of what has been **watched straight through**. It starts from the
     server's value and grows only on play: a forward step of under `SEEK_JUMP_SECONDS` (3 s) between updates, which
     covers 2× speed, that **starts at or before the edge**. A seek ahead moves the position only, and playing on after
     it doesn't credit the skipped stretch.
     - _Revised during the work:_ the first version credited any play, so a seek to 120 s followed by play reported
       `max=121`. Seen in the browser and fixed.
3. **One request at a time.** A save that comes due while one is in flight waits for it, then sends the latest
   positions. The values are cumulative, so nothing is lost by merging. Saves don't drive the loading bar
   (`SKIP_LOADING`).
   - **Not sent twice:** the same positions aren't sent again; a pause and then the end send one save. An in-flight
     save counts as sent, and that's undone if it fails.
   - **No retry loop:** a failed save waits for the next save trigger and is never resent at once.
   - **Waiting at the end:** the end of a video waits for the queue, so the next-chapter check reads the server's
     answer.

4. **Added during the work: `CourseChapterFacade` is provided by the chapter page component, not the route.**
   - **Why:** the router doesn't clean up route injectors (`withAutoCleanupInjectors` isn't enabled), so the
     route-scoped instance from MIL-67 outlived the page.
   - **The MIL-67 bug it caused:** its effect kept running, and opening another course's page in the app showed a
     stray "Chapter not found" toast there. Reproduced, then fixed by this.
   - **Why it matters here too:** "save on leaving the page" needs the facade's `DestroyRef` to fire.
5. **The answer is applied as it comes:**
   - `CourseDetailFacade.applyProgress()` merges every chapter's `is_locked`, `show_quiz` and progress into the held
     course, so the next card and the course page's list update in place.
   - It doesn't re-read `course-detail`, and it doesn't re-run the opening steps, because the same course id keeps
     the same key.
6. **Failures:**
   - `reset_required`: the same toast and re-read as `chapter-start`.
   - `403 caira_access_required` or `409`: back to the course page with the reason, as `chapter-start` does.
   - `400` "Not enrolled", a `5xx` or a dropped connection: logged, and **one** warning per chapter ("We couldn't save
     your progress"). It tries again on the next save.
7. **Local "watched" goes away.** `watchedHere` and `CHAPTER_WATCHED_PERCENT` are removed; seeking opens on the
   server's `is_video_seekable` / `is_video_completed`.
8. **Messages:**
   - A next chapter locked because this chapter's quiz is still to do (`show_quiz` and not `is_mcq_completed`) says
     "Complete this chapter's quiz to unlock the next one".
   - Any other lock keeps "Finish the previous chapter".
9. **Analytics, back from the legacy facade:**
   - `chapter_complete` the first time the server reports the chapter's video complete;
   - `course_complete` when it reports every chapter's video complete.
10. **The model gains only what's read:**
    - progress: `max_watched_duration_seconds` and `is_mcq_completed`;
    - chapter: `show_quiz`;
    - `CourseProgressUpdate` (the body) and `CourseProgress` (the parsed answer, with guards).

## Endpoint map

| Call                                                              | In this subtask    |
| ----------------------------------------------------------------- | ------------------ |
| `POST web-api/v1/masterclass/course-progress-update/{course_id}/` | **new**            |
| `GET course-detail` and `POST chapter-start`                      | unchanged (MIL-67) |
| `GET quiz-questions`, `POST quiz-submit`                          | next subtask       |
| `GET course-progress/{course_id}/`                                | not needed         |

## Files touched

| File                                                                                         | Change                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/app/features/offerings/models/course-detail.model.ts`                                   | progress fields, `show_quiz`, update types, `parseCourseProgress`             |
| `src/app/features/offerings/constants/course-detail.ts`                                      | the route, the two timing constants, the copy; drop `CHAPTER_WATCHED_PERCENT` |
| `src/app/features/offerings/services/course-detail-facade.ts`                                | `saveProgress()`, `applyProgress()`                                           |
| `src/app/features/offerings/services/course-chapter-facade.ts`                               | the tracker, the saves, the failures, the analytics; drop `watchedHere`       |
| `src/app/features/offerings/components/course-chapter-player/course-chapter-player.ts\|html` | send time and pause to the facade                                             |
| `src/app/features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter.ts`    | provides `CourseChapterFacade` (decision 4)                                   |
| `src/app/features/offerings/masterclass/masterclass.routes.ts`                               | no longer provides it                                                         |
| `docs/refactor/STATE.md`                                                                     | entry                                                                         |

About 200–250 changed lines. With MIL-66 and MIL-67, the PR is well over the ~400 guide; one commit per subtask.

## Security and integrity

- **Positions are reported, never completion.** The server decides what's complete, and the client doesn't round a
  partial watch up to finished.
- **A seek ahead isn't counted as watched (decision 2)**, so the client doesn't help skip a CPE video.
- **The temporary free-seek in `course-chapter-player.ts`** (uncommitted, for testing) still has to be discarded before
  the PR. See Risks.

## Acceptance criteria

1. **Playing at 1× or 2×:**
   - a save goes out about every 15 s of playback, and on pause, at the end, on moving to another chapter, and on
     leaving the page;
   - only one is in flight at a time;
   - none of them moves the loading bar.
2. **The body has exactly the three keys.** `max_watched_duration_seconds` follows played time; seeking ahead raises
   only `last_watched_position_seconds`.
3. **The answer is merged:** the next card and the course page's list show the server's `is_locked` with no reload.
   CPE seeking opens when the server reports the video seekable.
4. **The next chapter locked behind the quiz** shows the quiz message.
5. **`reset_required`, a `403`, a `409` and a `5xx`** behave as in decision 5, with at most one warning per chapter.
6. **Reloading a chapter resumes** at the saved position.
7. **`chapter_complete` and `course_complete`** fire once each, on the server's say-so.
8. **Gates:** `pnpm lint` 0 errors, `CI=true pnpm build:prod` green, the structure check passes and Prettier is clean.

## How to verify

1. **Headless (Playwright) on the dev server, with a dummy cookie.**
   - `course-detail` is served from the live payload edited to signed-in values, and `course-progress-update` from the
     Postman example adjusted per case. Each request body is recorded.
   - Play at 2×, seek ahead, pause, let it end, move to another chapter and leave the page, checking the bodies and
     timings each time.
   - Then serve a response that unlocks chapter 2 and check the card. Then serve each failure.
2. **The user, signed in on UAT:** watch a chapter, reload it (it resumes), and watch the progress requests answer 200.
   In preview mode, see whether chapter 2 unlocks.

## Risks

- **CPE still stops at chapter 1** until the quiz subtask (above).
- **The body form** (assumption 2).
- **The server's completion threshold isn't documented.** If a fully played video doesn't come back
  `is_video_completed`, that's a backend question.
- **`course-chapter-player.ts` also has the uncommitted free-seek change.** This subtask edits the same file, so
  "Discard changes" in GitHub Desktop would throw both away. Before committing, I restore the CPE line myself, or the
  user asks me to; the user doesn't discard the file.
- **The merge conflict with MIL-62** in `masterclass.routes.ts` is unchanged; this subtask doesn't touch routes.
