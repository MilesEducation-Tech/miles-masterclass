# Final assessment flow: analysis and API check

**Status:** analysis only, 2026-10-16. No code changed. This is the input for the binding plan (MIL-107).

**Sources:**

- **New APIs:** the App 5 Postman export (`Merged Masterclass App 5`, also in `postman/`), folder "04. Masterclass -
  Learning Flow (web)".
- **Flow reference:** `miles-masterclass-v3`, read only. It runs entirely on the legacy unversioned and `v2/` paths.
- **This repo:** `master` `11409b5`.
- **UAT:** every web route below answered **401** without a token on 2026-10-16, so all of them exist. A made-up control
  path answered 404.

## 1. Verdict

Every step has a web-api endpoint except one: **there is no certificate download endpoint**. The certificate is a
server-generated PDF, and its link arrives as a field on reads the app already makes.

| #   | Step                 | New web endpoint (`web-api/v1/masterclass/`)                                                                                                        | v3 legacy call it replaces                         | Present       |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------- |
| 1   | Assessment (start)   | `POST assessment-start/<course_id>/` (empty body)                                                                                                   | `POST user-assessment/start_assessment/?<id_key>=` | ✅            |
| 2   | Questions            | returned by `assessment-start`; `GET assessment-questions/<course_id>/?session_id=` to reload them                                                  | `GET final-assessment/?session_id=&<id_key>=`      | ✅            |
| 3   | Answers (learner's)  | kept in the browser, sent all at once in the submit                                                                                                 | the same (client-side, `answers_list`)             | ✅            |
| 4   | Submission           | `POST assessment-submit/<course_id>/` `{session_id, answers[]}`                                                                                     | `POST user-assessment/`                            | ✅            |
| 5   | Report               | `GET assessment-report/<course_id>/`                                                                                                                | `POST user-assessment/assessment_report/`          | ✅            |
| 6   | Result               | `GET assessment-result/<course_id>/` (latest attempt, question by question)                                                                         | the submit response + the report                   | ✅            |
| 7   | Feedback (questions) | `GET feedback-questions/<course_id>/`                                                                                                               | `GET feedback-category/`                           | ✅            |
| 8   | Feedback submission  | `POST feedback-submit/<course_id>/`                                                                                                                 | `POST user-feedback/submit_feedback/`              | ✅            |
| 8b  | Submitted feedback   | `GET feedback-responses/?course_id=`                                                                                                                | `GET user-feedback/?master_class__id=`             | ✅            |
| 9   | Certificate download | **none.** Use `masterclass_certificate_url` from `course-detail/` or `course-progress/`, and `certificate_url` per row of `web-api/v1/badges/page/` | `POST user-assessment/download_certificate/`       | ⚠️ field only |

**Supporting reads and writes, all present:**

- `GET course-detail/<id>/` and `GET course-progress/<id>/` carry the flags that drive the UI:
  - `show_final_assessment`, `final_assessment_submitted`
  - `show_feedback`, `feedback_submitted`
  - `masterclass_certificate_generated`, `masterclass_certificate_url`
  - the Credly fields, `course_mode`, `is_preview_mode`
  - `exam_rules` (course-detail only)
- `GET enrollment/<id>/`: the 365-day window.
- `POST course-mode/<id>/` `{mode: "cpe" | "preview"}`: replaces legacy `set_cpe_mode`.

**Don't use:**

- The `api/v1/masterclass/<id>/assessment/...` twins. They are the app surface; the web has its own routes.
- `app-api/` (AGENTS.md §6).

## 2. The flow on the new APIs

Steps 1–4 are the same for every course type, keyed by the course UUID. Step 5 differs for nano reels.

1. **Unlock.**
   - The server decides: `show_final_assessment` on `course-detail/` (also on `course-progress/`).
   - v3 used the server's `all_classes_completed` on the hero, plus a flag the client flipped after the last chapter
     quiz on the in-player tile. The new flag replaces both, and the client should not derive it.
   - CPE mode only. Preview mode is video only (`403 preview_mode`).
2. **Rules dialog.**
   - `exam_rules` is on `course-detail/`, so the rules show before anything is drawn, as in v3 ("Start Exam").
3. **Start.**
   - `POST assessment-start/<id>/` draws the paper and returns
     `{session_id, questions_to_show, pass_threshold_percent, exam_rules, previous_attempts, questions[], resumed}`.
     It answers 201 for a new sitting and 200 with `resumed: true` for the open one.
   - **The paper is fixed for that sitting.** A second start returns the same sitting, so a reload cannot redraw it.
   - Refusals, in order:
     - `403 chapters_not_complete`
     - `403 already_passed`
     - `403 cool_off_active`, with `cool_off_seconds_remaining` and `cool_off_ends_at`
     - `403 preview_mode`, `403 caira_access_required`
     - `409` AI Lab lock (`credit_already_earned_via_ai_lab`)
     - `404` no config or an empty bank
4. **Exam page.**
   - One question at a time, as in v3. Each question is `{id, question_text, question_type, options[{id, text,
order}]}`; only `single` has been seen. **No correct answers are in the payload.**
   - A reload gets the paper back with `GET assessment-questions/<id>/?session_id=`, or with another start, which
     resumes.
   - That read's refusals: `404 session_not_found`, `409 session_submitted`, `409 session_expired` ("start again").
   - No timer and no per-answer save, both in v3 and in the API.
5. **Submit.**
   - `POST assessment-submit/<id>/`
     `{session_id, answers: [{question_id, selected_option_ids: [uuid]}]}`, covering **exactly** that sitting's
     questions.
   - **Pass:** `{passed: true, score_percent, answers[{question_id, is_correct, explanation, correct_option_ids,
options_feedback[]}]}`, and the next step is feedback.
   - **Fail:** `{passed: false, score_percent}` and a message ("Score below 70%. … Retry when ready.").
   - `200 {reset_required: true}` when the 365-day window has expired and all progress was reset.
   - A pass does **not** award anything yet. It stamps the pass; CPE, the Credly badge and the certificate come with
     the feedback.
6. **Result dialog.** As in v3:
   - **Pass:** confetti, "View Detailed Report", "Back to Course".
   - **Fail:** "Retake" (a new start), "Return to Study Material".
7. **Report page.**
   - `GET assessment-report/<id>/` **always answers**:
     `{status: passed | failed | not_attempted, attempt_count, pass_threshold_percent, questions_to_show,
attempt_id, score_percent, attempted_at, passed_at, total_questions, correct_count, skipped_count,
feedback_withheld, answers[]}`.
   - `GET assessment-result/<id>/` is the latest attempt, question by question:
     `answers[{question_text, is_skipped, is_correct, selected_option_ids, correct_option_ids, options[{text,
is_correct, explanation, was_selected}]}]`.
   - The result read 404s before the first attempt ("No assessment attempt found"). It also **withholds correct
     answers on a failed attempt** for courses without a question bank (NASBA 6.01.2(1)(ii)).
8. **Feedback.**
   - `GET feedback-questions/<id>/`: `{questions[{id, text, type: "rating", order}]}`; five NASBA rating questions
     on UAT.
   - Gated: `403 assessment_not_passed` before a pass, `403 feedback_already_submitted` after.
   - `POST feedback-submit/<id>/`:
     `{responses: [{question_id, rating, text_response}], optional_feedback_text}`.
   - It **runs the closure pipeline** and answers `{feedback_submitted, cpe_awarded, badge_issued,
certificate_triggered}`.
   - It can be submitted only once, and never edited.
   - `GET feedback-responses/?course_id=` gives the read-only view of submitted feedback:
     `{submitted, submitted_at, question_count, answered_count, responses (paged)}`.
9. **Certificate.**
   - The PDF is generated **asynchronously**: the Masterclass service calls back the inbound webhook
     `api/v1/masterclass/webhooks/certificate/<id>/`, which is not for clients.
   - Once it exists, `masterclass_certificate_generated` turns true and `masterclass_certificate_url` is set on
     `course-detail/` and `course-progress/`.
   - Download means opening that URL. This repo already does it on the masterclass hero
     (`course-detail-facade.ts:538-542`).
   - Credly: `credly_badge_accepted_url` and the other `credly_*` fields on the same reads.
   - CPE tracker / badge library: `certificate_url` per badge row on `web-api/v1/badges/page/`.

## 3. What changes from v3

| v3 (legacy)                                                              | New API                                                                                            | Effect on the UI                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Numeric ids; `masterclass_id` / `podcast_id` / `nano_learning_id` keys   | the course UUID in the path, for every type                                                        | no id-key switch; `Number(id)` code goes                                               |
| Questions cached in localStorage, one global `session_id` key            | the sitting lives on the server and start resumes it                                               | no localStorage cache needed, so the cross-course `session_id` bug disappears          |
| `option_a..d` + `answer: 'a'..'d'`                                       | option UUIDs, `selected_option_ids[]`                                                              | new question model                                                                     |
| `correct_option` could reach the browser                                 | never before submit                                                                                | removes the answer-leak risk                                                           |
| Report by `userassessment_id` = the route's `:sessionId`                 | report and result by course id (latest attempt)                                                    | the `:sessionId` in the report URL is no longer needed by the API                      |
| Pass mark, attempts: server values, no cool-off                          | `pass_threshold_percent`, `previous_attempts`, `cool_off_active` with seconds remaining            | a "try again in …" state is new                                                        |
| Feedback categories + 1–5 stars + comment                                | typed questions (`rating`), per-question `text_response`, `optional_feedback_text`                 | form maps to `questions[]`                                                             |
| Feedback submit returned NASBA and Miles certificate URLs                | returns `certificate_triggered` only; the URL arrives later on `course-detail` / `course-progress` | "Download" must wait for `masterclass_certificate_url`; poll or refetch after feedback |
| Certificate dialog: one PDF per field of study (NASBA and Miles), zipped | one `masterclass_certificate_url`                                                                  | single download; see Q1                                                                |
| Hero and in-player tile derived unlock differently                       | `show_final_assessment`, `show_feedback` computed by the server                                    | one rule everywhere                                                                    |
| —                                                                        | `reset_required` (365-day window) on submit, feedback, questions                                   | new "your window expired" state                                                        |

## 4. By course type

- **Masterclass (`course`):**
  - Fully on the new surface: course and chapter pages (#137), chapter quiz, `course-detail` flags.
  - Only the assessment, feedback and certificate steps are left. **Start here.**
- **Podcast and micro-learning:**
  - They use the same endpoints with the course UUID (`docs/MASTERCLASS_PODCAST_AND_REELS.md` §3).
  - **Blocked twice:**
    - Their pages here still run on legacy `v2/` numeric ids, so they have no UUID to send.
    - UAT has no podcasts or reels on the new surface yet (`count: 0`, doc §8).
  - They follow after their page rebinds.
- **Nano reels:**
  - No chapter quiz; 2 questions at 100% to pass; always 0.2 CPE.
  - **A fail erases watch progress** (`action_status: REWATCH`, `progress_reset`). Neither field is in a captured
    example yet (Q3).
- **AI Lab:** separate `web-api/v1/ai-labs/course-*` routes. Out of scope.

## 5. This repo today

Nothing in the flow works:

- **Legacy calls only.** Start, questions, submit, report, feedback and the certificate dialog all call legacy
  paths, which 404 on UAT (`prompts/envelope-fallout.md`). The calls are in:
  - `features/offerings/models/assessment.model.ts`
  - `services/final-assessment-facade.ts`
  - `services/feedback-facade.ts`
  - `Utils.startFinalAssessment`
  - `shared/dialogs/certificate-download-dialog`
- **No entry for masterclass.** The CTA was hidden on purpose (`masterclass-course-hero.ts:47-51`,
  `course-chapter-facade.ts:59`). After the last chapter quiz, `CourseChapterQuizFacade.proceed()` goes back to the
  course page.
- **UUIDs become `NaN`.** The exam, report and feedback routes exist under masterclass, but use `+courseId` /
  `Number(id)`.
- **Feedback submit is blocked in the client.** `course-feedback.ts:45-46` has an inert `currentUser` ponytail, so
  the profile gate always opens.
- **The certificate already works.** The masterclass hero opens `masterclass_certificate_url`; that path already
  works on web-api.
- **Legacy models have no trust-boundary guards.** The web-api pattern to copy is `parseChapterQuiz` /
  `parseQuizSubmit` in `chapter-quiz.model.ts`, plus `contract-guards.ts`.

## 6. Questions for the backend

1. **Certificate variants:**
   - v3 downloaded one PDF per field of study, with NASBA and Miles versions.
   - The new reads expose one `masterclass_certificate_url`. Is it the NASBA certificate?
   - Are the per-field and Miles versions gone, or is a list endpoint missing?
2. **Certificate timing:** `feedback-submit` answers `certificate_triggered: true` with no URL. How long until
   `masterclass_certificate_url` is set? Should the client refetch `course-progress/`, and how often?
3. **Submit response, not captured yet:**
   - `next_step: "feedback"` (named in the description, absent from the examples).
   - `action_status`.
   - `progress_reset` for a failed nano reel.
   - Please capture a live pass, a fail, and a nano fail.
4. **Question types:**
   - `question_type` is `single` in every example, yet the submit takes `selected_option_ids[]`. Can `multiple`
     occur?
   - Feedback: is `rating` 1–5? Are there `text` questions, given the `text_response` field?
5. **Report and result:**
   - `assessment-report`'s `answers[]` is empty in the only example. Please capture one after an attempt.
   - Which read should the report page use? The report always answers; the result 404s before an attempt and
     withholds correct answers on a fail.
6. **Profile gate:** v3 required a complete profile before feedback, because the name goes on the certificate. Does
   `feedback-submit` enforce it, or must the client?
7. **CPE tracker downloads:** "Download all" (`download_bulk_certificate`) and the NASBA template have no web-api
   route. Needed later, outside this flow.

## 7. Suggested split (Story MIL-107, one PR per subtask)

1. **MIL-108 — Entry + exam.**
   - The masterclass hero CTA and the in-player last-chapter tile from `show_final_assessment`.
   - The rules dialog from `exam_rules`.
   - `assessment-start`, then the exam page on the new question model; resume through `assessment-questions` or
     another start.
   - `assessment-submit` and the result dialog.
   - States: cool-off, `reset_required`, preview.
   - Remove the legacy start, questions and submit calls.
2. **MIL-109 — Report page:** `assessment-report` (+ `assessment-result` for the review), keyed by course. Drop
   `userassessment_id`.
3. **MIL-110 — Feedback:**
   - `feedback-questions`, `feedback-submit` and `feedback-responses`.
   - Remove the inert `currentUser` gate once Q6 is answered.
   - Keep the webinar feedback separate (`web-api/v1/webinar/<id>/feedback/…`); it reuses this page.
4. **MIL-111 — Certificate:** after feedback, refetch `course-detail` / `course-progress` until
   `masterclass_certificate_url` arrives, then open it. Retire the legacy dialog's `download_certificate` call for
   masterclass.
5. **Later, separate tickets:**
   - Podcast and micro-learning, after their page rebinds and once UAT has content.
   - CPE tracker certificates on `badges/page/`.
