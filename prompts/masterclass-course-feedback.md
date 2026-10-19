# MIL-110: bind the masterclass course feedback to the web API

**Status:** revision 1, 2026-10-19, approved and implemented.

**Branch:** `feat/MIL-110-course-feedback`, stacked on `feat/MIL-109-assessment-report` (`d81d5b5`). It rebases onto
`master` after #MIL-109 merges.

**Input:**

- `prompts/final-assessment-analysis.md` (§2.8, §6 Q6)
- the App 5 Postman export: `feedback-questions`, `feedback-submit`, `feedback-responses`

## Jira

```
Story  MIL-107  feat(offerings): bind the masterclass final assessment, feedback and certificate to the web API
  Sub  MIL-108  start and submit the final assessment                         ✅ #175
  Sub  MIL-109  the assessment report                                         PR open
  Sub  MIL-110  feat(offerings): bind course feedback to the web API          ← this plan
  Sub  MIL-111  feat(offerings): download the masterclass certificate after feedback
```

## Assumptions (read first)

1. **"In the similar format, the way it was before"** (your answer on scope):
   - **The masterclass feedback page keeps today's layout:**
     - the "Course Evaluation Feedback" header, with the course and instructor
     - the "Course Evaluation Form" card
     - "1. Presenters and Course Content" with the Strongly Disagree → Strongly Agree columns and 5 stars per question
     - "2. Other Comments", then Submit
     - the "Thank You!" view
   - **Podcast, micro-learning and webinar stay exactly as they are:** their routes, the shared `course-feedback` page
     and the legacy `FeedbackFacade` are not touched.
   - So the masterclass route moves to a **new page, `course-evaluation`**, built in the same format on the web API.
   - **The legacy page is already dead:** every call it makes 404s on UAT (`feedback-category/`,
     `user-feedback/submit_feedback/`, `v2/…/details/`, `webinar/details/`, checked 2026-10-19). It is deleted when
     the last of the other three moves to its web API (webinar has `web-api/v1/webinar/<id>/feedback/…`), in their own
     tickets.
2. **The form comes from the server:** `feedback-questions` returns typed questions (5 NASBA `rating` questions on UAT)
   in place of the legacy categories.
   - **What is sent:**
     `{responses: [{question_id, rating, text_response: ""}], optional_feedback_text}`, the comments box being
     `optional_feedback_text`.
   - **Strict body:** no extra keys, because the serializer refuses undeclared fields.
3. **A submitted form can't be shown read-only yet.**
   - Before, a submitted course reopened with the learner's stars filled in. The new `feedback-responses` has `results`
     empty in every capture, so the per-answer shape is unknown.
   - Until a capture exists, a submitted course shows "Thanks, your feedback is in", with the date from
     `submitted_at`.
   - **Follow-up:** please copy that response after you submit on UAT; the read-only stars come back once the shape is
     known.
4. **The profile gate works again.**
   - The old page's gate was inert: a `currentUser` stub, always `null`, so it always opened the dialog and nobody
     could submit.
   - The new page opens the same "Complete Your Profile to Continue" dialog only when `AuthSession.isProfileCompleted()`
     is a known `false`, as webinar registration does. The certificate carries the learner's name.
   - Whether `feedback-submit` enforces this on the server is still open (analysis Q6).
5. **The name shows; the e-mail can't.**
   - Before: "Name- … / Registered E-mail ID- …".
   - `user-details/` has no e-mail (`account.model.ts`), so the page shows the name only (`displayNameOf`).
6. **No certificate on the thank-you view.**
   - The old view linked the NASBA PDF from the submit response. The new submit returns only `certificate_triggered`,
     and the PDF arrives later on `course-detail` (MIL-111).
   - The view shows "Thank You!" and the CPE awarded (`cpe_awarded`), with View Report and Back to Course.
   - When the page was opened with `?redirect=` (the CPE tracker sends one), its main button returns there instead.

## Where feedback is triggered

**In the previous app, for a masterclass:**

1. **Course hero:** "Submit Feedback" (amber) after a pass, until feedback is in. Once it's in, the hero showed the
   learner's own star rating in its place.
2. **Assessment report header:** "Submit Feedback" (amber) until feedback is in, beside "Return to course" and
   "Download Certificate". Download stayed disabled until feedback was in.
3. **CPE tracker row:** a "Feedback" action when a credit needs feedback that isn't in yet. It opened the course's
   `…/feedback` with `?redirect=` back to the tracker.
4. **Badge library and CAIRA tracker:** a card in the `submit_feedback` state opened the same `…/feedback` page.

All of them navigate to the course's `feedback` route with `?redirect=<where the learner was>`.

**Not a trigger:**

- The pass dialog. It offered "View Detailed Report" and "Back to Course" only.
- The chapter player.

**Other offerings, out of scope:** the podcast hero; the micro-learning reel card (its `FEEDBACK` action status); the
webinar hero, list item, claim card and details dialog; the AI Lab course page.

