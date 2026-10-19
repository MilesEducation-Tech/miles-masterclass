# MIL-109: show the masterclass assessment report from the web API

**Status:** revision 1, 2026-10-19, approved and implemented.

**Branch:** `feat/MIL-109-assessment-report`, cut from `master` `bf0b434` (MIL-108, #175, merged). One commit.

**Input:**

- `prompts/final-assessment-analysis.md` (§2.7, §6 Q5)
- `prompts/masterclass-final-assessment-exam.md` (MIL-108)

## Jira

```
Story  MIL-107  feat(offerings): bind the masterclass final assessment, feedback and certificate to the web API
  Sub  MIL-108  feat(offerings): start and submit the masterclass final assessment on the web API   ✅ #175
  Sub  MIL-109  feat(offerings): show the masterclass assessment report from the web API           ← this plan
  Sub  MIL-110  feat(offerings): bind course feedback to the web API
  Sub  MIL-111  feat(offerings): download the masterclass certificate after feedback
```

## Assumptions (read first)

1. **Two reads: `assessment-report` for the summary, `assessment-result` for the question review.**
   - **`assessment-report`** always answers. It has three states (`passed`, `failed`, `not_attempted`), the pass
     mark, the attempt count and `feedback_withheld`. Its `answers[]` is empty in the only captured example, so its
     per-question shape is unknown and is not read. Guessing it would put an invented contract on screen.
   - **`assessment-result`** has a captured example of the per-question shape: the selected options, the correct
     options, and an explanation per option. It 404s before the first attempt, so it is requested only once the
     report says there is an attempt.
   - **Follow-up:** if a live capture shows that the report's `answers[]` has the result's shape, the second read can
     go in a follow-up.
2. **The report URL loses `:sessionId`: `…/final-assessment/report`.**
   - Both reads are keyed by course (the latest attempt), so the session id no longer reaches the API.
   - No redirect from the old shape. Nothing has linked to it since MIL-108, and before that its ids were the
     legacy numeric ones.
3. **Feedback and certificate buttons are not on the report yet.**
   - v3's report header had "Submit Feedback" and "Download Certificate". Feedback is still on legacy calls (MIL-110),
     and the certificate is MIL-111, so each ticket adds its own button here.
   - Until then, the hero's Download button (already on the web API) covers the certificate.
4. **`feedback_withheld` decides whether correct answers show.**
   - The backend withholds them on a failed attempt against a bank-less course (NASBA 6.01.2(1)(ii)).
   - The page reads the report's flag rather than inferring it from empty fields. The result guard tolerates the
     withheld fields being `null` or empty.
5. **One new entry point beyond v3: "View Report" on the course hero.**
   - v3 reached the report from the in-player "Final Assessment · View Report" tile. The masterclass chapter page here
     has no such tile, so without this the report is reachable only from the result dialog, once.
   - It is gated on `final_assessment_submitted` (signed in), which the course read already carries. Whether that
     flag means any attempt or a pass is still undocumented (MIL-108 Q8). Both are fine here, because the report
     page renders a failed attempt too.

## Endpoint map

| Read              | Route (`web-api/v1/masterclass/`) | Auth              | Used for                                     |
| ----------------- | --------------------------------- | ----------------- | -------------------------------------------- |
| Report            | `GET assessment-report/<course>/` | `IsAuthenticated` | state, score, counts, pass mark, withholding |
| Result (attempt)  | `GET assessment-result/<course>/` | `IsAuthenticated` | the question-by-question review              |
| Course (existing) | `GET course-detail/<course>/`     | `AllowAny`        | `final_assessment_submitted` for the hero    |

**Report `data`, the keys read:**

- `has_final_assessment` (bool), `status` (`passed` | `failed` | `not_attempted`)
- `attempt_count`, `pass_threshold_percent`, `total_questions`, `correct_count`, `skipped_count` (numbers)
- `score_percent` (number | null), `attempted_at`, `passed_at` (ISO string | null)
- `feedback_withheld` (bool)

**Its refusals:** 404 "Course not found." and 500.

**Result `data`, the keys read:**

- `answers[]`, each with:
  - `question_id`, `question_text`
  - `is_skipped`, `is_correct`
  - `explanation` (string | null)
  - `selected_option_ids[]`, `correct_option_ids[]`
  - `options[]`, each `{id, text, is_correct (bool | null), explanation (string | null), was_selected}`

**Its refusals:**

- `403 caira_access_required`
- 404, which reads differently for no course, no config and no attempt
- `409` for an AI Lab lock (`credit_already_earned_via_ai_lab`)
- 500

## Target architecture

- **`FinalAssessmentFacade`** (course route, beside `CourseDetailFacade`) gains the report, opted into the same way as
  the exam's paper:
  - `canViewReport`: signed in and `final_assessment_submitted`.
  - `openReport(open)`: the report page turns the reads on, and off again when it goes.
  - `reportResource`: `httpResource`, browser-only, gated on `isAuthenticated()` (the boolean), with
    `parse: parseAssessmentReport`.
  - `attemptResource`: requested only once the report has loaded with `status !== 'not_attempted'`, with
    `parse: parseAssessmentAttempt`.
  - `report`, `attempt`, `isReportLoading`, `reportError`, `attemptError`. The errors are messages, from
    `readCourseStepRefusal`.
  - `reloadReport()` reloads both reads.
  - `reportPath()` / `viewReport()`: `${coursePath}/final-assessment/report`, used by the hero and the result dialog.
- **`CourseDetailFacade`** gains `assessmentReportUrl()` and `assessmentResultUrl()`, like `assessmentQuestionsUrl()`.
- **The report page** connects `CourseDetailFacade` itself (a direct load arrives without the course page), as the exam
  page does. It holds only view state: the "wrong answers only" filter. Its states:
  1. Loading: `app-page-loading`.
  2. The report failed: `app-error-state` with Try again.
  3. `has_final_assessment: false`: "No final assessment" and Back to Course.
  4. `not_attempted`: "No attempt yet". Take Final Assessment when `canStart()`, and Back to Course.
  5. Attempted:
     - **Header:** "Exam Report" and Back to Course.
     - **Summary:** Passed / Not passed, the score, correct/total, skipped (when > 0), the pass mark, "Completed on"
       (`attempted_at | date: 'longDate'`), and the attempt count.
     - **Retake:** "Retake Assessment" on a fail when `canStart()`.
     - **Review:**
       - "Exam Questions", with a "Show wrong answers only" `app-switch` (skipped counts as wrong).
       - An `app-accordion` (`type="multiple"`). Each item is "n. question" with a Correct / Incorrect / Skipped
         badge.
       - Each opens to "Your answer" (or "Not answered"); "Correct answer" when wrong and not withheld; and
         "Explanation" (the question's own, else the correct option's) when not withheld.
       - A withheld attempt shows one note above the list instead.
       - If the review read fails, the error shows in the review section, with Try again, and the summary stays.
- **The result dialog:** a pass shows "View Detailed Report" (primary) above "Back to Course". The action type becomes
  `'course' | 'retake' | 'report'`, and the exam page sends `'report'` to `facade.viewReport()`.
- **The course hero:** "View Report" (outline) next to the main button when `canViewReport()`.
- **`AccordionItem`** (`shared/ui`) gains an optional trailing slot (`[accordionTrailing]`) before the chevron, for the
  badge. Existing usages are unchanged, because the slot is empty unless filled.

## Files touched

| File                                                                  | Change                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `features/offerings/constants/course-detail.ts`                       | `assessmentReport`, `assessmentResult` URLs; `ASSESSMENT_REPORT_COPY`       |
| `features/offerings/models/course-detail.model.ts`                    | `CourseDetailApi` +2 keys; `final_assessment_submitted` + its guard         |
| `features/offerings/models/final-assessment.model.ts`                 | `AssessmentReport`, `AssessmentAttempt` (+ answer, option), the two parsers |
| `features/offerings/services/course-detail-facade.ts`                 | `assessmentReportUrl()`, `assessmentResultUrl()`                            |
| `features/offerings/services/final-assessment-facade.ts`              | the report reads, `canViewReport`, `openReport`, `reportPath`, `viewReport` |
| `features/offerings/pages/final-assessment-report/*.ts\|html`         | rebuilt                                                                     |
| `features/offerings/dialogs/assessment-result-dialog/*.ts\|html`      | `'report'` action, "View Detailed Report"                                   |
| `features/offerings/pages/final-assessment-exam/*.ts`                 | handle `'report'`                                                           |
| `features/offerings/masterclass/components/masterclass-course-hero/*` | "View Report"                                                               |
| `features/offerings/masterclass/masterclass.routes.ts`                | `final-assessment/report`                                                   |
| `app.routes.server.ts`                                                | the report route renders client-side, like the exam                         |
| `shared/ui/accordion/accordion-item.ts` (+ story)                     | optional trailing slot                                                      |
| `docs/refactor/STATE.md`                                              | "Now"                                                                       |

**Estimate:** about 450 changed lines, a little over the ~400 guide. Splitting off the entry points would ship a page
nothing links to, so it stays one PR.

**Actual:** +717 / −31 across 17 files. The report template (~180 lines) and the model's types, guards and review
mapping (~185) ran over the estimate; the entry points stayed as small as planned (~40).

## Security

- **Reads only.** Both are `IsAuthenticated`, sent by the interceptors' bearer, never a hand-attached header.
- **The trust boundary:** both responses go through `parse` guards. A drifted shape lands in `error()` and the logs,
  never half-rendered.
- **Withheld answers stay hidden:** the page never shows a correct answer when `feedback_withheld` is set, even if a
  field arrives.
- **The route keeps `authGuard`.**

## Acceptance criteria

1. **Passed:** the result dialog's "View Detailed Report" opens `…/final-assessment/report`, which shows Passed, the
   score, correct/total, the pass mark and the date. It makes one `assessment-report` and one `assessment-result`
   request.
2. **Review:**
   - Each question shows the learner's answer, the correct answer when it was wrong, and the explanation.
   - "Show wrong answers only" filters the list.
   - With no wrong answers, the list says so.
3. **Failed and withheld:** no correct answer or explanation shows, and one note says why. Retake shows when
   `canStart()`.
4. **Not attempted:** no `assessment-result` request. "No attempt yet", with Take Final Assessment when allowed.
5. **Errors:**
   - A report failure shows the error state with Try again.
   - A result failure (409, 403, 404) shows inline with the server's message, and the summary stays.
6. **Hero:**
   - "View Report" shows only signed in with `final_assessment_submitted: true`, and opens the report.
   - Signed out, it never shows.
7. **Direct load and reload** of the report URL work: the page connects the course itself.
8. **Signed out:** the report URL goes to sign-in and back (`authGuard`).
9. **375 px:** no horizontal scroll.
10. **Console:** no errors besides the refusals that checks trigger.

## Checks

- `pnpm lint` (0 errors), `pnpm check:structure`, `pnpm format:fix`
- `pnpm build:prod`: only the known `ai-labs.css` warning
- `node scripts/refactor/verify.mjs`, while the harness is active

## How to verify

- **Headless, on dev 4101, as in MIL-108:**
  - Signed in with a dummy token, with `course-detail` and both reads stubbed from Postman's captured shapes.
  - Covers passed, failed + withheld, not attempted, no assessment, report 500, and result 409.
  - Also: the filter, the hero, the dialog → report, a direct reload, signed out, and 375 px.
- **Live UAT, with your account:**
  1. Open a course where you have sat the assessment.
  2. Click "View Report".
  3. Check the numbers against your attempt.
  4. **Please copy the `assessment-report` response from DevTools → Network.** Its `answers[]` decides whether the
     second read can go later.

## Risks

- **The withheld result's shape is not captured.** If the backend omits keys rather than nulling them, the review read
  fails into its inline error. The summary still shows, and the log names the route.
- **`final_assessment_submitted`'s meaning** (any attempt or a pass) is still unconfirmed. Either way the hero link is
  correct, because the page handles both outcomes.
- **Stale doc:** AGENTS.md §5's row on `assessment.model.ts` and `:sessionId` has been stale since MIL-108. It is out
  of scope here; I'll flag it as its own docs change.
- **Podcast:** `podcast-chapter.ts` still builds the old podcast report URL. That route has been gone since MIL-108
  (D1), and it returns with the podcast rebind.
