# MIL-108: start and submit the masterclass final assessment on the web API

**Status:** revision 1, 2026-10-19, awaiting approval.

**Branch:** `feat/MIL-108-assessment-exam`, cut from `master` `795819d`. Two commits, as the user asked: remove the
old bindings first, then rebind.

**Input:** `prompts/final-assessment-analysis.md` (the API check, restored 2026-10-19).

## Jira

```
Story  MIL-107  feat(offerings): bind the masterclass final assessment, feedback and certificate to the web API
  Sub  MIL-108  feat(offerings): start and submit the masterclass final assessment on the web API   ← this plan
  Sub  MIL-109  feat(offerings): show the masterclass assessment report from the web API
  Sub  MIL-110  feat(offerings): bind course feedback to the web API
  Sub  MIL-111  feat(offerings): download the masterclass certificate after feedback
```

## Assumptions (read first)

1. **Only what MIL-108 owns is removed: start, questions, submit, plus the report page's reads.**
   - The report page shares `FinalAssessmentFacade` with the exam, so its legacy reads go too. Its page stays as a
     shell (Back link) until MIL-109 rebinds it.
   - Feedback (`feedback-facade.ts`, `course-feedback`) and the certificate dialog are not touched: MIL-110 and
     MIL-111 own them, on their own branches.
2. **Podcast and micro-learning lose their exam and report routes, and keep their legacy start.**
   - The shared exam page becomes a masterclass web-API page, keyed by course UUID. Podcast and micro-learning have no
     web routes yet (no UUIDs, no UAT content), so their exam and report routes go. They come back with those
     offerings' own rebind ticket.
   - `Utils.startFinalAssessment`, `MASTERCLASS_ROUTES.startFinalAssessment` and the podcast and micro-learning
     buttons that call them stay. They are those offerings' legacy start, and the start call already answers 404, so
     nothing reaches the removed routes.
   - Removing those buttons now would touch about eight legacy podcast and micro-learning files that their rebind
     replaces anyway. **Flip D1 if you want them gone now.**
3. **Answers stay in memory.**
   - A reload keeps the sitting: the server holds the paper, and the page reads it back. The answers given so far are
     cleared.
   - `exam_rules` itself says "Avoid refreshing or exiting the session, as it will reset your progress", and the
     leave guard plus the browser's unload prompt stay.
   - No localStorage, so v3's cross-course `session_id` bug goes away.
4. **The result dialog offers only targets that work in MIL-108.**
   - A pass offers "Back to Course". MIL-109 adds "View Detailed Report", and MIL-110 adds feedback.
   - A fail offers "Retake" and "Return to Study Material".

## What it read

- **Postman App 5** (`postman/`, 04. Masterclass - Learning Flow (web)):
  - `assessment-start`, `assessment-questions`, `assessment-submit`: the contracts in the analysis, §2.3–2.5.
  - `course-detail` (`exam_rules`, `show_final_assessment`, `final_assessment_submitted`). The `course-progress`
    description notes that **course-detail turns the flags off in preview mode**.
- **UAT, 2026-10-19:**
  - All 64 masterclasses answer `course-detail/?login_type=pre_login` with `exam_rules` as a string, and with
    `show_final_assessment`, `final_assessment_submitted`, `show_feedback` and `is_preview_mode` as booleans.
  - The assessment routes answer 401 signed out.
- **Code:**
  - `features/offerings/models/assessment.model.ts`: `ASSESSMENT_ROUTES`, five legacy routes.
  - `services/final-assessment-facade.ts`:
    - `v2/:course_type/details/`, `final-assessment/` and `user-assessment/`
    - localStorage caching of the questions and of a global `session_id`
    - `+courseId` everywhere, which turns a UUID into `NaN`
  - `pages/final-assessment-exam/*`: `option_a..d`, answers as `'a'..'d'`, retake via `Utils.startFinalAssessment`.
  - `pages/final-assessment-report/*`: `user-assessment/assessment_report/`, plus the legacy certificate dialog.
  - `dialogs/assessment-result-dialog/*`: presentational, actions `report | course | retake`.
  - `Utils.startFinalAssessment` (`utils.ts:283-371`) and its callers:
    - podcast hero, through `MasterclassFacade.startFinalAssessment`
    - `podcast-chapter.ts`
    - `micro-learning-course-facade.ts`
  - Masterclass entry is hidden:
    - `masterclass-course-hero` has only "Watch Now" (comment at `:47-51`).
    - After the last chapter quiz, `CourseChapterQuizFacade.proceed()` returns to the course
      (`chapter-quiz.html:179`, `QUIZ_COPY.backToCourse`).
  - Patterns to copy:
    - `COURSE_DETAIL_API` (offering-keyed routes, `constants/course-detail.ts`)
    - `chapter-quiz.model.ts` (UUID options, `selected_option_ids[]`, `parse*` guards on `contract-guards.ts`)
    - `readCourseStepRefusal` (`course-detail.model.ts`)
    - `CourseChapterQuizFacade` (page-scoped facade beside `CourseDetailFacade`)
  - Routes and rendering:
    - `masterclass.routes.ts`: `CourseDetailFacade` on `:courseId/:courseTitle`; exam and report routes with
      `FinalAssessmentFacade`.
    - `app.routes.server.ts:14-25`: the exam routes render in the browser only.
    - `legacy-redirects.ts:117-131`: they target course pages, so they are unaffected.

