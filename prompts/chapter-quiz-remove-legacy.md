# Remove the legacy chapter-quiz binding (step 1 of 2)

## Goal

Take the dead quiz binding out of the shared `chapter-quiz` component and out of everything that feeds it, so
step 2 (`prompts/masterclass-chapter-quiz.md`) can rebind `chapter-quiz` to `quiz-questions` / `quiz-submit` on a
clean base. This mirrors MIL-66 → MIL-67 and MIL-83 → MIL-84: one commit removes, the next binds.

## Assumptions (read first)

1. **Branch:** `feat/MIL-65-masterclass-chapter-page-binding` and PR #137 (the user's choice, 2026-10-15). It is
   its own commit, before the rebind.
2. **Scope:** "remove everywhere" (the user's choice). That covers `chapter-quiz` and its podcast and
   micro-learning callers, not only the masterclass page.
3. **Nothing working is lost.** Every route this binding calls answers Django's 404 HTML on UAT (checked
   2026-10-15, with and without `api/v1/`):

   | Route                         | Used for                   |
   | ----------------------------- | -------------------------- |
   | `user-quiz-details/`          | Submit an answer           |
   | `chapter-quiz?chapter_id=`    | Micro-learning's quiz read |
   | `masterclass/report_summary/` | The chapter quiz report    |

   Today a learner who reaches a quiz gets a 404 and an error toast, or nothing at all.

4. **The final assessment is untouched.** `QuizQuestion` in `core/models/course.model.ts` stays, because the final
   assessment exam, its facade, `assessment.model.ts` and `Utils` use it. So do `quiz_details` on the legacy course
   and reel models, which the podcast and micro-learning lists still use for "N Quiz Questions" and the CTA label.

## What changes

### `features/offerings/components/chapter-quiz/` (kept, unbound)

- Remove:
  - the `ChapterFacade` injection
  - `submitAnswer()`, and its `submitQuizAnswer` / `updateUserSelectedOption` / `updateChapterStatus` calls
  - the `QuizQuestion` / `CourseChapter` / `chapterId` inputs
  - the `option_a…d` and `description_option_*` lookups, and the client-side `correct_option` check
  - the `any` casts
- The folder, the selector `app-chapter-quiz` and the layout stay as an unbound frame, so step 2 rebinds the same
  component. In this commit nothing renders it.

### Podcast (`features/offerings/components/video-chapter/`, `audio-chapter/`, `podcast/pages/podcast-chapter/`)

- **`video-chapter`:**
  - Remove the `previewMode: 'video' | 'quiz'` panel swap and `<app-chapter-quiz>`.
  - Remove the open-the-quiz-on-load and open-on-end branches, `isQuizEnabled`, `handleQuizNext`,
    `handleTrackQuiz`, and the sidebar's "Track Quiz" control.
- **`audio-chapter`:** the same, with its `'audio' | 'quiz'` swap.
- **What remains:** the playback, the next-chapter flow, and the "N Quiz Questions" count on the Up Next card.
- **`podcast-chapter.ts`:** remove the `fetchQuizReport(current.id)` effect branch.

### Micro-learning (`micro-learning-course-facade.ts`, `micro-learning-quiz-dialog/`, `micro-learning.routes.ts`)

- **Delete:**
  - `MicroLearningQuizDialog` (the component folder)
  - `openChapterQuiz()`, `launchQuizDialog()`
  - the unused `submitQuizAnswer()` and its request/response types
  - the `ChapterQuizResponse` import
- **The three quiz entry points** each show one info toast, "The chapter quiz isn't available yet.", from a new
  copy constant. Today each of them errors.
  - the `TAKE_QUIZ` CTA
  - the CPE fallback "locally completed → quiz"
  - the end of a `micro_learning` / `ai_lab` reel in `handleVideoEnded()`
- **Route:** drop `ChapterFacade` from the course route's `providers`, and its comment. It was there only for the
  dialog's `ChapterQuiz`.
- **Unchanged:** `TAKE_EXAM`, `FEEDBACK`, `DOWNLOAD`, `REWATCH` and `markActiveReelActionStatus`.

### `features/offerings/services/chapter-facade.ts`

- **Remove:**
  - `submitQuizAnswer()`, `updateUserSelectedOption()`, `fetchQuizReport()`
  - the private `updateChapterQuestions()`
  - their `RouteRequest` / `RouteResponse` / `RouteParams` aliases
- **Kept:** `updateChapterStatus()`, because `updateLocalChapterCompletion()` (preview completion) uses it.

### `core/models/masterclass.model.ts`

- Remove `MASTERCLASS_ROUTES.submitQuizAnswer`, `getChapterQuiz` and `chapterQuizReport`, plus `ChapterQuizResponse`
  and `QuizReportItem` if nothing else uses them. The removal is checked by a grep and the type check.
- `core/models/ai-lab-assessment.model.ts` names `chapterQuizReport` in a comment. Reword that line so it doesn't
  point at a deleted route.

## Files touched

- `src/app/features/offerings/components/chapter-quiz/chapter-quiz.ts|html`
- `src/app/features/offerings/components/video-chapter/video-chapter.ts|html`
- `src/app/features/offerings/components/audio-chapter/audio-chapter.ts|html`
- `src/app/features/offerings/podcast/pages/podcast-chapter/podcast-chapter.ts`
- `src/app/features/offerings/services/micro-learning-course-facade.ts`
- `src/app/features/offerings/micro-learning/components/micro-learning-quiz-dialog/` (deleted)
- `src/app/features/offerings/micro-learning/micro-learning.routes.ts`
- `src/app/features/offerings/services/chapter-facade.ts`
- `src/app/core/models/masterclass.model.ts`, `src/app/core/models/ai-lab-assessment.model.ts` (comment)
- the micro-learning copy constant (its existing `constants/` file, or a new one beside the facade)
- `docs/refactor/STATE.md`

Estimated −450 / +30 lines.

## Security

Nothing new is sent. It only removes calls.

## Acceptance criteria

1. No source file references `user-quiz-details/`, `chapter-quiz?`, `report_summary`, `submitQuizAnswer`,
   `getChapterQuiz` or `fetchQuizReport`.
2. Nothing renders `app-chapter-quiz`, and it still compiles.
3. Podcast chapter pages play and move between chapters as before, without a quiz panel or "Track Quiz".
4. Micro-learning: each quiz entry point shows the one info toast and makes no request. `TAKE_EXAM`, feedback,
   download and rewatch behave as before.
5. The final assessment pages compile and are unchanged.
6. The masterclass chapter page is unchanged.

## Checks

`tsc` (app and Storybook), `pnpm lint`, `pnpm check:structure` (a deleted folder may prune a baseline entry: run
`--prune` if it says "out of date"), `pnpm format`, and `CI=true pnpm build:prod`.

## How to verify

- **Grep:** the route and method names above return nothing under `src/`.
- **Dev 4101:**
  - a podcast chapter page and a micro-learning course page load with no new console error
  - the micro-learning `TAKE_QUIZ` CTA shows the toast, and the Network tab shows no quiz request
- **Final assessment:** both routes still resolve.

## Risks

- **Podcast and micro-learning lose a quiz that already failed.** Their rebind adopts the step-2 `chapter-quiz`
  when those pages move to the web API.
- **Micro-learning's AI Lab hand-off** (empty quiz → exam) goes with `openChapterQuiz`. On UAT the quiz read was
  already a 404, so that hand-off never ran.
