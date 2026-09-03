# AI Labs: catalogue carousels + course-page flow rewire

> Implementation prompt. Approved via plan mode on 2026-09-02 (full plan: `~/.claude/plans/engineering-architecture-angular-develo-ethereal-kettle.md`).

## Goal

Show every track course on `/ai-labs` in a carousel (no three-card cap), and rewire the AI Lab course page to video → quiz → final assessment → AI Lab (real agents / submit / status APIs, polled) → scores → feedback/certificate.

## What it read

- Skills: `angular-conventions`, `ui-components`, `core-services`, `media-players`, `assessments`, `micro-learning`
- Files inspected: `src/app/pages/ai-labs/{ai-labs.ts,ai-labs.html,ai-labs.model.ts,ai-lab-submission.ts}`, `src/app/pages/ai-labs/course/*`, `src/app/features/offerings/shared/services/micro-learning-course-facade/micro-learning-course-facade.ts`, `src/app/shared/core/models/micro-learning-course.model.ts`, `src/app/shared/components/carousel/*`, `src/app/shared/core/services/ai-labs-auth/ai-labs-auth.ts`, `src/app/shared/core/interceptors/app/app-interceptor.ts`

## Assumptions

- `GET ai-lab/agents/` returns `{ status_code, data: AiLabAgent[] }` with `agent_env_id`, `agent_schema` and a `name` label (sample pending — field names to align).
- `POST ai-lab/assignments/submit/` response body is not relied on; the first status GET after it is the truth.
- `GET ai-lab/assignments/status/` shape is confirmed (`lab_status: not_started | in_progress | completed | error`, `score` /10, `percentage`, `master_comment`, `grade_card_pdf_url`, `evaluated_at`).
- No lab pass mark: `completed` unlocks feedback / certificate.
- Account provisioning (terms → POST → email) stays on the landing hero; the course page redirects there if `is_ai_lab_user` is false.
- Catalogue rails read page one of `v2/tracks/:id/courses/` only.

## Files that will change

| File                                                                                                      | Create / Modify | Why                                                                             |
| --------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------- |
| `src/app/pages/ai-labs/ai-labs.ts`                                                                        | Modify          | drop `.slice(0, 3)` + `slides` padding; rail config with breakpoints            |
| `src/app/pages/ai-labs/ai-labs.html`                                                                      | Modify          | one `<app-carousel>` per track on every viewport                                |
| `src/app/features/offerings/shared/services/micro-learning-course-facade/micro-learning-course-facade.ts` | Modify          | `ai_lab` course with no quiz falls through to the exam                          |
| `src/app/pages/ai-labs/ai-labs.model.ts`                                                                  | Modify          | real API models + routes; delete mock rubric/agent models                       |
| `src/app/pages/ai-labs/ai-lab-submission.ts`                                                              | Modify          | replace mock with `listAgents` / `submitAssignment` / `assignmentStatus`        |
| `src/app/pages/ai-labs/course/ai-lab-course.ts` / `.html`                                                 | Modify          | exam-gated lab, Launch AI, agent picker, polling, score panel, certificate gate |
| `src/app/pages/ai-labs/course/ai-lab-grade-card.ts` / `.html`                                             | Delete          | bound to the mock rubric shape                                                  |

## Implementation requirements

- Lab unlocks on `user_assessment_details.status === 'Exam_Passed'`; feedback/certificate CTAs are replaced by "Go to the AI Lab" until `lab_status === 'completed'`.
- Launch AI: signed in to Entra → open Copilot Studio + fetch agents; signed out → `AiLabsAuth.signIn()` popup; no lab account → toast + redirect to `/ai-labs`.
- Agents fetched only after Launch (component `resource()`, `reload()` on Refresh); selection kept across refresh via `linkedSignal`.
- Submit → optimistic `in_progress` → `timer(0, 5s)` + `exhaustMap` + `retry(3)` + `takeWhile(in_progress)` + `takeUntilDestroyed`; browser only.
- On load with exam passed: one status GET restores idle / polling / scores / error.

## UI requirements

- Sections: 01 Final assessment → 02 AI Lab → 03 Evaluation & scores; sub-bar `n / 4`.
- States: loading (carousel skeletons, "Loading agents…"), empty ("No agents yet…"), error (`app-error-state` with retry), disabled (locked controls stay disabled, not removed).
- Tailwind tokens only; `role="status" aria-live="polite"` on the in-progress card.

## Security requirements

- Bearer token via `appInterceptor` only; no hand-written `Authorization`.
- `SKIP_ERROR_NOTIFICATION` on the status poll; interceptor toasts submit errors.

## Acceptance criteria

- [ ] Every track course appears in the rail (1.15 / 2 / 3 slides at 375 / 768 / 1280 px).
- [ ] No-quiz AI Lab course opens the exam rules dialog at 95% instead of a toast.
- [ ] Lab locked until exam passed; feedback locked until evaluation completed.
- [ ] Reload mid-evaluation resumes polling; navigating away stops it.

## Checks to run

```bash
npx ngc -p tsconfig.app.json --noEmit
pnpm build:prod
```

## How to verify it

1. `pnpm start`
2. Open `http://localhost:4100/us/cpa/ai-labs` and `http://localhost:4100/us/cpa/ai-labs/<courseId>/<slug>`
3. Follow the Verification list in the plan file (steps 2–8).
