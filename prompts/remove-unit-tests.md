# Remove unit tests and test tooling

## Context

You've decided the repo carries no unit tests from now on. Today it has 208 `*.spec.ts` files, a Vitest/jsdom
`ng test` target, a node test for the structure checker, a CI step and a `verify.mjs` gate that run them, and
instructions (CLAUDE.md, AGENTS.md, the harness agents and skills, and PROMPT.md) that require tests. The goal is
to delete all of it, make Angular stop generating specs, drop the test-only packages, and make "no tests" an
enforced rule, both for Claude (the harness) and for every contributor (pre-commit and CI).

**Locked decisions (from you):**

- **Harness files are delivered as a patch.** Your guards (`guard-edit.mjs`, `guard-bash.mjs`, `settings.json` deny)
  block my edits to `.claude/`, `scripts/refactor/` and `docs/refactor/PROMPT.md`. I write `harness-no-tests.patch`
  at the repo root, validate it with `git apply --check`, and you apply it. Your guards stay untouched.
- **Enforced repo-wide.** `scripts/check-structure.mjs` fails on any spec or test file, so `.husky/pre-commit` and
  CI `verify` (through `pnpm lint`) reject tests from any tool or person. The guard-edit hook also blocks Claude
  from creating one.

**Assumptions:**

- **`src/app/testing/` stays, minus its four dead files.** It isn't test-only: `angular.json` swaps in
  `testing/partner-mock/dev-interceptors.ts` for the `development` and `local` builds, and 16 stories import
  `transloco.ts`, `mocks/content.mock.ts`, `mocks/dialog.mock.ts` and `mocks/services.mock.ts`. Renaming the folder
  is out of scope.
- **History is left as it was written.** STATE.md log entries, `prompts/*.md` and
  `docs/engineering/enforcement-verified.md` §4 record what happened then. Only the rules and live instructions
  change.
- **One PR.** It's well over the ~400-line guide, but almost all of it is file deletions. The hand-written diff
  (config, docs, the patch) is about 200 lines. Splitting would leave a PR where CI runs `ng test` with zero spec
  files, and Vitest fails on "no test files".

## Jira ticket

- **Summary:** `chore(core): remove unit tests and test tooling`
- **Branch:** `chore/MIL-XXX-remove-unit-tests`. You create it from `master`; `git branch -m` once the ticket
  exists.
- **Description:** the team has decided to stop maintaining unit tests. Delete every spec and test file, the
  Vitest/jsdom setup and the `ng test` target, stop `ng generate` from emitting specs, remove the test steps
  from CI and the refactor verifier, and reject new test files in pre-commit and CI.
- **Acceptance criteria:**
  - No `*.spec.ts` or `*.test.*` file in the repo.
  - `vitest` and `jsdom` are gone from `package.json` and the lockfile.
  - `angular.json` has no `test` target.
  - `pnpm ng g c x --dry-run` creates no spec.
  - Adding a spec file fails `pnpm lint`.
  - `pnpm lint`, `pnpm format`, `pnpm build:prod`, `pnpm build` and `pnpm build-storybook` are all green.
  - CI `verify` stays green and keeps its name, which the rulesets require.
- **Checklist:** `pnpm lint`, `pnpm build:prod` green (the `ng test` item is removed from the template).

## Steps

### 1. Record the plan

- Copy this plan to `prompts/remove-unit-tests.md`, following the AGENTS.md §1 workflow.

### 2. Delete test files

These are plain deletions; `git ls-files` drives the 208 specs.

- `src/**/*.spec.ts`: 208 files.
- `src/test-setup.ts`.
- `scripts/check-structure.test.mjs`.
- Four `src/app/testing/` files that become dead:
  - `signal-form-host.ts`
  - `mocks/dialog-ref.mock.ts`
  - `mocks/masterclass-home.mock.ts`
  - `mocks/toast.mock.ts` (already had no importers)
- `.agents/skills/vitest/` (tracked vitest agent skill).

### 3. Angular and TypeScript config

- **`angular.json`:**
  - Delete the `test` architect target.
  - Fill the empty `"@schematics/angular": {}` with nested per-schematic defaults, so `ng generate` stops
    emitting specs: `{ "skipTests": true }` for each of `component`, `directive`, `pipe`, `service`, `guard`,
    `interceptor`, `resolver` and `class`. The CLI merges `schematics[collection][schematic]`.
