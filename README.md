# Refactor harness for miles-masterclass-v3

This kit turns the restructure and modernization spec into a repeatable Claude Code workflow.
Claude does the work one phase at a time. Deterministic gates decide whether a phase is done,
and you review and commit between phases.

## What's in the kit

```
CLAUDE.md                          Imports AGENTS.md, then states the harness rules (merge into yours)
docs/refactor/
  PROMPT.md                        The spec. Single source of truth. Claude can't edit it.
  STATE.md                         Cross-session handoff: trackers, decisions, step log
  PLAN.md                          (written by Phase 0) The move map + inventories you approve
  smoke-routes.json                Routes for the SSR smoke test (fill in the placeholders)
  baseline/                        SSR + bundle baselines. Only YOU record these.
  reports/                         One report per phase/feature
  .cache/                          Logs and last results (gitignore this)
scripts/refactor/
  verify.mjs                       All gates: lint, tests, builds, storybook, format, bundle, SSR
  bundle-report.mjs                Initial vs lazy bundle, baseline delta, must-not-contain checks
  ssr-smoke.mjs                    Boots the prod SSR server, compares status/title/meta/h1/JSON-LD/text
.claude/
  settings.json                    Permissions + hook wiring
  hooks/guard-bash.mjs             Blocks commits, destructive git, schematics, npm/yarn, baseline re-record
  hooks/guard-edit.mjs             Protects harness/secret files; blocks NEW eslint-disable, ts-ignore,
                                   skipped tests, NgClass/NgStyle, @angular/aria, raw localStorage
  hooks/post-edit.mjs              Prettier + ESLint on every edited file; lint errors go straight back to Claude
  hooks/stop-gate.mjs              Claude can only stop with STATE.md updated and a green typecheck
  hooks/session-start.mjs          Injects STATE.md at startup, resume, /clear and after compaction
  skills/refactor-phase            /refactor-phase <n> [feature]: the phase protocol
  skills/refactor-verify           /refactor-verify [--quick]
  skills/refactor-status           /refactor-status: where am I, what's next
  agents/verifier.md               Runs the gates, returns a 60-line verdict (keeps logs out of context)
  agents/reviewer.md               Reviews the diff against the spec for the current phase
  agents/import-auditor.md         Finds every reference to a file before it moves
```

## How the harness works

The design follows one principle: **Claude does the work, but Claude doesn't grade its own work
and can't move the goalposts.** The layers are:

| Layer      | Files                              | Job                                                                                                                                |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Spec       | `PROMPT.md`                        | What "correct" means. Read-only to Claude.                                                                                         |
| State      | `STATE.md`, `PLAN.md`, `reports/`  | Memory between sessions. Every session starts from here, not from chat history.                                                    |
| Gates      | `scripts/refactor/*`, `baseline/*` | Objective pass/fail: builds, tests, bundle, SSR output. Read-only to Claude. You record the baselines.                             |
| Guardrails | hooks + permissions                | Deterministic "never do X" rules that don't depend on the model remembering them.                                                  |
| Workflow   | skills                             | The same protocol every session: load → preconditions → steps → verify → review → report → stop.                                   |
| Delegation | subagents                          | Heavy output (build logs, grep results, diffs) is processed in a separate context and summarized, so the main session stays sharp. |

The feedback loops run at three speeds:

1. **On every edit (seconds):** `post-edit` runs Prettier and ESLint on the file. `guard-edit` blocks
   new suppressions before they are written.
2. **On every step (a minute or two):** `verify.mjs --quick` runs typecheck and lint. `stop-gate` refuses to
   let Claude end its turn with a broken typecheck or a stale STATE.md.
3. **On every phase (several minutes):** the `verifier` subagent runs the full gates, including the SSR comparison
   against your baseline. The `reviewer` subagent then checks the diff against the spec.

## One-time setup

1. **Make sure `main` is green.** Run `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build`, `pnpm build:prod`,
   `pnpm build-storybook` and `pnpm format` on untouched code. Fix anything red _before_ starting. Otherwise every
   phase will inherit failures it didn't cause.
2. **Create the branch:** `git checkout -b refactor/structure`.
3. **Copy the kit** into the repo root. If you already have `.claude/settings.json` or `CLAUDE.md`, merge them
   rather than overwriting.
4. **Ignore the cache:** add `docs/refactor/.cache/` to `.gitignore`.
5. **Fill in `docs/refactor/smoke-routes.json`** with one partner landing route, one course route, and the admin
   login route. Check that `src/server.ts` reads `process.env['PORT']`. The default Angular SSR template does.
6. **Check the typecheck:** make sure `pnpm exec tsc -p tsconfig.app.json --noEmit` passes on untouched code.
   It's the fast gate used by `--quick` and the stop hook. If it doesn't work for your setup, tell Claude and
   _you_ change the command in `verify.mjs` and `stop-gate.mjs`.
7. **Record the baselines yourself:** `node scripts/refactor/verify.mjs --record-baseline`.
   This runs every gate and writes `baseline/ssr.json` and `baseline/bundle.json`.
   Tick that decision in STATE.md.
8. **Commit the harness**, e.g. `chore(refactor): add Claude Code harness and baselines for structure refactor`.
9. **Smoke-test the guardrails:**
   - Start `claude` in the repo and run `/hooks` to confirm the hooks loaded from Project Settings.
   - Ask Claude to run `git commit --allow-empty -m test`. It must be blocked.
   - Watch for any "hook error … No such file" notice on the first tool call. A wrong path silently disables a guard.

