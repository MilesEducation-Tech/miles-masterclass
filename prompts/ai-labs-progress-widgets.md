# AI Labs — progress panel and token meter

## Goal

Port the two surfaces that exist only in `miles-masterclass-v3@master`: the below-the-fold
"Where your labs stand" dashboard and the floating Copilot Credits pill. UI only.

Subtask 2 of 3. Subtask 1 was the landing page (`prompts/ai-labs-ui-parity.md`); subtask 3 is the
course page.

## Locked decision: built, not mounted

Both are **presentational components with Storybook stories, and neither is rendered on the
landing page.** They display real learner numbers — credits remaining, attempts, best scores,
"N of M labs complete" — and none of those reads is bound. Mounting them would put invented
balances and scores in front of a learner on a CPE product. Upstream backs them with
`progress-sample.ts` / `tokens-sample.ts`; here that sample data is story-only.

Wiring them up later is feeding inputs and handling two outputs. No component file changes.

## What changed from the source

The upstream components inject `AiLabProgressStore`, `AiLabTokens` and `Utils`. Everything is an
input or an output instead:

| Component            | Inputs                                                        | Outputs                   |
| -------------------- | ------------------------------------------------------------- | ------------------------- |
| `AiLabProgressPanel` | `totals`, `assignments`, `balance`, `isLoading`, `submitting` | `topUp`, `openAssignment` |
| `AiLabTokenMeter`    | `balance`, `submitting`                                       | `topUp`                   |

Both self-gate on a `null` input, exactly as upstream self-gates on its service, so a host page
can drop either in without an `@if`.

## Files

- `features/ai-labs/components/ai-lab-progress-panel/{ts,html,stories.ts}`
- `features/ai-labs/components/ai-lab-token-meter/{ts,html,stories.ts}`
- `features/ai-labs/utils/progress-stats.ts`, `utils/token-usage.ts` — pure arithmetic, no Angular
- `features/ai-labs/models/ai-labs.model.ts` — `AiLabProgressTotals`, `AiLabAssignmentProgress`,
  `AiLabAssignmentCourse`, `AiLabTokenBalance`
- `testing/mocks/ai-labs.mock.ts` — story-only sample data
- `shared/ui/progress/progress.ts` — see below

## The one shared change

Our `Progress` had variants `primary | success | accent` and sizes `sm | md`. The meter needs to
warn at 75% of the allotment and alarm at 90%, so `info`, `warning` and `error` are added, each
mapped to an existing `@theme` token (`--color-info`, `--color-accent-premium`,
`--color-destructive`). Purely additive — no existing consumer changes — and `ProgressVariant` is
now exported, which is what `token-usage.ts` returns.

Upstream's `size="xs"` maps to our `sm` (`h-1`); we have no `xs`. Upstream's `label="none"` is
dropped: our `Progress` hides the label by omitting the input, so passing `"none"` would render
that word.

## Types are view models, not wire types

`AiLabAssignmentCourse` is deliberately lean rather than the full `Content`: the row shows a
thumbnail and a title and opens a page. `status` is an open union (`string`) — only a handful of
values are evidenced, and `statusUi()` humanises anything else rather than dropping the row.

## Rules the design encodes, kept verbatim

- A stat tile whose figure is `null` / `NaN` / `0` is **dropped**, not rendered — "0 submissions"
  beside "0% average" reads as a scored dashboard when the backend simply sent nothing.
- `best_percentage: null` renders an em dash, never `0%`.
- A 0% completion bar is omitted; it says nothing a missing bar doesn't.
- No balance means no allotment: the credits card and the pill disappear rather than showing zeros.
- A row with no mapped course renders without a CTA and without a thumbnail.

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm build:prod` · `pnpm build-storybook`. The stories are the
acceptance surface: 14 entries under **AI Labs/Progress panel** and **AI Labs/Token meter**,
covering warning/critical thresholds, a pending top-up, an all-zero payload, loading and absent.
