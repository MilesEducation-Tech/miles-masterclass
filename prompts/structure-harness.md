# Structure & modernization harness (permanent, platform-agnostic)

## Goal

Everyone who develops in this repo, on any tool (Claude Code, Cursor, Copilot, Codex, Gemini, Windsurf, or no AI
at all), should end up on the same three things:

- **Feature-first structure:** the placement, boundary and naming rules in `AGENTS.md` §3.
- **Modernization standards:** `AGENTS.md` §4.1–4.6.
- **GitHub Flow:** the branch, commit, PR, squash-merge and release flow in `docs/engineering/git-workflow.md` and
  `versioning.md`.

Enforcement must not depend on the refactor harness (`docs/refactor/`, `scripts/refactor/`, the `.claude/` refactor
hooks). That harness is Claude-only and is being retired (Phase 14 proposal).

**Principle:** anything that matters is enforced where **every** platform passes through, in three places:

- **Git hooks**, locally.
- **CI**, as required checks. `--no-verify` only delays the failure.
- **GitHub rulesets**, which make those checks binding.

Agent instruction files only _guide_. They all point at one source, `AGENTS.md`, so the rules never fork per tool.

## What I read and measured (2026-09-26)

**Already enforced for every platform: keep, don't rebuild.**

| Rule                                                                                                                           | Local (husky)                | CI (required on `master`) |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------- |
| Branch name `type/TICKET-desc`                                                                                                 | `pre-commit`                 | `branch-name`             |
| Conventional Commits                                                                                                           | `commit-msg` → commitlint    | `commitlint`, `pr-title`  |
| ESLint: import boundaries (`eslint-plugin-boundaries`), `@angular/aria`, `Injectable`, `NgClass`/`NgStyle` and `app-api/` bans | `lint-staged` (staged files) | `verify` → `pnpm lint`    |
| Prettier                                                                                                                       | `lint-staged`                | `verify` → `pnpm format`  |
| Tests, AOT build, bundle budget, Storybook                                                                                     | —                            | `verify`                  |
| Squash-only merges, protected `master`, tags, CODEOWNERS review, release-please                                                | —                            | rulesets + `release.yml`  |

**Agent instructions:**

- `AGENTS.md` is read natively by Codex, Cursor, the Copilot coding agent, Windsurf, Zed and others.
- `CLAUDE.md` imports it with `@AGENTS.md`.
- **Missing:**
  - `.github/copilot-instructions.md`, which Copilot Chat in VS Code reads by default.
  - `GEMINI.md`, which Gemini CLI reads by default.
- `CLAUDE.md` still has a refactor-only "Active work" section.

**Not enforced anywhere permanent.** Only the refactor `reviewer` agent caught these, and it retires with the harness.

| #   | Rule (AGENTS.md)                                                                                                     | Violations today                                | How to enforce                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| G1  | `inject()`, never constructor injection (§4.1)                                                                       | **0** (`prefer-inject` is **off**)              | Turn `@angular-eslint/prefer-inject` on                                  |
| G2  | `@if`/`@for`, no `*ngIf`/`*ngFor`                                                                                    | 0                                               | Turn on `@angular-eslint/template/prefer-control-flow`                   |
| G3  | `DestroyRef`, never `OnDestroy`                                                                                      | 2 (`milesverse/briefing`, `milesverse/report`)  | Add `OnDestroy` to the `no-restricted-imports` names; baseline the 2     |
| G4  | No `any` (§8)                                                                                                        | 76                                              | Turn `no-explicit-any` **warn → ratchet**: new ones fail (baseline)      |
| G5  | Naming: no `.component/.service/…` suffixes, no `.scss`, plural folders, no `shared/` inside a feature, no new `-v2` | 0                                               | Structure check (script)                                                 |
| G6  | Routed components live in `pages/`                                                                                   | 12 (`./payment` shell, `overview-wrapper`, …)   | Structure check, baselined                                               |
| G7  | Component `.css` only for keyframes / third-party / `:host` / PDF DOM (§4.6)                                         | 43 files                                        | Structure check: a **new** `.css` needs a baseline entry with its reason |
| G8  | No static `style="…"` (§4.6)                                                                                         | 47 (30 in unrouted v1, 17 kept with reasons)    | Structure check, baselined                                               |
| G9  | Every `@defer` has a sized `@placeholder` (§4.4)                                                                     | 1 (`shared/components/wave-canvas`, to inspect) | Structure check                                                          |
| G10 | No hardcoded hex that exactly equals a `@theme` token (§4.6)                                                         | measured when built                             | Structure check reads token values from `styles.css`                     |

**Smaller stale items:**

- `AGENTS.md` §9 says `pnpm start` serves on port **4100**, but `package.json` uses **4101**.
- `git-workflow.md` §8, "The refactor: extra rules while it runs", should go when the harness does.
- The PR template's checklist lacks the §4 items: `httpResource`, `@defer` placeholder, tokens, visual parity.

## Locked decisions (proposed; confirm or change)