## Locked decisions (flip any before approval)

- **D1. Removal scope is Assumptions 1 and 2.**
  - Legacy assessment code in the shared exam and report pages, `FinalAssessmentFacade` and `ASSESSMENT_ROUTES` is
    deleted.
  - The podcast and micro-learning exam and report routes go.
  - Their legacy start stays.
- **D2. One facade for the assessment, scoped to the course route.**
  - `FinalAssessmentFacade` (`@Service({ autoProvided: false })`) moves to the providers of
    `masterclass/:courseId/:courseTitle`, beside `CourseDetailFacade`.
  - The hero, the chapter quiz and the exam page all inject it (components inject the facade).
  - It reads the course and its offering from `CourseDetailFacade`.
- **D3. Routes are keyed by offering.**
  - `assessmentStart`, `assessmentQuestions` and `assessmentSubmit` join `CourseDetailApi`.
  - They are filled for `masterclass` in `COURSE_DETAIL_API`.
- **D4. Start opens the rules dialog first, then calls the API.**
  - The rules come from course-detail's `exam_rules`, in the same "Final Assessment / QAS Self-Study Qualified
    Assessment Rules" dialog with "Start Exam".
  - Then `POST assessment-start/<uuid>/`, then navigate to `final-assessment/<session_id>/exam`.
  - The exam page reads the paper with `GET assessment-questions/<uuid>/?session_id=`, so a reload works.
  - The start response's own `questions` are not cached.
- **D5. Two entry points.**
  - **Course hero:** when signed in and `show_final_assessment`, "Take Final Assessment" replaces "Watch Now" as the
    main button. Otherwise "Watch Now" stays.
  - **Last chapter's quiz:** when it completes and the re-read course says `show_final_assessment`, the button reads
    "Take Final Assessment" instead of "Back to course".
  - The server computes the flag; the client derives nothing.
- **D6. Submit, then re-read the course.**
  - `POST assessment-submit/<uuid>/` with `{session_id, answers: [{question_id, selected_option_ids}]}`.
  - Skipped questions are blocked client-side with the "Assessment Incomplete" list, as in v3 and the API: the
    answers must cover the whole sitting.
  - Then `CourseDetailFacade.reload()`, so the hero's flags follow.
- **D7. Every refusal gets its own message** (copy in `constants/course-detail.ts`; the server's message when it has
  one). The full mapping is in "Target architecture" below.
- **D8. Option types.** `single` uses radio buttons; any other `question_type` uses checkboxes, as the chapter quiz
  does. Only `single` has been seen on UAT.
- **D9. Analytics stay the same two events, with UUIDs.**
  - `assessment_start` on a successful start: `{course_id, session_id, course_type, resumed}`.
  - `assessment_submit`: `{course_id, session_id, course_type, passed, score}`.

## Endpoint map

| Step         | Before (legacy, 404 on UAT)                                          | After (`web-api/v1/masterclass/`)                          |
| ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Rules        | course `exam_rules` from `v2/…/details/`                             | `exam_rules` on `course-detail/` (already read)            |
| Start        | `POST user-assessment/start_assessment/?masterclass_id=`             | `POST assessment-start/<uuid>/` (no body)                  |
| Questions    | localStorage, else `GET final-assessment/?session_id&<id_key>=`      | `GET assessment-questions/<uuid>/?session_id=`             |
| Submit       | `POST user-assessment/` `{masterclass_id, session_id, answers_list}` | `POST assessment-submit/<uuid>/` `{session_id, answers[]}` |
| Course state | `v2/…/details/` (`user_assessment_details.status`)                   | `course-detail/` flags, re-read after submit               |

## Target architecture

```
masterclass/:courseId/:courseTitle         providers: [CourseDetailFacade, FinalAssessmentFacade]
├── ''                     course page     hero → FinalAssessmentFacade.start()
├── chapter/:id/:title     chapter page    chapter quiz (last chapter) → FinalAssessmentFacade.start()
├── final-assessment/:sessionId/exam       exam page → facade.connect(sessionId), sitting, submit()
├── final-assessment/:sessionId/report     shell until MIL-109
└── feedback                               unchanged (MIL-110)
```

