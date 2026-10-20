# AI Labs — bring the landing page up to the current design

## Goal

Our `features/ai-labs` landing page is a port of the one in
`/Users/apple/Documents/GitHub/miles-masterclass-v3`, and that repo has moved on. Match its
**`master`** branch. UI/UX only — **no API binding**.

Subtask 1 of 3. Subtask 2 is the progress panel + token meter as unmounted components; subtask 3 is
the AI Lab course page.

## What was read

- `miles-masterclass-v3@master`: `src/app/pages/ai-lab/ai-lab.{html,css,ts,model.ts}`,
  `ai-lab.routes.ts`, `course/`, `progress/`, `tokens/`. Read with `git show master:<path>` — that
  repo is checked out on `feat/ai-labs-refactor`, which is NOT the source of truth here.
- Ours: `features/ai-labs/**`, `shared/dialogs/ai-lab-agent-dialog/**`,
  `core/services/ai-lab-submission/`, `angular.json` budgets, `structure-baseline.json`.

## Locked decisions

1. **Removals are ported too** ("do as theirs exactly"), not just additions.
2. **Progress panel and token meter are NOT in this subtask**, and when they land they are built
   but not mounted — no invented credit balances reach a learner.
3. **Catalogue cards navigate to the course page**, retiring `AiLabAgentDialog`.
4. **RTL support is ours alone and must survive.** `dir="ltr"` on the marquee and fan,
   `rtl:-scale-x-100` on the CTA arrows, the logical-property CSS, the `:dir(rtl)` progress-fill
   rule and the `this.rtl` ternaries in `buildShowcase()` have no LTR effect and are not "drift".

## The change

| Area             | What                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero stats       | `AI_LAB_STATS` becomes 2 logo tiles (`iconCopilotOutline`, `lucideLayers`) instead of 3 count-ups. `AiLabStat` gains `logo?`, `value` becomes optional, the template branches glyph-vs-number, and the grid column count follows the tile count. |
| Hero eyebrow     | Always "What's inside" — the `hasSubmissions()` flip to "Your progress" is gone; that surface belongs to the progress panel.                                                                                                                     |
| Hero CTA         | Their inline `Refresh` pill + helper paragraph replaces our boxed "Check your email" card. `Resend email` is commented out. A third `ctaLabel()` state, `Create AI Lab account`, is added.                                                       |
| Copy             | "master classes" → "Masterclasses".                                                                                                                                                                                                              |
| Assessment layer | Removed: the `AI_LABS.assessmentEnabled` gate, `hasSubmissions`, the `reports` map, the per-card score badge and the "Submitted" pill.                                                                                                           |
| Catalogue fan    | Reads a new `portraitThumbnail`; re-proportioned to true 9:16 (four CSS values). Click navigates.                                                                                                                                                |
| Catalogue grid   | One rewinding rail at every width (1.15 / 2 / 3 per view). The desktop grid, its fade-up reveals, the `[1,2,3]` pulses and the `slides` loop padding are gone. Card CTA is a fixed `View Course`.                                                |
| Sections         | The 10 static fallback agents and `AiLabAgent` are deleted; the 3-card cap is lifted; a settled-empty section is dropped entirely.                                                                                                               |
| Dialog           | `shared/dialogs/ai-lab-agent-dialog/` deleted. `AiLabAgentCard` moves down into `features/ai-labs/models/` (AGENTS.md §3).                                                                                                                       |

## Consequence to accept deliberately

Their catalogue is API-fed, which is why they could delete the static tiles. Ours is not bound, and
**`v2/chapters/?id=440` and `?id=442` both answer 404 on UAT** (verified). So the catalogue is empty:
the fan shows its `@empty` message and `#catalogue-grid` renders nothing. That is faithful to the
source and reverses the moment the catalogue read is bound.

Likewise the hero: `auth`/`milesAuth` are inert stubs, so every ported CTA branch is structural
parity, not a visible change.

## Not done here

`core/services/ai-lab-submission/` and `core/models/ai-lab-assessment.model.ts` are **orphaned** by
this change — the dialog was their last consumer. They are left in place because the course page
(subtask 3) handles lab submissions and will likely want them. Delete them if that turns out false.

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`, then the running app.

**Watch `ai-labs.css`:** `angular.json` warns at 12 kB and **errors at 16 kB**, and the file sits at
15.86 kB. The four fan values are byte-neutral; anything more must be paid for by converting
utility-shaped declarations to Tailwind. Never raise the budget.

`structure-baseline.json` needs `--prune` in this subtask: aliasing the model import and deleting
the dialog both _improve_ ratcheted counts, which fails the check as "stale" until pruned.