**In this repo today:**

| Trigger                                      | State                                                                                    | After MIL-110                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| CPE tracker "Feedback" (`cpe-tracker.ts`)    | Live on the web API since #174: `…/masterclass/<uuid>/<slug>/feedback?redirect=…`        | Lands on the new page, which honours `?redirect=`. No change to the tracker.                                                        |
| Badge library `submit_feedback` (`badge.ts`) | `Utils.navigateToCourseFeedback`, with the badge card's (legacy) course id               | Lands on the new page for a masterclass card. A numeric id is looked up by slug, as the course page does. No change to the library. |
| Webinar cards and details dialog             | Webinar `…/feedback` route, on the old page                                              | Unchanged                                                                                                                           |
| Course hero                                  | None (MIL-108 left a "progress, rating and feedback actions" placeholder in its comment) | **Added**                                                                                                                           |
| Assessment report header                     | None (MIL-109 left it for this ticket)                                                   | **Added**                                                                                                                           |

**Not brought back:** the hero's own-rating stars after submission. They need the learner's submitted answers, which
are the unknown `feedback-responses` shape (assumption 3).

## Endpoint map (`web-api/v1/masterclass/`, all `IsAuthenticated`)

| Call                  | Route                                    | Used for                                           |
| --------------------- | ---------------------------------------- | -------------------------------------------------- |
| `GET` questions       | `feedback-questions/<course>/`           | the form                                           |
| `POST` submit         | `feedback-submit/<course>/`              | records it, runs the closure (CPE, badge, cert)    |
| `GET` responses       | `feedback-responses/?course_id=<course>` | `submitted`, `submitted_at` for a submitted course |
| `GET` course (exists) | `course-detail/<course>/`                | `show_feedback`, `feedback_submitted` (new keys)   |

**Questions `data`:**

- `{course_id, questions[{id, text, type, order}]}`, or `{reset_required: true}` (200).
- **Refusals:**
  - `403 assessment_not_passed`, `403 feedback_already_submitted`, `403 caira_access_required`
  - `404` course, `409` AI Lab lock, `500`

**Submit `data`:**

- `{feedback_submitted, cpe_awarded, badge_issued, certificate_triggered}`, or `{reset_required: true}`.
- **Refusals:** the same as the questions read, plus `400`.

**Responses `data`:**

- `{submitted, submitted_at, question_count, answered_count, responses{…paged}}`.
- Only the first four are read.

## Target architecture

- **`COURSE_DETAIL_API.masterclass`** gains `feedbackQuestions`, `feedbackSubmit` and `feedbackResponses`.
- **`CourseDetailFacade`** gains:
  - `feedbackQuestionsUrl()`, `feedbackResponsesUrl()`
  - `submitFeedback(body)` (`ApiClient.call` + parse), beside the assessment calls
- **`MasterclassCourseDetail`** gains `show_feedback` and `feedback_submitted`, with guards; both are present
  pre-login on UAT.
- **New `models/course-evaluation.model.ts`:**
  - Types: `EvaluationQuestion`, `EvaluationForm`, `EvaluationSubmitBody`, `EvaluationOutcome`, `EvaluationStatus`.
  - Parsers: `parseEvaluationForm` (questions sorted by `order`; accepts `reset_required`), `parseEvaluationSubmit`,
    `parseEvaluationStatus`.
- **New `CourseEvaluationFacade`:**
  - **Placement:** `@Service({ autoProvided: false })` on the masterclass course route, beside `CourseDetailFacade` and
    `FinalAssessmentFacade`.
  - **Flags:**
    - `canGiveFeedback`: signed in and `show_feedback`.
    - `feedbackPath()` / `openFeedback()`.
  - **Reads**, opted in by the page (`openForm`) like the report:
    - `formResource`: browser-only, gated on `isAuthenticated()`.
    - `statusResource`: `feedback-responses`, read only when the form is refused with `feedback_already_submitted` or
      the course says `feedback_submitted`.
  - **Exposed:** `form`, `isLoading`, `refusal`, `submittedAt`.
  - **`submit(ratings, comments)`:**
    - On success, re-reads the course, so `show_feedback` turns off.
    - `reset_required` toasts the enrolment reset and goes back to the course.
    - Refusals toast in their own words.
- **New page `pages/course-evaluation/`** (same format as `course-feedback`, reusing `app-rating-star`, `app-field`,
  `app-textarea` and the button):
  - It connects `CourseDetailFacade` itself, for direct loads.
  - **States:**
    - Loading.
    - The form.
    - Submitted ("Thanks, your feedback is in", plus the date).
    - Not passed yet: "Pass the final assessment first", with View Report / Back to Course.
    - Window reset.
    - Error, with Try again.
    - The thank-you view.
  - **Submit:** disabled until every question is rated, with the profile gate before the call.
