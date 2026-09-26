# Phase 14 — Documentation

## 1. Summary

**This phase changed documentation only.** `AGENTS.md` now describes the post-refactor codebase. No source file changed.

- **§3 "Architecture" became "Structure":**
  - The target tree.
  - The placement rules.
  - The import-boundary table, noting that `eslint-plugin-boundaries` enforces it.
  - Aliases and naming.
  - The layer table with the real paths: facades under `features/<f>/services/`, `ApiClient` in `core/services/`,
    guards in `core/guards/` + `admin/core/guards/`, and models in `core/models/` or `features/<f>/models/`.
- **The reference examples:**
  - `features/payment/`, a full feature with a root facade using opt-in `httpResource` reads and `ApiClient`
    mutations, plus lazy location data and lazy dialogs.
  - `admin/leads/`, the smallest admin slice: a route-scoped `@Service({ autoProvided: false })` facade in the
    route's `providers`, behind `permissionGuard(PERM.*)`.
  - I added `features/partners/` as the config-driven page example from Phase 13.
- **§4 "Tech stack" became "Tech stack & standards":**
  - The stack list is updated. ng-primitives replaces `@angular/aria`, and `@angular/cdk` is kept only for the
    remaining `BreakpointObserver`. It also covers Express 5, incremental hydration, `@theme` tokens and `cn()`.
  - The "do not use" list adds the lint bans (`@angular/aria`, `NgClass`/`NgStyle`).
  - New §4.1–4.6 carry all of PROMPT.md §4: services, data layer, headless UI, `@defer`/hydration, `injectAsync` and
    Tailwind first. They add the practical caveats Phase 12 learned:
    - unlayered component CSS beats utilities
    - Angular-scoped keyframes
    - html2canvas-pro can't parse `color-mix`/`oklch`
    - `/srgb` for gradients
    - when a static `style` attribute may stay
- **§5:** the stale model paths are fixed. The table now points at `core/models/`, the three models that moved into
  `features/offerings/models/` and `admin/core/models/`, and so on.

**Every concrete claim was checked against the code before review.** One was wrong in my first draft and is fixed:
`PaymentFacade`'s reads aren't gated on `isAuthenticated()`. They're opt-in, because each request function returns
`undefined` until a page asks.

**Not invented:** the spec names `core/utils/prefetch-triggers.ts` as the one hover/focus prefetch helper, but it
doesn't exist yet. `AGENTS.md` states the rule and says to create it on first need.

## 2. Verification

These are the `verifier` subagent's results from the full `verify.mjs` run, which passed first time.

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (182 files / 692 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass (plus `prettier --check AGENTS.md`)  |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 OK, 9 WARN "not in baseline"      |

- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**. It checked coverage of PROMPT.md §3 and §4, accuracy against the repo, consistency with the
  rest of `AGENTS.md`, and that no source changed.
- **Bundle:** unchanged at 89.5 KB gz (+0.3%), with 329 lazy chunks.

## 3. Decisions needed / skipped / suspicious

### Proposal: remove `docs/refactor/` and the harness (your decision; nothing was removed)

The refactor is complete, so the harness now only adds friction. The guard hook even blocks read-only commands that
mention its paths. I propose three steps, in this order.

**1. Harvest what outlives it.** STATE.md holds live items that would vanish with it. Move them to issues or to
`docs/engineering/known-issues.md`:

- **Open decisions:**
  - the spinner colours
  - `video-js.css` staying global
  - the `partnership-content` unsized placeholders and null-body crash
  - "course feedback can never be submitted"
  - the cpe-tracker download loading state
  - the PLAN §5 "searched lists" deviation
  - deleting the `ascpa` stub
  - the remaining Part A placement items
- **Open questions:**
  - the app-wide dialog-gradient token
  - the `styles.css` admin-palette comment
  - the library filters' unguarded read
  - the header's hard-coded signed-out state
  - the `src/app/configuration/ng-icon.ts` folder outside the target structure
- **The "Findings" sections:** bugs logged but deliberately not fixed during the refactor.

**2. Remove** (you own all of these):

- `docs/refactor/`, 1.4 MB: `PROMPT.md`, `STATE.md`, `PLAN.md`, `reports/`, `baseline/`, `smoke-routes.json`,
  `PHASE-05-REMAINING.md` and `.cache/`.
- `scripts/refactor/`: `verify.mjs`, `ssr-smoke.mjs`, `bundle-report.mjs`.
- `.claude/skills/refactor-phase`, `.claude/skills/refactor-status`, and the `import-auditor`, `verifier` and
  `reviewer` agents.
- `.claude/hooks/guard-bash.mjs` and `stop-gate.mjs`, plus their registrations and the refactor SessionStart hook in
  `.claude/settings.json`.
  - `post-edit.mjs`, which lints each edited file, is worth keeping on its own.
- In `CLAUDE.md`:
  - the "Active work: structure refactor & modernization" section
  - the `docs/refactor/…` lines under "Detailed docs" and "Never edit"
  - "During the refactor, use `node scripts/refactor/verify.mjs` instead" under Verification

**3. Keep:** the lasting enforcement the refactor added.

- The `eslint-plugin-boundaries` config and the `@angular/aria`, `Injectable`, `NgClass`/`NgStyle` and `app-api/`
  bans in `eslint.config.mjs`.
- The rewritten `AGENTS.md`.
- For history without the files, tag the last harness commit (for example `git tag refactor-complete`) before
  deleting it.

Nothing in CI depends on the harness. `.github/workflows/*` only mentions "refactor" as a commit type.

### Still open

- **The SSR baseline is still 4 routes.** Recording it with the 13 routes matters only while the harness exists. If you
  remove it, skip this.
- The other items are listed in step 1 above.

## 4. Visual QA list

None, since this phase changed documentation only.

## 5. Commit message

```
docs(refactor): rewrite AGENTS.md structure and standards

- §3 Structure: target tree, placement and boundary rules, aliases,
  naming, real layer paths; features/payment and admin/leads as the
  reference examples (plus features/partners for config-driven pages)
- §4 Tech stack & standards: ng-primitives replaces @angular/aria;
  services, data layer, headless UI, @defer/hydration, injectAsync and
  Tailwind-first rules, with the cascade caveats Phase 12 learned
- §5 model paths now match core/models and the feature-owned models

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
