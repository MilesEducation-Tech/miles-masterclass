# Rebind `chapter-quiz` to `quiz-questions` + `quiz-submit` (step 2 of 2)

## Goal

In CPE mode, when a chapter's video ends, the chapter page switches from the video to that chapter's quiz.
The learner answers one question at a time. The server grades each answer and returns feedback. When the
last answer lands, the server marks the chapter complete and the course page and the next chapter unlock.

This is the step MIL-79 left open: "in CPE mode, chapter 2 stays locked until the chapter quiz". Step 1,
`prompts/chapter-quiz-remove-legacy.md`, removes the dead binding first. This step rebinds the same `chapter-quiz`
component.

## Assumptions (read first)

1. **Branch:** `feat/MIL-65-masterclass-chapter-page-binding` and PR #137 (the user's choice, 2026-10-15). A new
   subtask under Story MIL-65, in its own commit after step 1's removal.

2. **CPE only.** Preview mode is "video only". The server answers the quiz routes with `403 preview_mode`, and
   the page never offers the quiz there.
3. **The final assessment is out of scope.** After the last chapter's quiz, the button returns to the course
   page; it does not start the exam. The exam is its own subtask.
4. **Question types.** Postman shows only `question_type: "single"`, and the body takes
   `selected_option_ids: []`. `single` is a radio group that submits on choice, as the old quiz did. Any other
   type (`multiple`) is a checkbox group with a Submit button. An unknown type is treated as `multiple`, never
   dropped.
5. **The "Completed" badge** on the course page follows the video (`is_video_completed`), as you asked today.
   The quiz changes `is_mcq_completed` and `is_chapter_completed`, which the page re-reads after the last answer.

## What I read

- **Postman** (`Merged Masterclass App 3`), `WEB GET web-masterclass-quiz-questions-v1` and
  `WEB POST web-masterclass-quiz-submit-v1`: the descriptions, every example, and the guard order.
- **`features/offerings/components/chapter-quiz/`**, the legacy quiz used by podcast and micro-learning. It was
  tied to `ChapterFacade`, `option_a…d` and a client-side `correct_option`. Step 1 leaves it as an unbound frame;
  this step binds that same component (folder and selector `app-chapter-quiz` unchanged).
- **`video-chapter`**: its `previewMode: 'video' | 'quiz'` panel swap, "Watch Again", "Track Quiz" in the
  sidebar, and the open-on-load rule (video done and quiz pending → show the quiz).
- **`CourseChapterFacade`**: `videoEnded()` (CPE stays put, then "Up Next · Locked"), `refuse()`, `leave()`,
  `isCpeMode`, `navigation`, and the progress saves.
- **`CourseDetailFacade`**: `reload()`, `applyProgress()`, `COURSE_DETAIL_API`.
- **`course-chapter-player`**: the video panel and the sidebar's Up Next card.
- **`styles.css` tokens:** `quiz-line`, `quiz-line-hover`, `quiz-selected`, `quiz-panel`, `player-panel`,
  `player-card`.

## Endpoint map

| Call      | Route                                                     | When                                              | Notes                                                                                                                                                                                                                                                               |
| --------- | --------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Questions | `GET web-api/v1/masterclass/quiz-questions/<chapter_id>/` | The quiz panel opens                              | `httpResource`, `SKIP_LOADING` (it shows its own state). Returns `questions_to_show`, `previously_completed`, `resumed`, `answered_count`, `questions[]`. Answered questions come back graded on a resumed attempt.                                                 |
| Answer    | `POST web-api/v1/masterclass/quiz-submit/<chapter_id>/`   | Each answer                                       | `ApiClient.call`, body exactly `{question_id, selected_option_ids}` (strict). Returns `is_correct`, `correct_option_ids`, `explanation`, `options_feedback[]`, `answers_submitted`, `total_questions`, `is_mcq_completed`, `is_chapter_completed`, `score_percent`. |
| Re-read   | `GET course-detail/` (existing)                           | After the last answer, and on `already_completed` | `CourseDetailFacade.reload()`. This unlocks the next chapter and updates the badge and progress.                                                                                                                                                                    |

**Refusals**, in the server's order:

