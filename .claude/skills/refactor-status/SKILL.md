---
name: refactor-status
description: Summarize refactor progress from docs/refactor/STATE.md and say exactly what to run next. Usage /refactor-status
disable-model-invocation: true
---

Read `docs/refactor/STATE.md` and `git status --porcelain`, then report in under 15 lines:

- The current phase/feature and its status
- Whether there are uncommitted changes, and whether they belong to a finished phase
  (if so, remind the user to review and commit)
- Unticked decisions that block the next phase
- Open questions
- The exact next command to run, and whether to use plan mode

Change nothing.