**`models/final-assessment.model.ts`** replaces `assessment.model.ts`:

- `AssessmentOption {id, text, order}`.
- `AssessmentQuestion {id, question_text, question_type, options[]}`.
- `AssessmentSitting {session_id, course_id, questions_to_show, pass_threshold_percent, exam_rules,
previous_attempts, questions[], resumed}`.
  - `resumed` comes on the start response; the questions read omits it, so it defaults to `false`.
- `AssessmentAnswer {question_id, selected_option_ids}`.
- `AssessmentSubmitBody {session_id, answers}`.
- `AssessmentOutcome`: `{reset_required: true}` | `{reset_required: false, passed, score_percent}`.
  - The graded `answers[]` a pass returns are not read here; MIL-109's report shows them.
- `parseAssessmentSitting` and `parseAssessmentSubmit`, built on `contract-guards.ts`.
- `readCoolOff(error)`: reads `cool_off_ends_at` from a `403 cool_off_active`.

**`FinalAssessmentFacade`:**

- `canStart`: signed in && `course().show_final_assessment`.
- `start()`:
  - Opens the rules dialog, POSTs the start and navigates to the exam.
  - `starting` is a signal, so the buttons disable while it runs.
  - It maps each refusal to its message.
- `connect(sessionId)`: called by the exam page.
- `sitting`: an `httpResource` on `assessment-questions`. It is browser-only and gated on the boolean
  `isAuthenticated()`.
- `submit(answers)`: POST, then re-read the course, then return the outcome.
- `refusal`: the exam read's 404 / 409 reason, mapped to a message.

**Exam page**, rebuilt on the new model:

- One question at a time: radio or checkbox options, BACK / SKIP / NEXT / SUBMIT, "Question i of n".
- The "Assessment Incomplete" list.
- The "Exit Assessment?" guard (`canDeactivateExamGuard`) and `beforeunload`.
- States:
  - loading
  - the sitting has ended (`session_submitted` / `session_expired` / `session_not_found`): a message and "Back to
    course"
  - error with Try Again
- No legacy `Utils`, no localStorage. Alias imports, so the baseline gets pruned.

**Result dialog:** `AssessmentResultAction` becomes `'course' | 'retake'`. Retake calls `facade.start()` again.

**D7, refusals to messages:**

| Reason                              | Message                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `chapters_not_complete`             | "Finish every chapter and its quiz first."                                  |
| `already_passed`                    | "You've already passed this assessment." (then the course is re-read)       |
| `cool_off_active`                   | "You can retake the assessment after {local time from `cool_off_ends_at`}." |
| `preview_mode`                      | "Switch to CPE Mode to take the final assessment."                          |
| `caira_access_required`, 409 AI Lab | the server's message                                                        |
| 404 no config or empty bank         | "This course has no final assessment yet."                                  |
| `reset_required`                    | `CHAPTER_COPY.enrolmentReset`, then back to the course                      |

## Commits (one branch, one PR)

1. **`refactor(offerings): drop the retired final assessment bindings`**
   - Delete `features/offerings/models/assessment.model.ts`.
   - Delete the legacy `FinalAssessmentFacade`; it is recreated in commit 2.
   - Exam and report pages become shells (Back to Course link only).
   - `podcast.routes.ts` and `micro-learning.routes.ts` lose their `final-assessment/…/exam` and `/report` routes;
     `app.routes.server.ts` loses their two render-mode entries.
   - Masterclass exam and report routes drop the facade provider. The exam route keeps `canDeactivateExamGuard`, and
     the shell returns `true`.
   - `structure-baseline.json` gets pruned if the ratchet improves.
   - About −600 lines.
2. **`feat(offerings): start and submit the masterclass final assessment on the web API`** (MIL-108)
   - The new model, routes and copy; `CourseDetailApi` and the `MasterclassCourseDetail` fields plus their guards.
   - The new `FinalAssessmentFacade` on the course route.
   - The rebuilt exam page and the updated result dialog.
   - Hero CTA, chapter-quiz CTA and `QUIZ_COPY.takeAssessment`.
   - The hero comment updated.
   - About +650 lines.

**PR size:** about 1,250 changed lines, roughly half of them deletions. That is over the ~400 guide; it reads best
commit by commit, as MIL-95 did.

## Security

- **Tokens:** the bearer goes through `appInterceptor`. The reads are gated on the boolean `isAuthenticated()`.
- **No correct answers reach the browser before submit:** the API never sends them, and nothing is cached in
  localStorage.
