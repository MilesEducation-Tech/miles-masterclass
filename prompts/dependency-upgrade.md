# Dependency upgrade to latest (2026-09-26)

## Goal

Move every dependency to its newest release that the rest of the stack can actually accept. Where the newest
release is blocked by a peer dependency, record the blocker and leave the package where it is.

## What I read

- `package.json`, `pnpm outdated` (run 2026-09-26), `.github/workflows/ci.yml` + `pr-title.yml` (both `node-version: 22`).
- Peer ranges on the registry: `@angular/compiler-cli@22.2.0`, `@angular/build@22.2.0`, `typescript-eslint@8.70.1`,
  `@storybook/angular@10.6.0`, `ng-primitives@latest`, `@code_with_sachin/ngx-motion`.
- The repo has no AI-model IDs (grep for `claude-|gpt-|gemini-` in `src`, `scripts`, `.github` returned nothing), so
  there are no models to update.

## Blocked: cannot go to latest

| Package       | Now   | Latest | Blocker                                                                                                          |
| ------------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `typescript`  | 6.0.3 | 7.0.2  | `@angular/compiler-cli@22.2` and `@angular/build@22.2` require `>=6.0 <6.1`; `typescript-eslint` requires `<6.1` |
| `motion`      | 12.43 | 13.4   | `@code_with_sachin/ngx-motion` peers `motion@^12`. Publish an ngx-motion build for 13 first.                     |
| `@types/node` | 22.x  | 26.x   | Must match the runtime. It follows the Node decision below, not `latest`.                                        |

## Status (2026-09-26)

- Approved. Ticket **MIL-241**. You asked for **Node 26**.
- ⛔ **Node 26:** Vercel's supported-versions page (last updated 2026-02-27) lists only 24.x (default), 22.x and
  20.x. If `engines.node` is `26.x`, the deploy fails. Node 26 is also not LTS yet. Choose one: 24.x now, or confirm
  that Vercel offers 26 in the project settings first.
- ⛔ **`ng update` is blocked** by the refactor harness guard ("Angular schematics and migrations are not allowed in
  this refactor"). PR A can't run its Angular migrations until PR 4 (retire the harness) lands, or until you run
  `ng update` yourself.

- **Resolved:** Node **24** (your call). Angular waits until the harness is retired.
- ✅ **PR A without Angular + Node 24** done on `chore/MIL-241-deps-minor`. `@types/node` is pinned to 24.13.6,
  because 24.19.0 (published 2026-09-25, skipping 24.14–24.18) fails `minimumReleaseAge`. Bump it after the window.
- ✅ **Angular 22.2.0** added to the same branch at your request, through `pnpm up` because the guard blocks the CLI
  updater. Nothing was skipped: core, cdk and cli ship no migrations newer than 22.0.0, and ssr has none.
- ✅ PR A committed (`12581ac`). ✅ PR B vitest 5.0.2 + jsdom 30.1.1: all 692 tests pass unchanged.
- ✅ PR C ng-icons 36.1.0: `lucideLinkedin` (removed in Lucide 1.x) → `phosphorLinkedinLogo` in `badge-hero-card`.
- Next: D (swiper 14).

## Original decisions

1. **Node runtime:** stay on 22 (`engines`, CI, Vercel) _or_ move to 24, which is what you run locally (24.15).
   Default in this plan: **stay on 22**, because a runtime move is a separate change with its own deploy risk.
2. **Branch/ticket:** this must not go on `feat/MIL-001-auth-module`. I need a ticket number:
   `chore/MIL-XXX-deps-*`.

## Phases (one PR each, all `chore(deps)` / `test(core)`)

**PR A: minor/patch, low risk** (`chore/MIL-XXX-deps-minor`)
Angular 22.0.8 → 22.2.0 (all `@angular/*`, `@angular-devkit/*`, cdk; also unpins
`@angular/platform-browser-dynamic`), angular-eslint 22.5.0, typescript-eslint 8.70.1, eslint 10.11, Storybook
10.6.0 (all 5 packages), supabase-js 2.117.2, html2canvas-pro 2.4.5, tailwind-merge 3.7.0, jszip 3.10.2,
postcss 8.5.28, prettier 3.9.9.

- Angular through `pnpm ng update @angular/core @angular/cli` so its migrations run. Everything else through
  `pnpm up --latest <pkg>`.
- Prettier patch may reformat. If it does, the `format:fix` output goes in the same PR.

**PR B: test tooling majors** (`chore/MIL-XXX-deps-test-tooling`)
vitest 4 → 5, jsdom 27 → 30. These touch only specs; there are 10 files that mention jsdom.
Watch `blob-download.spec.ts`: it already failed once because of a Node Blob / jsdom FileReader mismatch.

**PR C: ng-icons 33 → 36** (`chore/MIL-XXX-deps-ng-icons`)
The 8 `@ng-icons/*` packages are imported in 116 files. Majors can rename or drop icons, so the build (AOT) plus a
grep of each `provideIcons` name is the check.

**PR D: swiper 12 → 14** (`chore/MIL-XXX-deps-swiper`)
Used in 3 files plus Swiper-internal CSS overrides. Needs a visual check of every carousel at 375 / 768 / 1440.

**PR E: lint-staged 16 → 17** (fold into PR A if the changelog has no config change).

## Files touched

`package.json`, `pnpm-lock.yaml`; whatever `ng update` migrations change; spec files (PR B); icon imports (PR C);
the 3 swiper consumers and their CSS (PR D). No app logic changes.

## Security

No new packages. Check `pnpm audit` after each PR and confirm it doesn't get worse.

## Acceptance criteria / checks (every PR)

`pnpm install --frozen-lockfile` works from a clean state. `pnpm lint` has 0 errors. `pnpm ng test --watch=false`
passes with at least 692 tests. `pnpm format` is clean. `pnpm build:prod` stays inside the 2.00 MB initial budget.
`pnpm build-storybook` passes. For PR A and PR D, an SSR run
(`pnpm build && pnpm serve:ssr:miles-masterclass-v3`) with `/us/cpa/masterclass` loaded. Report the environment
(local macOS / Node version).

## Risks

- Angular 22.2 migrations may touch a lot of files. If PR A goes over ~400 lines outside the lockfile, split
  Angular out into its own PR.
- Swiper and ng-icons majors can break at runtime in ways the build doesn't catch (Swiper) or can remove icons
  (ng-icons).
- Revisit TypeScript 7 when Angular 23 ships (expected ~Nov 2026).