- **D1. One source of truth.** Rules live in `AGENTS.md` (and `docs/engineering/*` for git). Every agent file is a
  short pointer to them and never restates rules.
- **D2. A ratchet, not a big-bang fix.** The structure check fails only on violations _not_ in
  `structure-baseline.json`. Fixing one shrinks the baseline, and the check fails if the baseline lists something
  that no longer exists, so it can't go stale. The same idea applies to `any`.
- **D3. Wire into existing gates, add no new required check.**
  - The structure check runs inside `pnpm lint`, so CI `verify` covers it with no ruleset or workflow change.
  - It also runs in `pre-commit`.
- **D4. The script lives in `scripts/`**, as `scripts/check-structure.mjs`. It is not under `scripts/refactor/`
  (yours, and being retired). It uses plain Node with no new dependency, and has one spec.
- **D5. `.claude/` changes are yours.** Your settings deny Claude edits there. I'll list the exact edits: drop the
  refactor hooks, keep `post-edit.mjs`, and remove the `scripts/refactor` allow rule.

## Phases (one PR each, all under ~400 lines)

1. **`chore/MIL-XXX-eslint-modernization-rules`**
   - Turn on `prefer-inject` and `prefer-control-flow`.
   - Ban importing `OnDestroy`.
   - Put `no-explicit-any` behind the ratchet (G1–G4).
   - Baseline the 2 `OnDestroy` uses with a scoped override and a `// why:`, since both are in unowned milesverse
     code.
2. **`ci/MIL-XXX-structure-check`**
   - Add `scripts/check-structure.mjs` + `structure-baseline.json` + a spec (G5–G10).
   - Wire it into `pnpm lint`, so `verify` runs it, and into `.husky/pre-commit`.
   - The baseline records today's violations with a one-line reason each, taken from the Phase 12 reports.
3. **`docs/MIL-XXX-agent-instructions`**
   - Add `.github/copilot-instructions.md` and `GEMINI.md` as pointers to `AGENTS.md`.
   - Update the PR-template checklist.
   - Fix the `AGENTS.md` port.
   - Add an "Enforcement" subsection to `AGENTS.md`: what is checked where, and how to run it locally.
   - Update `git-workflow.md` §8.
4. **(you) Retire the refactor harness**, as in Phase 14 report §3:
   - Harvest the open items first.
   - Remove `docs/refactor/`, `scripts/refactor/`, the refactor `.claude/` hooks and skills and agents, and the
     `CLAUDE.md` refactor section.
   - I'll hand you the exact diffs for the parts you own.
5. **Optional, `ci/MIL-XXX-ssr-smoke`:** a minimal permanent SSR smoke in CI (key routes return 200 with a title).
   Today only the refactor harness has one.

## Files touched

- **Phase 1:** `eslint.config.mjs`.
- **Phase 2:**
  - New: `scripts/check-structure.mjs`, `scripts/check-structure.spec.mjs` (or a Vitest spec),
    `structure-baseline.json`.
  - Edited: `package.json` (the `lint` script), `.husky/pre-commit`.
- **Phase 3:**
  - New: `.github/copilot-instructions.md`, `GEMINI.md`.
  - Edited: `.github/pull_request_template.md`, `AGENTS.md`, `docs/engineering/git-workflow.md`.
- **Phase 4:** `.claude/**`, `CLAUDE.md`, `docs/refactor/**`, `scripts/refactor/**`. These are yours.

## Security

No secrets involved. The check only reads files and is never shipped to the browser.

## Acceptance criteria

- A PR that adds any of these fails CI `verify`, on any platform, even with `--no-verify` locally:
  - `components/foo/foo.component.ts`
  - a `.scss`
  - a routed page outside `pages/`
  - a new component `.css`
  - a static `style="color: …"`
  - a `@defer` without a `@placeholder`
  - `bg-[#0e0e0e]` (an exact `--background` match)
  - constructor injection
  - `*ngIf`
  - `implements OnDestroy`
  - a new `any`
- Removing a baselined violation without removing its baseline entry fails, with a message saying to shrink the
  baseline.
- `pnpm lint`, `pnpm ng test --watch=false`, `pnpm format` and `pnpm build:prod` are all green on the branch.
- Copilot Chat, Gemini CLI, Cursor and Codex each pick up the instructions: each file exists at its tool's default
  path and points to `AGENTS.md`.

## Checks to run

`pnpm lint`, `pnpm ng test --watch=false`, `pnpm format`, `pnpm build:prod`. For Phase 2, also the negative tests
above, on a throwaway branch.

## Risks

- **G10 false positives.** A value can equal a token by accident with a different meaning, as with `#3b82f6` =
  `--ring`, used as text. Mitigation: G10 only _reports_ in the baseline, and new hits fail with a message pointing
  to the "semantically unrelated" escape: add it to the baseline with a reason.
- **`prefer-control-flow` / `prefer-inject` may flag Storybook stories or specs.** Scope them to `src/app/**`
  non-spec files if so.
- **Baseline creep.** People may add entries instead of fixing. Mitigation: CODEOWNERS on `structure-baseline.json`.