- **Entry points, as before:**
  - **Report page header:** "Submit Feedback" when `canGiveFeedback()`, styled as the CPE tracker's Feedback action
    (`bg-accent-premium text-black`, the amber token).
  - **Course hero:** "Submit Feedback" beside the main button when `canGiveFeedback()`, after a pass, as before.
  - Both navigate with `?redirect=` to where the learner was, like every other trigger.
- **Route:** the masterclass `feedback` route loads `CourseEvaluation` with `authGuard` and no `FeedbackFacade`, and
  renders client-side. Podcast, micro-learning and webinar keep `CourseFeedback`.

## Files touched

| File                                                                  | Change                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `features/offerings/constants/course-detail.ts`                       | 3 routes; `FEEDBACK_COPY`                                   |
| `features/offerings/models/course-detail.model.ts`                    | `CourseDetailApi` +3; `show_feedback`, `feedback_submitted` |
| `features/offerings/models/course-evaluation.model.ts` (new)          | types + parsers                                             |
| `features/offerings/services/course-detail-facade.ts`                 | 2 URLs + `submitFeedback()`                                 |
| `features/offerings/services/course-evaluation-facade.ts` (new)       | the feedback flow                                           |
| `features/offerings/pages/course-evaluation/*.ts\|html` (new)         | the page                                                    |
| `features/offerings/pages/final-assessment-report/*`                  | "Submit Feedback" in the header                             |
| `features/offerings/masterclass/components/masterclass-course-hero/*` | "Submit Feedback"                                           |
| `features/offerings/masterclass/masterclass.routes.ts`                | the facade provider; the route's page                       |
| `app.routes.server.ts`                                                | the feedback route renders client-side                      |
| `docs/refactor/STATE.md`                                              | "Now", step log                                             |

**Not touched:** `pages/course-feedback/*`, `services/feedback-facade.ts`, `models/feedback-model.ts`, and the
podcast, micro-learning and webinar routes.

**Estimate:** about 600 changed lines, over the ~400 guide. Most of it is the page, which is the old page's format
rebuilt. Splitting off the two entry points (about 40 lines) would ship a page nothing links to, so it stays one PR.

## Security

- **Mutations:** the submit goes through `ApiClient` with the interceptor's bearer, with no hand-attached headers.
- **Trust boundary:** both reads and the submit are parsed. A drift lands in `error()` and the logs.
- **`?redirect=`:** honoured only as an in-app path through `navigateByUrl`, as the old page did. An absolute URL never
  leaves the app.
- **Route:** keeps `authGuard`.

## Acceptance criteria

1. **Report and hero:** after a pass, the report header and the hero show "Submit Feedback" until feedback is in.
   Signed out, or before a pass, they don't.
2. **The form:** the page reads `feedback-questions` once and shows the 5 questions in `order` in the old layout.
   Submit stays disabled until all 5 are rated.
3. **Profile gate:** with a known incomplete profile, Submit opens "Complete Your Profile to Continue", which goes to
   `/auth/profile?redirect=…` and makes no submit call.
4. **Submit:**
   - The body is exactly `{responses:[{question_id, rating, text_response:""}…], optional_feedback_text}`.
   - Then the thank-you view shows, with the CPE awarded.
   - The course is re-read, and "Submit Feedback" disappears from the hero and the report.
5. **Already submitted:** "Thanks, your feedback is in" with the date, and no form.
6. **Not passed:** `403 assessment_not_passed` shows "Pass the final assessment first".
7. **Window reset:** `reset_required` shows the enrolment-reset notice and goes back to the course.
8. **Errors:**
   - A 409 or 500 on the read shows the error state with Try again.
   - A refused submit toasts and keeps the answers.
9. **Other offerings:** the podcast, micro-learning and webinar feedback URLs still load the old page, unchanged.
10. **CPE tracker:** a masterclass row's "Feedback" action opens the new page. After submitting, the main button
    returns to the tracker through its `?redirect=`.
11. **Layout:** 375 px with no horizontal scroll; a direct reload works; signed out goes to sign-in.

## Checks

`pnpm lint` (0 errors), `pnpm check:structure`, `pnpm format:fix`, `pnpm build:prod` (only `ai-labs.css`).

## How to verify

- **Headless, on dev 4101:** the course and the 3 feedback routes stubbed from Postman's shapes. Every criterion
  above, at 1440 and 375.
- **Hand test:** extend `.playwright-mcp/manual-mil109.js` so that after a pass you can click "Submit Feedback", rate,
  and submit yourself.
- **Live UAT (you):**
  1. Pass a course.
  2. Submit feedback.
  3. Copy the `feedback-responses` response, which unlocks the read-only stars.

## Risks

- **`text_response`:** sending `""` for a rating question is assumed to pass the strict serializer. If it doesn't, the
  key is omitted; that's a one-line change.
- **Unknown `results` shape** (assumption 3): until it is captured, a submitted course can't show its stars.
- **Two feedback pages for now.** The old one goes with the last of the other offerings' rebinds.
