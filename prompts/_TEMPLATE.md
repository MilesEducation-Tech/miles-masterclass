# <Feature name>

> Implementation prompt. Written by the agent, reviewed and approved by a human **before** any code is written.
> Every section below is required. A thin or missing section is grounds to reject the plan.

## Goal

<One sentence. What this task accomplishes. If it can't be said in one sentence, the task isn't understood yet.>

## What it read

- Skills: `<skill-a>`, `<skill-b>`
- Files inspected: `src/app/...`, `src/app/...`

<Proof the plan is grounded in this repo's real code, not in assumptions.>

## Assumptions

<Every ambiguity resolved without asking. The reviewer reads this section first — a wrong guess here becomes wrong code.>

## Files that will change

| File          | Create / Modify | Why |
| ------------- | --------------- | --- |
| `src/app/...` | Modify          |     |

## Implementation requirements

<Concrete behaviour, not a summary. What the state is, what triggers each transition, what the user sees.>

## UI requirements

<Required for any visual change; delete for pure logic work.>

- Layout + spacing:
- Typography:
- Colours / tokens (Tailwind classes, never raw hex):
- Responsive: mobile / tablet / desktop
- States: loading, empty, error, disabled
- Accessibility: keyboard path, focus order, ARIA, contrast

## Security requirements

<What stays server-side, which secrets are involved, which guard or interceptor enforces it. Restated for this task — see AGENTS.md §7.>

## Acceptance criteria

- [ ] <Tickable, not guessable>
- [ ] <...>

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm test
pnpm build:prod
```

<Add `pnpm build && pnpm serve:ssr:miles-masterclass-v3` when routes, SEO or server code changed.>

## How to verify it

1. `pnpm start`
2. Open `http://localhost:4100/<exact route>`
3. <Exact steps and expected result. Never "it should work.">
