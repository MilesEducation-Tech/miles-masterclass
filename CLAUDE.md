@AGENTS.md

## Active work: structure refactor & modernization

While `docs/refactor/` exists, all refactor work follows `docs/refactor/PROMPT.md`. Progress and handoff live in
`docs/refactor/STATE.md`. Phases run only through `/refactor-phase <n> [feature]`. Use `/refactor-status` to see
what's next.

- Never commit or push. Leave changes uncommitted and end each phase with a commit message for the user.
- Never edit `.claude/`, `scripts/refactor/`, `docs/refactor/PROMPT.md`, or `docs/refactor/baseline/`.
  These belong to the user.
- Never disable, skip, or weaken a lint rule, test, or verification gate.
- Use pnpm only.
