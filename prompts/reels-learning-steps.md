# Reel learning steps: remove the old binding and rebind to the new Postman collection (MIL-183)

Story 3 of the reels epic (MIL-180). Branch `feat/MIL-183-reels-learning-steps`, cut from MIL-185 (PR #257).
When #257 merges, the branch is rebased onto `master` and its PR opens after that.

## Goal

When the server sets a reel's next step (`user_state.action_status`), the player's button runs that step:

| `action_status`            | Button                         | What it does                                                                                                 |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `TAKE_QUIZ` (micro)        | Take Quiz                      | Opens the chapter quiz in a pop-up over the player.                                                          |
| `TAKE_EXAM`, `RETAKE_EXAM` | Take / Retake Final Assessment | Shows the rules dialog, starts a sitting, then opens the shared exam page under the reel.                    |
| `FEEDBACK`                 | Submit Feedback                | Opens the shared course evaluation page under the reel. "Continue" brings the learner back to the same reel. |
| `DOWNLOAD`                 | Download Certificate           | Opens `user_state.certificate_url` in a new tab.                                                             |

After each step the reel is read again, so the button follows the server. The exam, report and feedback pages are
the ones masterclass and podcast already use. The quiz is the chapter page's quiz panel. Only the routes and the
hand-off are new.

## What I read

- **Reel code:**
  - `services/micro-learning-course-facade.ts`: `buttonAction`, `onButton` (the `'step'` stub), `videoEnded`,
    `refreshReel`, `connect` / `leave`, `reelPath`, `reelDetail`.
  - `models/reel.model.ts`, `constants/reels.ts`.
  - The reel card and the player page.
  - `micro-learning.routes.ts`.
- **Shared step code:**
  - `CourseDetailFacade`: `connect`, the `course()` id check, `coursePath`, the step URLs and writes.
  - `FinalAssessmentFacade.start()`: it takes the course and the path before it awaits the rules, and
    `startRefused` handles each refusal.
  - The exam, report and evaluation pages, which connect through `routeOffering()`.
  - `CourseEvaluationFacade`, `CourseCertificateFacade`.
  - `CourseChapterFacade` (`open(key)`: the locks, `chapter-start/`, the mode picker; its save on destroy, which
    does nothing with no tracker).
  - `CourseChapterQuizFacade` and the `ChapterQuiz` panel.
  - The AI Labs quiz dialog: a frame around the quiz panel, opened with the page's injector.
- **Routes:** `podcast.routes.ts` and `masterclass.routes.ts` (the course tree), `utils/route-offering.ts`,
  `app.routes.server.ts` (no micro-learning entries), `webinar.routes.ts` (still on the legacy feedback page).
- **Docs:** `docs/MASTERCLASS_PODCAST_AND_REELS.md` §5 (reel `action_status`; quiz routes are "not for nano";
  `403 caira_enrollment_required` on a reel's assessment) and §9.

## Locked decisions

From the epic (user, 2026-11-12):

- Every ticket first removes the old binding, then rebinds on the new Postman collection.
- Render the server's `action_status` as it is sent. Never derive it on the client.
- The cart is out of scope.

## Assumptions (reviewer, read first)

1. **The quiz is a pop-up over the player.** The reel stays where it is, which suits a feed. The pop-up is a frame
   around the shared `ChapterQuiz` panel, as AI Labs does it.
   - The frame provides its own `CourseChapterFacade` and `CourseChapterQuizFacade`, so they live exactly as long
     as the pop-up.
   - It resolves `CourseDetailFacade` and `FinalAssessmentFacade` from the reel route.
2. **The quiz opens by itself when a CPE reel ends** and the re-read says `TAKE_QUIZ`, as the chapter page does. The
   final assessment never starts by itself from the player, because its rules dialog is a big interruption; the
   button starts it. The quiz's own "Take Final Assessment" countdown is shared behaviour and stays.
3. **Every step that needs `course-detail/` re-reads it for its reel first** (the quiz and the exam: the rules,
   `show_quiz`, `course_mode`). The step runs when that read lands. The feed and `course-detail/` are two sources of
   truth; reading again stops a stale `course_mode` from closing the quiz.
   - No read happens until a step is asked, so swiping costs nothing.
   - The Transcript / Glossary cache (`reelDetail`) stays as it is.
4. **The shared pages keep their copy:**
   - "Back to Course" and "Finish every chapter and its quiz first." (a reel is a one-chapter course).
   - "Back to Course" lands on the reel player at that reel.
   - Copy per offering is a follow-up if wanted.
5. **Feedback and the certificate don't need `course-detail/` on the player:**
   - Feedback navigates with an explicit `redirect` to the reel's path. It does not call
     `CourseEvaluationFacade.openFeedback()`, because that reads `router.url`, which is stale after a swipe (the
     player moves the address bar with `Location.replaceState`).
   - Download uses the feed's `certificate_url`.
6. **The legacy `course-feedback` page and `FeedbackFacade` stay**, because webinar still uses them. Only the reel's
   route to them goes. Their micro-learning and nano branch (`course-feedback.ts:120-123`, the `nano_learning*` keys
   in `feedback-model.ts`) is dead after this and goes in MIL-184.
7. **Coming back to the player re-reads the reel in the URL.** The facade's route injector outlived the exam,
   report or feedback page, and the reel's locally patched state is stale.

## Target architecture

### Routes (`micro-learning/micro-learning.routes.ts`)

The course tree, shaped like podcast:

```ts
{
  path: ':courseId/:courseTitle',
  // The shared exam, report and evaluation pages build their links from this.
  data: { [COURSE_OFFERING_DATA_KEY]: 'reels' },
  providers: [CourseDetailFacade, FinalAssessmentFacade, CourseEvaluationFacade, CourseCertificateFacade],
  children: [
    { path: '', data: { layout: 'plain' }, providers: [MicroLearningCourseFacade], loadComponent: …MicroLearningCourse },
    { path: 'final-assessment/:sessionId/exam', canMatch: [authGuard], canDeactivate: [canDeactivateExamGuard],
      data: { layout: 'plain' }, loadComponent: …FinalAssessmentExam },
    { path: 'final-assessment/report', canMatch: [authGuard], data: { layout: 'plain' }, loadComponent: …FinalAssessmentReport },
    { path: 'feedback', canMatch: [authGuard], loadComponent: …CourseEvaluation },
  ],
}
```

- The parent stays componentless, so the children inherit its `data` and params, as podcast's do.
- `FinalAssessmentFacade` builds `/final-assessment/${id}/exam` and `/final-assessment/report`, so these paths must
  match exactly.
- `app.routes.server.ts` gets three `RenderMode.Client` entries for
  `:country/:profession_type/micro-learning/:courseId/:courseTitle/…`, beside podcast's. Today a reel's feedback
  path falls through to `**` and is server-rendered.

### `MicroLearningCourseFacade` (the hand-off)

It injects `CourseDetailFacade`, `FinalAssessmentFacade` and `NgpDialogManager` (the first two from the parent route).

- **`stepReel`:** a signal holding the reel whose step was asked last.
  - On the first step, `detail.connect('reels', stepParams)`, where `stepParams` is the reel's UUID and slug.
  - A step for the reel already connected calls `detail.reload()` instead.
  - Connecting happens at step time, not on page load, so the player never reads `course-detail/` unasked. It also
    re-connects after the exam page has connected the same instance to its own URL.
- **`pendingStep`:** `{ reelId, step: 'quiz' | 'exam' } | null`.
  - One effect waits for `!detail.isLoading() && detail.course()?.id === reelId`, then runs the step:
    - `quiz` → `openQuiz(reel)`
    - `exam` → `void assessment.start()`
  - On `detail.loadError()` or `notFound()` it toasts `REEL_STEP_COPY.unavailable` and clears.
- **`onButton` `'step'`:** switches on `action_status`:
  - `TAKE_QUIZ` → `pendingStep` quiz.
  - `TAKE_EXAM` / `RETAKE_EXAM` → `pendingStep` exam.
    - `start()` shows the rules and starts a sitting at `assessment-start/<uuid>/`, then goes to the exam page.
    - Its refusals are already toasts: `cool_off_active`, `preview_mode`, `already_passed`, 404, and 409 with the
      server's message.
  - `FEEDBACK` → `router.navigate([reelPath(reel), 'feedback'], { queryParams: { redirect: reelPath(reel) } })`.
  - `DOWNLOAD` → `document.defaultView?.open(url, '_blank', 'noopener')` inside the click, as
    `CourseCertificateFacade.download()` does.
    - If `certificate_url` is `null`, it shows the `CERTIFICATE_COPY.notReady` toast and calls `refreshReel(reel)`.
- **`openQuiz(reel)`:**
  - Sets `quizOpenFor` to the reel id, which the card reads to pause the reel.
  - Lazily imports the frame, then opens it with `dialogs.open(MicroLearningQuizDialog, { injector: this.injector,
data: { chapterId: reel.chapter.id } })`.
  - `afterClosed`, whatever the cause (×, Esc, backdrop, Watch again, the quiz finishing), clears `quizOpenFor` and
    calls `refreshReel(reel)`.
  - It does nothing while a quiz is already open.
- **`isBusy(reel)`:** the card's `buttonBusy`. True for a mode switch (as now), for a pending step on that reel, or
  for `assessment.starting()` on the step reel.
- **`videoEnded`:** after `refreshReel`, if the reel is still the active one, now says `TAKE_QUIZ`, and no quiz is
  open → `openQuiz(reel)`.
- **Return:** `leave()` marks the facade as away. The next `connect()` re-reads the reel in the URL once it is in
  the feed (`refreshReel`).
  - A different reel id already re-reads the whole feed, through `feedKey`.

### `micro-learning/dialogs/micro-learning-quiz-dialog/` (new)

- **Frame:**
  `<app-dialog ariaLabel="Reel quiz" [closable]="true" panelClass="w-[min(92vw,52rem)] p-0"><app-chapter-quiz class="min-h-96" /></app-dialog>`
- **Providers:** `providers: [CourseChapterFacade, CourseChapterQuizFacade]`.
- **Constructor:**
  - `chapters.connect(signal(data.chapterId))`, then `quiz.open()`. The course is already loaded, because the
    facade waited for it.
  - If the quiz has nothing to take (`!quiz.isPending()`), the dialog closes at once. The reel's re-read moves the
    button on.
- **One effect:** once the quiz has been open, `quiz.isOpen()` turning false closes the dialog. That covers
  "Watch again", and `proceed()` going on to the exam or back to the course.
- **Side effects carried by `CourseChapterFacade` (accepted, see Risks):**
  - a second `chapter-start/` for the chapter;
  - `course_is_locked` / `is_locked` / no mode refusals, none of which can hold for a reel showing `TAKE_QUIZ`.

### The reel card

- `buttonBusy` reads `facade.isBusy(reel)`.
- A new effect pauses the player while `facade.quizOpenFor()` is this reel. Closing doesn't auto-play, because an
  ended CPE reel would start again from 0.

### Models and constants

- `models/reel.model.ts`:
  - `ReelStep = 'quiz' | 'exam'`
  - `ReelPendingStep { reelId: string; step: ReelStep }`
  - `MicroLearningQuizDialogData { chapterId: string }`
- `constants/reels.ts`:
  - Remove `REEL_STEP_UNAVAILABLE`.
  - Add `REEL_STEP_COPY.unavailable`: "Couldn't open this step" / "Please try again."

## Endpoint map (all `web-api/v1/masterclass/`)

| When                           | Call                                                                                                   | Who                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Quiz or exam asked             | `GET course-detail/<reel uuid>/?login_type=post_login`                                                 | `CourseDetailFacade` (route)    |
| Quiz pop-up opens              | `POST chapter-start/<chapter uuid>/` (repeat of the player's)                                          | `CourseChapterFacade` (pop-up)  |
| Quiz                           | `GET quiz-questions/<chapter uuid>/`, `POST quiz-submit/<chapter uuid>/`                               | `CourseChapterQuizFacade`       |
| Exam start                     | `POST assessment-start/<reel uuid>/`                                                                   | `FinalAssessmentFacade.start()` |
| Exam page                      | `GET assessment-questions/<uuid>/?session_id=`, `POST assessment-submit/<uuid>/`                       | shared page                     |
| Report page                    | `GET assessment-report/<uuid>/`, `GET assessment-result/<uuid>/`                                       | shared page                     |
| Evaluation page                | `GET feedback-questions/<uuid>/`, `GET feedback-responses/?course_id=`, `POST feedback-submit/<uuid>/` | shared page                     |
| After feedback                 | `GET course-progress/<uuid>/` (certificate poll)                                                       | `CourseCertificateFacade`       |
| After each step, and on return | `GET reels-feed/<uuid>/?page_size=1`                                                                   | `refreshReel`                   |
| Download                       | none: `user_state.certificate_url`                                                                     | —                               |

## Phases

### 1. Remove the old binding

- `REEL_STEP_UNAVAILABLE` and its "Coming soon" toast in `onButton`.
- The reel's legacy `feedback` child route: `providers: [FeedbackFacade]` and `pages/course-feedback`.
- The routes comment "No final-assessment routes… They return with the micro-learning rebind."
- The `masterclass.routes.ts` comment that says podcast and micro-learning keep the legacy feedback page. Now only
  webinar does.

### 2. Rebind

In this order:

1. Models and constants.
2. Routes and server entries.
3. The facade's hand-off.
4. The quiz frame.
5. The card.

### 3. Docs

- `docs/MASTERCLASS_PODCAST_AND_REELS.md` §9: the learning steps are rebound; "Still to rebind" becomes only the
  MIL-184 clean-up.
- `AGENTS.md` §5, `assessment.model.ts` row: every offering's exam route is now `final-assessment/:sessionId/exam`,
  and no route uses `:session_id`.
- This prompt gets an "As built" section.
- `docs/refactor/STATE.md` gets a Now entry, in its own commit.

## Files touched

| File                                                                                                              | Change                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/app/features/offerings/micro-learning/micro-learning.routes.ts`                                              | Course tree: data, four providers, exam / report / evaluation children; legacy feedback removed           |
| `src/app/app.routes.server.ts`                                                                                    | Three micro-learning `Client` entries                                                                     |
| `src/app/features/offerings/services/micro-learning-course-facade.ts`                                             | `stepReel`, `pendingStep`, the step switch, `openQuiz`, `isBusy`, auto-open at the end, re-read on return |
| `src/app/features/offerings/micro-learning/dialogs/micro-learning-quiz-dialog/micro-learning-quiz-dialog.ts`      | **New** frame                                                                                             |
| `src/app/features/offerings/micro-learning/components/micro-learning-reel-card/micro-learning-reel-card.ts`       | Busy state; pause while the quiz is open                                                                  |
| `src/app/features/offerings/models/reel.model.ts`                                                                 | Step and dialog types                                                                                     |
| `src/app/features/offerings/constants/reels.ts`                                                                   | `REEL_STEP_UNAVAILABLE` removed, `REEL_STEP_COPY` added                                                   |
| `src/app/features/offerings/masterclass/masterclass.routes.ts`                                                    | One comment                                                                                               |
| `docs/MASTERCLASS_PODCAST_AND_REELS.md`, `AGENTS.md`, `prompts/reels-learning-steps.md`, `docs/refactor/STATE.md` | Docs                                                                                                      |

About 350 changed lines, so one PR.

## Security

- **Signed in only.** Every step needs a session.
  - The button shows a step only for an `open` reel, and signed out no reel is open.
  - The three new routes carry `authGuard` (`canMatch`), so a visitor goes to sign-in and back, and the chunk never
    loads.
- **The certificate** opens with `noopener`, inside the click.
- **No URL carries a token or a learner's data.** `redirect` is the reel's in-app path, and
  `CourseEvaluationFacade.leave()` already refuses anything else.

## Acceptance criteria

1. **Take Quiz (micro, CPE)** opens the pop-up on the reel's quiz.
   - The reel pauses.
   - Answers are graded one by one.
   - "Watch again" closes the pop-up.
   - ×, Esc and the backdrop close it the same way.
   - Each close re-reads the reel.
2. **The last answer** re-reads `course-detail/`, then counts down.
   - With an assessment, it goes to the rules dialog, then the exam at `/…/micro-learning/<uuid>/<slug>/final-assessment/<sid>/exam`.
   - Without one, it goes back to the reel.
3. **A CPE reel that ends** with `TAKE_QUIZ` opens the quiz by itself, once. A reel the learner swiped away from
   doesn't.
4. **Take / Retake Final Assessment:**
   - The button is busy until the rules dialog shows.
   - "Start Exam" goes to the exam page, which runs as for podcast.
   - A refusal toasts and the learner stays on the reel.
5. **The exam result's choices:**
   - "Back to Course" → the player on the same reel, re-read (the button now shows the server's next step).
   - "View Report" → `/…/final-assessment/report`.
   - "Retake" → the rules again.
6. **Submit Feedback:**
   - Opens `/…/micro-learning/<uuid>/<slug>/feedback?redirect=/…/micro-learning/<uuid>/<slug>`.
   - Submitting shows the thank-you view and polls for the certificate.
   - "Continue" returns to that reel, re-read.
7. **Download Certificate** opens `certificate_url` in a new tab. With no URL yet, it shows "Certificate on its way"
   and re-reads the reel.
8. **Pages and links:**
   - The exam, report and evaluation pages show the reel's name and link back into `/micro-learning/…`, never
     `/masterclass/…`.
   - Signed out, the three paths go to sign-in and back.
   - They render client-side.
9. **No regressions:**
   - The masterclass and podcast step flows are unchanged.
   - Webinar feedback still opens the legacy page.

## Checks

- `pnpm lint`
- `pnpm format:fix`
- `pnpm check:structure` (prune if it reports "out of date")
- `pnpm build:prod`: the frame and the shared pages load in their own lazy chunks; budget unchanged apart from
  those.

## How to verify (dev 4101, English)

- **UAT has no data for this:**
  - 0 nano reels;
  - micro reels with 0 quiz questions;
  - and steps need a CPE enrolment.
- **So the steps run signed in on stubs.** The feed comes from MIL-185's stubs. `course-detail/`, `quiz-*`,
  `assessment-*`, `feedback-*` and `course-progress/` reuse MIL-177's and MIL-179's bodies with the reel's ids.
- **Checks:**
  - **Quiz:** open, answer, Watch again, ×, the last answer → rules → exam URL; auto-open at the end; nothing to
    take → closes.
  - **Exam:** busy state, rules, start, `cool_off_active` and `preview_mode` refusals, back to the reel and its
    re-read.
  - **Report:** the URL, and its Back link.
  - **Feedback:** the `redirect` and Continue; the certificate poll.
  - **Download:** with and without a URL.
  - **Signed out:** each new path redirects to sign-in.
- **Regression:** MIL-185's 26, MIL-182's 37, MIL-177's and MIL-179's runs, and the masterclass step flow.
- **Live UAT signed out:** the player still loads; the three new paths redirect.
- **Widths:** 375 / 768 / 1440, so the quiz pop-up fits a phone.

## Risks

1. **No test data.** The flows are proven on stubs only. The backend has the test-data ask already (one nano reel,
   one micro reel with quiz questions and a transcript).
2. **A second `chapter-start/`** when the quiz opens (the pop-up's `CourseChapterFacade`). The server treats it as
   the same enrolment. It is the price of reusing the quiz without changing the shared facades.
3. **A reel with a quiz but no final assessment:** the quiz's "Back to course" navigates to the reel's URL. When the
   learner swiped there from the reel the page opened on, the router sees a new URL and the feed re-reads, anchored
   on that reel. Correct, but the feed reloads.
4. **The quiz's 10-second countdown** starts the final assessment by itself, as on the chapter page.
5. **The certificate lags feedback.** The evaluation page polls. On the player, `DOWNLOAD` with a `null` URL says so
   and re-reads.
6. **`router.url` is stale after a swipe.** Nothing on the player passes it to the shared code:
   - feedback gets an explicit `redirect`;
   - the exam builds its path from `course-detail/`;
   - the certificate poll runs on the evaluation page, where the URL is real.
7. **Rebase.** The branch carries PR #257's commits until it merges. After that, rebase onto `master` in GitHub
   Desktop and force-push before opening this PR.

## Ticket text (MIL-183)

**Title:** Reel learning steps: remove the old binding and rebind to the new Postman collection

**Description:**

The steps after a reel move to the new Postman collection: the chapter quiz, the final assessment and its report,
the course evaluation and the certificate. First the old binding goes: the reel's legacy feedback route and the
"Coming soon" placeholder on the reel's button. Then the button runs the step the server sets for the reel:

- **Take Quiz:** the chapter quiz in a pop-up over the player.
- **Take / Retake Final Assessment:** the rules, then the shared exam page under the reel, then its result and
  report.
- **Submit Feedback:** the shared course evaluation page, returning to the same reel.
- **Download Certificate:** the reel's certificate in a new tab.

After each step the reel is read again, so the button shows the next one. The exam, report and evaluation pages
are the ones masterclass and podcast use, under the reel's own address.

## As built

Built as planned, on `feat/MIL-183-reels-learning-steps`.

- **Routes:** the reel's `:courseId/:courseTitle` is podcast's course tree (`data: { offering: 'reels' }`, the four
  shared facades, the exam, report and evaluation children). The legacy `feedback` route and its `FeedbackFacade`
  are off the reel. `app.routes.server.ts` renders the three new paths client-side.
- **`MicroLearningCourseFacade`:**
  - The `'step'` button runs `action_status`:
    - `TAKE_QUIZ` and `TAKE_EXAM` / `RETAKE_EXAM` go through `askStep()`, which connects the route's
      `CourseDetailFacade` to the reel (`stepReel`), or reloads it for the same reel. `runPendingStep` then opens
      the quiz or calls `FinalAssessmentFacade.start()` once the read lands, and a failed read toasts
      `REEL_STEP_COPY.unavailable`.
    - `FEEDBACK` navigates with `redirect` set to the reel's path.
    - `DOWNLOAD` opens `certificate_url`; with none, it toasts `CERTIFICATE_COPY.notReady` and re-reads.
  - `isBusy()` covers a mode switch, a pending step and a starting sitting.
  - `videoEnded()` opens the quiz when the re-read says `TAKE_QUIZ` and the reel is still on screen.
  - `connect()` after `leave()` re-reads the reel in the URL (`refreshOnReturn`).
  - `leave()` closes an open quiz, because dialogs don't close on navigation.
- **`MicroLearningQuizDialog`** (`micro-learning/dialogs/`):
  - A frame around `ChapterQuiz`, with its own `CourseChapterFacade` and `CourseChapterQuizFacade`.
  - It opens the quiz on construction and closes itself when the quiz closes.
  - It lands in its own lazy chunk (1.5 kB).
- **The card:** `buttonBusy` reads `isBusy()`; the reel pauses while its quiz is open.
- **Removed:** `REEL_STEP_UNAVAILABLE` and its "Coming soon" toast.
- **Docs:**
  - `docs/MASTERCLASS_PODCAST_AND_REELS.md` §9.
  - `AGENTS.md` §5: the reel row now describes `reel.model.ts`. The assessment row now names
    `final-assessment.model.ts`; the old row named a file that no longer exists and a `:session_id` route that no
    route uses.

**Verified** on dev 4101 with Playwright, in English. 48 checks green, signed in on stubs, because UAT has no quiz
or exam data for reels:

- **Signed out:** the three new paths go to sign-in and back.
- **Before a step:** no `course-detail/` read.
- **Quiz:**
  - Take Quiz reads `course-detail/` (`post_login`), then the pop-up opens on `quiz-questions/<chapter>/`, and the
    reel pauses.
  - Watch again, ×, and Esc each close the pop-up and re-read the reel.
  - A second Take Quiz reads the course again.
  - Answers are graded one by one. After the last, "Take Final Assessment" shows the reel's rules, then
    `assessment-start/<reel>/` and the exam under `/micro-learning/…`.
- **After the exam:** Back to Course asks before leaving, lands on the reel, and the reel is re-read, so the
  button says Take Final Assessment.
- **The button's exam:** it waits while the course is read, then shows the rules and opens the exam.
- **Refusal:** a refused start (`preview_mode`) toasts and stays on the reel.
- **Report:** it renders, and Back lands on the reel.
- **Submit Feedback:** opens the evaluation page with `redirect`; Continue returns to the reel, and the button says
  Download Certificate.
- **Download:** opens the certificate in a new tab; with no link, it says so and re-reads.
- **End of a reel:** a CPE reel that ends with `TAKE_QUIZ` opens the quiz.
- **Widths:** the pop-up fits at 375, 768 and 1440 with no sideways scroll, and the evaluation form shows the reel
  at 375.
- **Regression:**
  - MIL-185's 26 green. Its placeholder check now expects the hand-off to `course-detail/`.
  - MIL-182's 37 green.
  - MIL-177's 34 green (podcast and masterclass steps).
