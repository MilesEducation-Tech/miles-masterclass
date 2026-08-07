---
name: assessments
description: Quizzes, exams and feedback in Miles Masterclass v3 — per-chapter quizzes, the final assessment exam and report, the exam navigation guard, and course feedback. Read before touching chapter-quiz, final-assessment-exam, final-assessment-report, course-feedback, or their facades.
---

# Assessments

Three distinct things. Don't conflate them.

|               | Chapter quiz        | Final assessment               | Feedback         |
| ------------- | ------------------- | ------------------------------ | ---------------- |
| Scope         | One chapter / reel  | The whole course               | The whole course |
| Awards credit | No — gates progress | **Yes** — plus the certificate | No               |
| Facade        | `ChapterFacade`     | `FinalAssessmentFacade`        | `FeedbackFacade` |
| Retryable     | Yes                 | Per business rules             | n/a              |

## Files

```
features/offerings/shared/
├── components/chapter-quiz/
├── pages/final-assessment-exam/
├── pages/final-assessment-report/
├── pages/course-feedback/
└── services/{chapter-facade,final-assessment-facade,feedback-facade}/

features/offerings/micro-learning/shared/components/micro-learning-quiz-dialog/   # reel quiz
shared/components/dialog/assessment-result-dialog/
shared/core/models/assessment.model.ts
shared/core/guards/can-deactivate-exam-guard.ts
```

## Chapter quiz

Via `ChapterFacade`:

- `submitQuizAnswer(answer, quizQuestionId)` — one answer at a time, not a batch.
- `updateUserSelectedOption(chapterId, questionId, selectedOption)` — local selection state.
- `fetchQuizReport(chapterId)` — results after submission.
- `updateChapterStatus(chapterId)` — marks the chapter complete once the quiz passes.

Micro-learning uses `micro-learning-quiz-dialog` for the same flow in the reel feed. A failed quiz gates the next chapter; that gate lives in the facade, never in the component.

## Final assessment

`FinalAssessmentFacade`:

- State: `sessionId`, `courseId`, `isAssessmentPassed`.
- `loadAssessmentData()` → `{ questions, details }`.
- `updateQuestion(questionId, selectedOption)` / `getQuestions()` — in-memory answers during the exam.
- `submitAssessment(answers)` → `SubmitFinalAssessmentResponse`.
- `getAssessmentReport(userAssessmentId)`, `getCourseDetails(courseId)`, `clearAssessmentData()`.

Routes, per content type:

```
masterclass/:courseId/:courseTitle/final-assessment/:sessionId/exam      ← camelCase
podcast/…/final-assessment/:session_id/exam                              ← snake_case
micro-learning/…/final-assessment/:session_id/exam                       ← snake_case
                                    …/report
```

All three exam routes are **`RenderMode.Client`** in `app.routes.server.ts` — live exam state must never be server-rendered or cached. Do not change this.

Entry is `MasterclassFacade.startFinalAssessment(courseId, courseTitle, courseType)`, which creates the session. Never construct an exam URL by hand — a fabricated session id fails server-side, silently.

## The exam navigation guard

`canDeactivateExamGuard` blocks navigation out of an in-progress exam. It must stay attached to every exam route. Answers live in memory until `submitAssessment` — losing the page loses the attempt.

For the same reason: no auto-save that posts partial answers, and no "restore my draft" feature. Both change the compliance meaning of an attempt.

## Results

`submitAssessment` → `assessment-result-dialog` → on pass, the certificate becomes available (`Utils` / `dialog/certificate-download-dialog`) and the CPE tracker picks up the credit. `final-assessment-report` renders the detailed breakdown from `getAssessmentReport`.

The pass/fail decision is the **server's**. `isAssessmentPassed` mirrors the response; never compute a threshold client-side.

## Feedback

`FeedbackFacade` + `course-feedback` page, at `.../feedback` for every content type. Optional, no credit impact. `MasterclassFacade.submitFeedback()` and `WebinarFacade.submitFeedback()` route into it.

## Gotchas

- Exam state is in-memory by design. Any persistence you add is a compliance decision, not a UX improvement — raise it, don't implement it.
- `clearAssessmentData()` on destroy, or the next attempt starts with stale answers.
- Chapter quiz ≠ final assessment. Only the final assessment awards credit.
- `assessment.model.ts` is the canonical shape — don't define local question types.
- Credits render via `TotalCpeCreditsPipe` from `FieldOfStudy`; never sum by hand.

## Verify

```bash
pnpm start
```

1. Chapter quiz — answer, submit, see the report; a failed quiz gates the next chapter.
2. Complete a course → final assessment launches with a real session id.
3. **Try to navigate away mid-exam** — the guard blocks it.
4. Submit — result dialog, then the report page.
5. On pass — certificate downloads and the credit shows in `/cpe-tracker`.
6. Reload the exam URL directly — session handling, and confirm the page is client-rendered (`view-source` shows the shell, not the questions).