| Response                                                             | What the page does                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `409` AI Lab lock, `403 caira_access_required`, `403 chapter_locked` | Back to the course page with the server's message, through the existing `refuse()`. |
| `403 already_completed`                                              | Close the quiz and re-read.                                                         |
| `404` no quiz config                                                 | Hide the quiz and show nothing locked behind it.                                    |
| `403 preview_mode`                                                   | Toast the server's message.                                                         |
| `200 reset_required` (submit)                                        | Toast and re-read, as the progress saves do.                                        |
| `400` repeat or foreign question                                     | Re-read the questions.                                                              |
| `500`                                                                | A warning toast; the learner can retry the answer.                                  |

## Target architecture

- **Model** (`features/offerings/models/course-detail.model.ts`):
  - Types: `ChapterQuizOption {id, text, order, is_correct?, explanation?}`,
    `ChapterQuizQuestion {id, question_text, question_type, options, is_answered, is_correct?, explanation?}`,
    `ChapterQuiz {chapter_id, questions_to_show, previously_completed, resumed, answered_count, questions}`,
    `QuizAnswer {question_id, selected_option_ids}`, and `QuizAnswerResult`.
  - Hand-written guards `parseChapterQuiz` and `parseQuizAnswerResult`: extra keys pass, missing or retyped keys
    throw.
  - Options are sorted by `order` at the boundary.
- **Routes** (`constants/course-detail.ts`): `quizQuestions` (a GET path) and `quizSubmit` (a POST `RouteConfig`)
  in `COURSE_DETAIL_API.masterclass`, with the same kind of contract comment as the others.
- **Copy** (`CHAPTER_COPY`): "Take the quiz", "Watch again", "Question {n} of {m}", "Proceed to next chapter",
  "Back to course", and the toast strings.
- **New `CourseChapterQuizFacade`** (`features/offerings/services/course-chapter-quiz-facade.ts`):
  - `@Service({ autoProvided: false })`, provided by the chapter page next to `CourseChapterFacade`, so it dies
    with the page.
  - **State:** `openFor = signal<string | null>(null)` (a chapter id), the questions `httpResource` keyed on it,
    `index`, a per-question result map (seeded from resumed, graded questions), `pending`, `done`, and
    `autoAdvance` (the 10 s countdown).
  - **Methods:** `open(chapter)`, `close()`, `answer(optionIds)` (POST, merge the result, then on
    `is_mcq_completed` set `done`, call `detail.reload()` and start the countdown), `next()`, `previous()`, and
    `proceed()` (→ `CourseChapterFacade.goTo(next)`, or the course page on the last chapter).
  - It starts at the first unanswered question.
- **`CourseChapterFacade`:**
  - `videoEnded()` in CPE mode: if `show_quiz && !is_mcq_completed`, it calls `quiz.open(current)`.
  - `quizPending` computed: CPE, and `show_quiz && !is_mcq_completed`.
  - On opening a chapter whose video is done and quiz pending, the quiz panel shows straight away, as
    `video-chapter` does.
- **`chapter-quiz`, rebound** (`features/offerings/components/chapter-quiz/`, same selector):
  - It injects `CourseChapterQuizFacade`, with no input/output relay. Podcast and micro-learning adopt it when
    their pages move to the web API; the routes take any chapter id.
  - Layout, from the legacy quiz:
    - a header with the thumbnail, the title and "Watch again"
    - "Question n of m"
    - the question
    - the options
    - feedback after grading, with "Correct answer" or "Explanation" per option from `options_feedback`
    - a footer with Back and Next or Proceed, and the countdown fill
  - **Options:** an `ngpRadioGroup` for `single`, and ng-primitives checkboxes plus Submit for anything else. No
    hand-rolled a11y.
  - **Styling:** Tailwind with the `quiz-*` and `player-*` tokens. No `#hex` where a token matches.
- **`course-chapter-player`:**
  - The video panel shows `app-chapter-quiz` in place of `app-video-js` while the quiz is open. The player
    stays mounted (`hidden`), so "Watch again" doesn't reload the stream.
  - The sidebar gets a "Take the quiz · N questions" button while `quizPending` and the quiz is closed.

## Phases

1. **Model, routes and copy:** types, guards and `COURSE_DETAIL_API` entries.
2. **`CourseChapterQuizFacade`:** the read, the answer, resume, refusals, completion → re-read, the countdown.
3. **Chapter flow:** `videoEnded()` opens the quiz, open-on-load, `quizPending`.
4. **UI:** the rebound `chapter-quiz`, plus the player's panel swap and sidebar button.
5. **STATE.md** "Now" and step log.