## The session playbook

**Rule: one phase = one session. In Part B, one feature = one session.** Sessions are cheap; stale context is not.
All continuity lives in the files, so you never need `--continue` or `--resume` across phases.

### The loop (every session)

1. `claude` (fresh session) → `/refactor-status`. This confirms where you are and what to run.
2. `/refactor-phase <n> [feature]`. Approve or deny tool prompts as they come. The allow-list covers the routine ones.
3. Claude works through the steps, verifies, reviews, writes the report, updates STATE.md, prints a commit message,
   and **stops**.
4. **You review:**
   - Read the report, especially "Decisions needed" and "Visual QA".
   - Run `git diff --stat -M` and check that moves show as renames, not delete + add.
   - Spot-check a few files.
   - For Part B, run the app (`pnpm start`) and eyeball the pages in the QA list at mobile, tablet and desktop.
5. Tick any decisions in STATE.md, then commit using Claude's message. Your husky/lint-staged hooks run here as a
   final check.
6. `/clear` (or exit) → next session.

### If a session runs long

The skill tells Claude to stop at a green step boundary when the context gets heavy. When that happens, run
`/clear` and the same `/refactor-phase` command again. It resumes from "Now" in STATE.md. If auto-compaction
kicks in instead, the SessionStart hook re-injects STATE.md afterwards, so nothing is lost.
But a clean restart at a step boundary is better.

### Phase-by-phase plan

| Phase             | Sessions              | Mode          | Notes                                                                                                                                                                                     |
| ----------------- | --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Audit           | 1                     | **Plan mode** | Longest read, zero edits. Afterwards, _you_ read PLAN.md carefully, tick "PLAN approved", fill in decisions, and commit the docs. This is the most important review of the whole project. |
| 1 Hygiene         | 1                     | normal        | Check the must-not-contain proof for the mocks.                                                                                                                                           |
| 2 Aliases         | 1                     | normal        |                                                                                                                                                                                           |
| 3 Core            | 1                     | normal        |                                                                                                                                                                                           |
| 4 Shared & layout | 1                     | normal        | Big import churn. Expect it to split into several steps.                                                                                                                                  |
| 5 Features        | 1 per large feature   | normal        | `/refactor-phase 5 payment`, `/refactor-phase 5 offerings`, …                                                                                                                             |
| 6 Admin           | 1                     | normal        | Ends with a v1/v2 decision request.                                                                                                                                                       |
| 7 Boundaries      | 1                     | normal        | Lint violations surface everything Part A missed.                                                                                                                                         |
| —                 | —                     | —             | **Merge Part A, deploy, let it soak.** New branch `refactor/modernize` for Part B.                                                                                                        |
| 8 Services        | 1–3                   | normal        | Split into core / features / admin if large.                                                                                                                                              |
| 9 Data            | 1 per feature         | normal        | Order comes from the Part B tracker.                                                                                                                                                      |
| 10 UI             | 1 per primitive group | normal        | Check keyboard/focus in Storybook yourself.                                                                                                                                               |
| 11 Defer + lazy   | 1 per page/feature    | normal        | Watch the bundle deltas in each report.                                                                                                                                                   |
| 12 Tailwind       | 1 per feature         | normal        | Visual QA is on you. This is where regressions hide.                                                                                                                                      |
| 13 Partner pages  | 1                     | normal        | Only if approved. Add every partner route to smoke-routes.json _and re-record_ first.                                                                                                     |
| 14 Docs           | 1                     | normal        |                                                                                                                                                                                           |

**Model choice:** use the strongest model (Opus 5) for Phase 0 and for the judgment-heavy Part B phases
(8–12). Mechanical moves (1–6) are fine on a faster model. The subagents are pinned to `sonnet` in their
frontmatter to keep verification cheap. Change that if you prefer.

**Don't parallelize.** Part A moves touch shared files; Part B features still share `shared/` and `core/`.
Sequential sessions on one branch avoid merge pain.

**Headless runs** (`claude -p`) are possible for Part B features once you trust the loop. Keep Phase 0 and
anything that asks for decisions interactive.

## When things go wrong

- **Claude stops with ⛔ in STATE.md.** Read the blocker in the report. Decide, write your decision under
  "Decisions", then rerun the same command.
- **A gate is wrong or too strict.** Fix it yourself in `scripts/refactor/` (Claude can't), commit, and rerun.
- **An SSR change is intentional** (e.g. Phase 13). Re-record the baseline yourself and note why in STATE.md.
- **The stop hook loops.** It allows the second stop attempt in a row (`stop_hook_active`), so Claude can always
  hand back to you with the blocker explained.
- **You need to turn the guards off temporarily:** start with `claude --settings '{"disableAllHooks": true}'`.
  Don't run refactor phases like that.

## Limits to know

- **Hooks are guardrails, not a security boundary.** A determined command could still write a protected file.
  That's why the gates live in files you review in every diff: a change under `scripts/refactor/`,
  `docs/refactor/baseline/` or `.claude/` in a phase diff is a red flag.
- **The SSR smoke test checks SEO-critical output**, not pixels. Visual parity in Part B needs your eyes
  (or a screenshot-diff tool you add later).
- **Typecheck in the stop hook is plain `tsc`**, so template errors surface in the full gate (`ng build`),
  not per turn.
