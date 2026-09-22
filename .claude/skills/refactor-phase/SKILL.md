---
name: refactor-phase
description: Run exactly one phase (or one feature of a Part B phase) of the Miles Masterclass restructure and modernization, following docs/refactor/PROMPT.md. Usage /refactor-phase <phase> [feature]
argument-hint: <phase-number> [feature-slug]
disable-model-invocation: true
---

# Run one refactor phase

Arguments: `$ARGUMENTS`. The first argument is the phase number; the optional second is the feature or area slug
from the Part B tracker (or, for Phase 5, a feature folder).

## 1. Load context (always, in this order)

1. Read `docs/refactor/PROMPT.md` in full. It is the spec, and it overrides anything else.
2. Read `docs/refactor/STATE.md`.
3. For phase ≥ 1, read `docs/refactor/PLAN.md`, plus the previous phase's report in `docs/refactor/reports/`.

## 2. Preconditions (stop and tell the user if any fail)

- Run `git status --porcelain`. Changes outside `docs/refactor/` mean a previous phase is uncommitted.
  Ask the user to commit first.
  The exception is resuming this same phase/feature: STATE.md "Now" names it as in progress.
- The previous phase is ✅ in STATE.md. For Part B features, the same feature is ✅ in the previous Part B column,
  unless the plan says otherwise.
- Every decision this phase depends on is ticked in STATE.md "Decisions". Phase 0 is the exception.
- For phase ≥ 1: `docs/refactor/baseline/ssr.json` and `docs/refactor/baseline/bundle.json` exist.
  If they don't, ask the user to record them.

## 3. Plan the steps

- Split the phase into small steps: one feature or area, or at most ~30 moved files per step.
- Write the step list into STATE.md "Now", and mark the phase 🟡 in its tracker.
- If resuming, continue from the first unfinished step in "Now".

## 4. Execute each step

- Before moving or renaming a file, ask the `import-auditor` subagent for every reference to it. Update all of them.
- Use `git mv` for moves. Follow the spec's placement, naming and boundary rules exactly.
- After the step, run `node scripts/refactor/verify.mjs --quick` and fix anything it reports.
- Update STATE.md: mark the step done and prepend one line to the step log (date, phase, step, result).
- If the context is getting long, stop here at a green boundary and tell the user to `/clear` and rerun
  `/refactor-phase $ARGUMENTS`.

## 5. Close the phase (or feature)

1. Ask the `verifier` subagent to run the full gates. Fix the failures it reports and verify again.
   After 3 failed fix rounds, stop: mark ⛔ in STATE.md with the blocker and report it.
2. Ask the `reviewer` subagent to review the diff against the spec for this phase. Fix the violations,
   then re-run the verifier if you changed code.
3. Write `docs/refactor/reports/phase-NN[-feature].md` using the spec's report format.
4. Update STATE.md:
   - Set the tracker status to ✅ (or ⏸ if a decision is needed) and link the report.
   - Add any decision requests under "Decisions" and any questions under "Open questions".
   - Set "Now" to the next command the user should run.
5. Output the gate table, the decisions needed, and the commit message. Then STOP.
   Do not start the next phase or feature.

## Phase 0 specifics

- Run in plan mode where possible. No source changes. The only files written are `docs/refactor/PLAN.md` and STATE.md.
- Fill the Part B tracker rows in STATE.md from the plan's feature list.
