# AI Labs: bind the 2026-10-28 guide

MIL-117 · branch `feat/MIL-117-ai-labs-refactor` · asked for directly ("check md file and do the changes").

## Goal

Bind the backend guide's 2026-10-28 changes (`docs/AI_LABS_API.md`, "What changed on 2026-10-28", A–K). The guide
says they reach UAT **with the next deploy**, so every new field is optional and the old shapes keep working.

## What I read

- **The guide:** `docs/AI_LABS_API.md`, replaced with this edition and formatted with Prettier.
- **Ours:**
  - `models/ai-labs.model.ts`, `constants/ai-labs-api.ts`
  - `services/`: `ai-lab-course-facade.ts`, `ai-lab-assessment-facade.ts`, `ai-lab-feedback-facade.ts`, `ai-labs-facade.ts`
  - `pages/`: `ai-lab-course`, `ai-lab-exam`, `ai-lab-feedback`
  - `components/ai-lab-progress-panel`
- **The parity audit's gaps that these routes close:** step 01's pass date / question count / pass mark, no exam report, and the
  "already passed" exam screen. Also: delivery method before the start, and the read-only feedback answers.

## Decisions

| #   | Change                                                                      | What we do                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `cpe_awarded` becomes a number                                              | Typed `number \| boolean` until UAT deploys. The hero hint on a finished lab says "N CPE earned" when it is a number > 0.                                                                                                                                                                                                                                                                                   |
| B,C | `final_assessment_passed_at`, MCQ facts and `delivery_method` on the detail | Step 01:<br>- reads "Passed on 27 Oct 2026";<br>- lists Questions and Pass mark beside Credits and Format;<br>- the CPE section's delivery method falls back to the detail's, so it shows before the start.                                                                                                                                                                                                 |
| D   | `course-assessment-report/`                                                 | The exam page shows the latest attempt's report when the paper is refused with `already_passed` or `cool_off_active`:<br>- v3's "Assessment Completed" / report view: score, pass mark, date, and every question with the learner's choice;<br>- a note when `feedback_withheld`.<br>Step 01 gets a "View report" link once an attempt exists. No new route: `final-assessment` already answers that state. |
| E   | `course-feedback-responses/`                                                | A learner who already submitted sees their answers read-only (v3's behaviour) instead of the bare "already in" panel.                                                                                                                                                                                                                                                                                       |
| F   | `max_score` on status, `not_started`, no-store                              | The status-only grade card shows "8 / 10" when `max_score` is sent. `not_started` needs nothing: "graded" is already `attempts_used > 0`.                                                                                                                                                                                                                                                                   |
| G   | `practical_attempts` on practical-progress                                  | The landing facade maps a row's attempts and best percentage from `practical_attempts` when present, so the panel shows our counts.                                                                                                                                                                                                                                                                         |
| H,K | Feedback re-submit amount; certificate link kept during re-render           | Nothing to do.                                                                                                                                                                                                                                                                                                                                                                                              |
| I   | Restart keeps a finished lab finished                                       | Already handled: `start()` re-reads `course-started/` and progress, and `next_step: done` drives the CTA. Comment only.                                                                                                                                                                                                                                                                                     |
| J   | Video completion at the lab's own minimum                                   | We already report until the end and let the server decide. Fix the "95%" comments.                                                                                                                                                                                                                                                                                                                          |

**Drive-by from the audit, in a file this touches:** the feedback header's "by [object Object]" becomes the
instructors' names.

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`. Verify in headless Chrome on dev 4101
with every new shape faked (the backend isn't deployed yet): the step 01 facts, the report view (passed and
withheld), the feedback read-back, the panel counts, and the hero "CPE earned" hint.

## Risks

- **The new routes 404 on UAT until the deploy.**
  - The report view falls back to today's message.
  - The feedback read-back falls back to the "already in" panel.
- **The global-question gap** (guide §9): `answered_count` can be lower than `question_count`. We list the answers we get
  and never call the form unsubmitted.