- **The submit body is built only from the sitting's own question and option ids.** The API refuses anything else
  with a 400.
- **Navigation targets are built from the route's own course UUID and the server's `session_id`, never from user
  input.**
- **The exam route renders in the browser only.**
  - MIL-62 (PR #122) adds `authGuard` to these routes. Until it merges, a signed-out visitor who opens an exam URL
    gets the API's 401 and the page's error state.
  - Whichever of MIL-62 and MIL-108 merges second resolves the conflict in `masterclass.routes.ts`.

## Acceptance criteria

1. **Commit 1:**
   - No call to `user-assessment/`, `final-assessment/` or `v2/…/details/` is left in the exam or report code.
   - Lint, structure, build and SSR all pass. The masterclass course page and chapter pages are unchanged.
2. **Hero, signed in on a CPE course with every chapter and quiz complete:**
   - "Take Final Assessment" shows, the rules dialog lists `exam_rules`, and "Start Exam" sends
     `POST assessment-start/<uuid>/` with no body.
   - The browser lands on `…/final-assessment/<session_id>/exam`.
3. **Hero otherwise:** "Watch Now" shows when signed out, in preview mode, or with chapters left.
4. **Last chapter's quiz:** once the quiz is done, "Take Final Assessment" replaces "Back to course" and starts the
   same flow.
5. **Exam page:**
   - `GET assessment-questions/<uuid>/?session_id=<id>` runs once.
   - "Question 1 of N"; radio options; BACK, SKIP, NEXT and SUBMIT behave as in v3.
   - A reload shows the same questions in the same order.
6. **Submit:**
   - With a question unanswered, the incomplete list jumps to it.
   - With everything answered, `POST assessment-submit/<uuid>/` sends exactly that sitting's question ids with
     `selected_option_ids`.
   - **Pass:** confetti, score, "Back to Course". The course page then shows no "Take Final Assessment".
   - **Fail:** score and pass mark, "Retake" (a new start; a cool-off shows its time) and "Return to Study Material".
7. **Leaving mid-exam** asks "Exit Assessment?". A browser reload asks the browser's own question.
8. **Ended sitting:** opening an exam URL whose sitting was submitted shows the ended-sitting message with "Back to
   course".
9. **Report URL** shows the shell with Back to Course.
10. **Podcast and micro-learning** `…/final-assessment/…` URLs fall through to the not-found page. Their course pages
    are unchanged.
11. **No console errors** besides the known 403 photos.

## Checks

Run locally on macOS:

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

Plus `node scripts/check-structure.mjs` (with `--prune` if the ratchet improves), and an SSR load of the course page.

## How to verify

1. **Headless (dev 4101), signed in with a dummy `ACCESS_TOKEN`:**
   - Route these calls, built from the Postman shapes:
     - `course-detail/`: the real `pre_login` body with `show_final_assessment: true` and `course_mode: "cpe"`
     - `assessment-start/`
     - `assessment-questions/`
     - `assessment-submit/`: a pass and a fail
     - the refusals: `cool_off_active`, `chapters_not_complete`, `session_submitted`
   - Assert each request's method, path and body, and each UI state. Check 375, 768 and 1440 px for the exam page.
2. **Live on UAT, by you with a real account:** a CPE course with every chapter and quiz complete. Take the
   assessment once and fail it, wait out any cool-off, then pass it. This is the only check of the real
   `assessment-start` / `assessment-submit` payloads, which Postman has only as templates.
3. **Signed out:** the course page shows "Watch Now". The podcast and micro-learning exam URLs show not-found.

## Risks

- **The start and submit examples are templates, not live captures** (analysis Q3). The guards follow the documented
  keys. A live response that differs lands in `error()` with a contract message instead of a wrong screen; the live
  UAT check confirms them.
- **The meaning of `final_assessment_submitted` is not documented:** any attempt, or a pass? MIL-108 doesn't read
  it. The hero relies on `show_final_assessment` alone. A "Retake" label would need it; ask the backend (new Q8).
- **A learner who leaves mid-exam keeps an open sitting on the server.** The next start resumes it, with the same
  paper. That is the API's design.
- **Merge order with MIL-62 (#122).** Both edit `masterclass.routes.ts`, and #122 also guards the podcast and
  micro-learning routes this plan removes. Whichever merges second resolves it.
- **PR size** (see Commits).

## Questions for the backend (non-blocking)

- **Q3 (analysis):** live captures of `assessment-start` and `assessment-submit`, pass and fail.
- **Q8 (new):** what `final_assessment_submitted` means: any attempt, or a pass. Does `show_final_assessment` stay
  true after a failed attempt?