## Files touched

- `src/app/features/offerings/models/course-detail.model.ts` (types and guards)
- `src/app/features/offerings/constants/course-detail.ts` (routes and copy)
- `src/app/features/offerings/services/course-chapter-quiz-facade.ts` (new)
- `src/app/features/offerings/services/course-chapter-facade.ts` (video end, open-on-load, `quizPending`)
- `src/app/features/offerings/components/chapter-quiz/chapter-quiz.ts|html` (rebound)
- `src/app/features/offerings/components/course-chapter-player/course-chapter-player.ts|html` (panel swap,
  sidebar button)
- `src/app/features/offerings/masterclass/pages/masterclass-chapter/masterclass-chapter.ts` (provides the quiz
  facade)
- `docs/refactor/STATE.md`

Podcast and micro-learning don't render `chapter-quiz` after step 1; they rejoin when their own pages are rebound.

## Security

- The client never grades. Correctness comes only from `quiz-submit` (and from a resumed read's answered
  questions).
- The body is exactly the two declared keys. Option ids come from the server's own payload, never typed by the
  learner.
- Every call goes through the interceptors (token, `X-*` headers). There is no hand-attached auth.

## Acceptance criteria

1. In CPE mode, when a chapter's video ends and its quiz is pending, the quiz replaces the video without a reload.
2. Each answer is one `quiz-submit` call. The chosen option, the correct one and their explanations show after
   it. Back revisits answered questions read-only.
3. Reopening a half-done quiz resumes at the first unanswered question, with earlier answers shown graded.
4. After the last answer, `course-detail` is re-read once. The Up Next card unlocks, and "Proceed to next
   chapter" counts down 10 s and moves on; clicking it moves on at once. On the last chapter it reads "Back to
   course".
5. "Watch again" returns to the video at its position without reloading the stream. "Take the quiz" in the
   sidebar reopens the quiz.
6. Preview mode never shows the quiz or calls the quiz routes.
7. Each refusal behaves as the table says, and none loops.
8. Signed-in keyboard use: the options are a radio group (arrow keys), and focus moves to the question on Next.

## Checks

`tsc` (app and Storybook), `pnpm lint`, `pnpm check:structure`, `pnpm format`, and `CI=true pnpm build:prod`.

## How to verify

- **Dev 4101, signed in, CPE course:** use the temporary skip buttons, which are still local and uncommitted, to
  reach the end of chapter 1. Then:
  - The quiz opens.
  - Answer every question and watch the Network tab: one `quiz-submit` per answer, then one `course-detail`.
  - "Proceed" lands on chapter 2, unlocked.
- **Resume:** answer one question, reload, open the quiz. It starts at question 2, and question 1 shows graded.
- **Refusals:** Playwright with `quiz-questions` / `quiz-submit` answered from each Postman example.
- **Layout:** 1440, 768 and 375 px, with no horizontal scroll.

## Risks

- **`question_type` other than `single` is unseen on UAT.** The `multiple` path is built from the body shape, not
  from a live sample.
- **`questions_to_show` may be less than the bank.** The server picks random questions, so the count comes from
  `questions.length`, not the chapter's `total_quiz_questions`.
- **Two tabs answering the same quiz** get `400` "already answered". The page re-reads the questions rather than
  erroring.
- **Size:** about 500 lines on top of step 1, over the ~400 guide, on the PR the user chose (#137).

## Added during the build (the user, 2026-10-15)

- **Watch Now opens where the learner left off**: `CourseDetailFacade.resumeChapter`, the first chapter not yet
  done (`isChapterDone`: `is_chapter_completed`, or the video alone outside CPE mode). Chapter 1 done → chapter 2.
- **A chapter its predecessor's quiz still locks opens that quiz first.** A locked chapter (a course-page row, a
  deep link) redirects to `resumeChapter` with the "Complete this chapter's quiz…" toast, and that chapter's
  pending quiz opens by itself; finishing it moves on to the next chapter. On the chapter page, Up Next on a
  chapter the quiz holds opens the quiz (`CourseChapterQuizFacade.goTo`).
