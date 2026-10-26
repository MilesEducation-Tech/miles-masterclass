# AI Labs: the course page redesign from miles-masterclass-v3 (UI/UX only)

## Goal

Bring the AI Lab course page up to upstream's latest design (`miles-masterclass-v3`, `feat/ai-labs-refactor`,
commits `0995ed80` → `c32d03ca`, after the `ce0194a4` we ported). **UI/UX only** (user, 2026-10-26): upstream's
data binding is not ported — our APIs differ. Every section reads from our existing `AiLabCourseFacade`; where the
new design shows data no API of ours serves yet, the facade gets a typed, empty slot to bind later, and the section
renders its empty / locked state in the app. The stories show the full design with sample data.

## What was read

- Upstream `src/app/pages/ai-lab/course/`: `ai-lab-course.html` (2267 lines), `.ts` (2174), `.css` (94), and the new
  `ai-lab-step.ts|html`, `course-journey.ts`, `brief-markdown.ts`. Model changes in `ai-lab.model.ts`.
- Ours: `features/ai-labs/pages/ai-lab-course/*`, `services/ai-lab-course-facade.ts`, `models/ai-labs.model.ts`,
  the story stand-in in `testing/mocks/ai-labs.mock.ts`.

## The new design

- **Hero** (video + CTA cluster), **description + learning objectives**, then the **course journey**:
  - a **sticky sidebar**: a progress overview (score ring, stage title and copy, "next" button, milestones) and a
    step navigator with scrollspy;
  - five numbered **step sections**, each in an `app-ai-lab-step` shell (index, state-tinted rule, status chip,
    reveal-on-scroll): **01 Final MCQ assessment**, **02 Miles AI Lab** (brief, build guide + Launch AI panel,
    picker + submit), **03 Lab materials** (file tiles, workspace links, flow chart, sample grade card),
    **04 Hints** (one-at-a-time tabs), **05 Evaluation & scores** (score ring, latest grade, attempts allowance,
    history tabs).
- **Instructor** and **CPE credit & accreditation** sections at the bottom.
- `course-journey.ts`: pure step-state logic (`done | current | attention | locked | open`) + the overview's stage
  copy. `brief-markdown.ts`: a tiny escape-first Markdown renderer for the brief's problem statement.
- CSS: the score ring (`@property` + conic gradient + fill keyframes), the travelling border glow, the brief's fade
  mask — all within §4.6's allowed reasons (keyframes, pseudo-elements, masks).

## Locked decisions

1. **Our gate stays: the lab opens after the final assessment is passed.** Upstream's `c32d03ca` opens it on an
   active plan instead, but our backend refuses `assignment-submit/` with `final_assessment_not_passed`. The journey's
   `subscribed` gate becomes `labOpen = examPassed`; copy that says the lab "doesn't wait on the exam" is adjusted.
2. **`@angular/aria` tabs → our `shared/ui` tabs (ng-primitives)**; `app-aria-select` → our `app-select`.
   Relative imports → aliases.
3. **No invented data in front of a learner.** New data with no API of ours gets an empty facade slot:

   | Design needs                                                   | Our source today                        | In the app until bound                                  |
   | -------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
   | Exercise files                                                 | brief `input_files`                     | **bound** (as now)                                      |
   | Problem statement (Markdown), guardrails                       | brief                                   | **bound**, now rendered via `brief-markdown`            |
   | Workspace link                                                 | `ai_lab_course_sharepoint_artefact_url` | **bound**                                               |
   | AI kit                                                         | `course/<id>/` `ai_kit`                 | **bound** (into materials)                              |
   | Latest grade, grade card, evaluating / failed                  | `assignment-status/`                    | **bound**                                               |
   | Requirements, build guides, flow chart, sample grade card      | —                                       | slot empty → tile hidden                                |
   | Hints                                                          | —                                       | slot empty → step 04 shows "No hints for this lab yet"  |
   | Attempts allowance, history (up to 3, per-attempt grade cards) | —                                       | slot empty → history tabs hidden, allowance line hidden |
   | Trigger-email                                                  | —                                       | not rendered                                            |

4. **Upstream's behaviours that are pure UI come across:** scrollspy, step reveal, hint/history paging, rules
   toggle, glow on the current step, the score ring animation.
5. Template-only members `protected readonly`; components inject the facade (AGENTS.md §3); `cn()` for classes.

## Files

- **New:** `features/ai-labs/components/ai-lab-step/ai-lab-step.ts|html`, `features/ai-labs/utils/course-journey.ts`,
  `features/ai-labs/utils/brief-markdown.ts`, `pages/ai-lab-course/ai-lab-course.css`.
- **Rewritten:** `pages/ai-lab-course/ai-lab-course.html|ts` (inline `styles` move to the `.css`).
- **Extended:** `AiLabCourseFacade` (empty slots: `requirements`, `buildGuides`, `flowChart`, `sampleGradeCard`,
  `hints`, `attempts`), `ai-labs.model.ts` (their types, from upstream's model), the story stand-in + mocks,
  `ai-lab-course.stories.ts` (journey states + filled materials / hints / history).

## Size and split

About 2,500 changed lines — far over the ~400 guideline, and one page can't be split by file without a broken
middle state. Proposed: **two commits on this branch, one PR**, reviewed commit by commit:

1. Shell + journey: step component, `course-journey`, overview sidebar + navigator, hero, description, steps 01–02,
   instructor, CPE, CSS.
2. Steps 03–05: materials, hints, evaluation & scores, the facade slots, stories.

## Acceptance

- At 375 / 768 / 1440: the sidebar sticks on desktop and stacks on mobile; the navigator tracks the section in view;
  steps reveal on scroll (not on the server, not with reduced motion).
- Journey states follow our gates for: not started, watching, video done, exam failed, exam passed (lab open),
  evaluating, evaluation failed, graded.
- Everything bound today still works: trailer / lab video / progress, Start, quiz, exam + feedback routes, picker +
  submit, status poll + `assessment-refresh/`, grade card, Launch AI sign-in.
- Empty slots render no invented numbers.
- Lint, structure, Prettier, `build:prod`, `build-storybook` pass; CDP pass on dev 4101 with the mocked contract.

## Risks

- **Template size.** A 2.2k-line template ported by hand — regressions are most likely in the bound flows, so the CDP
  run repeats the course-video and submit checks.
- **The gate difference** (decision 1) changes upstream copy in a few places; every changed string is listed in the
  report.