- **`tsconfig.spec.json`:** delete it.
- **`tsconfig.json`:** drop its `./tsconfig.spec.json` reference. Keep the `@testing/*` alias, which stories use.
- **`tsconfig.app.json`:** drop `"exclude": ["src/**/*.spec.ts"]`.
- **`.storybook/tsconfig.json` and `.storybook/tsconfig.doc.json`:** drop the `../src/test.ts` and
  `../src/**/*.spec.ts` excludes. `src/test.ts` never existed.

### 4. Packages and scripts

- `pnpm remove vitest jsdom`. These are the only test-only packages; nothing else is installed for tests.
  `@angular/platform-browser-dynamic` and `@angular-devkit/*` stay because Storybook needs them.
- `package.json`: remove the `test`, `pretest` and `test:scripts` scripts.

### 5. ESLint (`eslint.config.mjs`)

- Delete the `{ category: 'test', pattern: '**/*.spec.ts' }` file category.
- Change the `testing` policy to `noneOf: ['story']`, with the message `@testing/* is importable only from stories`.
- In `LEGACY_ANY_FILES`, remove the two deleted specs.

### 6. Repo-wide "no tests" rule (`scripts/check-structure.mjs`)

- A pure `testFiles()` rule, run as a hard rule over every file under `src/` and `scripts/`. No baseline entry.

### 7. CI and editor

- **`.github/workflows/ci.yml`:** delete the `pnpm test:scripts` and `pnpm ng test --watch=false` steps. The job
  keeps the name `verify`, which `rulesets/main.json` and `master.json` require.
- **`.vscode/launch.json` / `.vscode/tasks.json`:** remove the "ng test" configuration and the `npm: test` task.

### 8. Harness patch: `harness-no-tests.patch` (you apply it)

- **`scripts/refactor/verify.mjs`:** delete the `unit tests` gate. Full runs become 7 gates.
- **`.claude/hooks/guard-edit.mjs`:** replace the two skip/focus rules with a path rule that blocks any `*.spec.*`
  or `*.test.*` file.
- **`.claude/agents/reviewer.md`, `.claude/agents/import-auditor.md`, `.claude/skills/git-workflow/SKILL.md `:**
  drop the test lines.
- **`docs/refactor/PROMPT.md`:** remove the Vitest, unit-test gate and spec rules. The unguarded root `PROMPT.md`
  copy gets the same edits directly.

### 9. Docs and instructions

- `CLAUDE.md`, `AGENTS.md`, `README.md`, `.github/copilot-instructions.md`, `.github/pull_request_template.md`,
  `docs/engineering/{git-workflow,github-setup,versioning,jira-ticket-template,git-playbook}.md`: remove test
  commands and "add a test" lines; add the "No tests" rule.
- `docs/refactor/STATE.md`: a NON-REFACTOR "Now" entry.

### Out of scope

- Five production components that only their specs imported become fully dead: `document-chapter`, `plan-card`,
  `blog-layout`, `badge-claim-upsell-dialog`, `badge-info-dialog`.
- `.claude/skills/git-workflow/SKILL.md ` has a trailing space in its filename, so the skill likely never loads.
- Dead exports in `testing/mocks/content.mock.ts`.

## Verification

1. `git ls-files | rg '\.(spec|test)\.[cm]?[jt]s$'`: empty.
2. `pnpm install --frozen-lockfile`.
3. `pnpm exec tsc -p tsconfig.app.json --noEmit`.
4. `pnpm lint`: 0 errors, and check-structure passes.
5. A temporary `src/app/tmp.spec.ts` makes `pnpm check:structure` fail with "No test files".
6. `pnpm ng g c shared/components/tmp --dry-run`: no `.spec.ts`.
7. `pnpm ng test`: unknown target.
8. `pnpm format`, `pnpm build:prod`, `pnpm build`, `pnpm build-storybook`.
9. `git apply --check harness-no-tests.patch`.
10. After the patch: `node scripts/refactor/verify.mjs` reports 7 gates, all green.
