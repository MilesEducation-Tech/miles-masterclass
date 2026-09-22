# Phase 2 — Path aliases

Run 2026-09-22 on `refactor/structure-2`. Spec: `docs/refactor/PROMPT.md` §5 (Phase 2) + §3 (aliases).
Plan: `docs/refactor/PLAN.md` §3. Previous phase: [phase-01](phase-01.md).

## 1. Summary

**2 config files edited, 380 `.ts` files edited, 0 files moved, created or deleted.** Nothing but
`paths` blocks and import specifier strings changed. Zero runtime behavior change — the bundle report
confirms the emitted output is byte-for-byte equivalent.

| Step | What                                                     | Scale                            |
| ---- | -------------------------------------------------------- | -------------------------------- |
| 1    | `paths` in `tsconfig.json` + `.storybook/tsconfig.json`  | 2 files, 7 aliases each          |
| 3    | Batch A — `@env` + `@testing` + `@layout`                | 82 specifiers / 74 files         |
| 4    | Batch B — `@admin` + `@features` + intra-area cross-unit | 212 specifiers / 79 files        |
| 5    | Batch C — `@shared`                                      | 450 specifiers / 164 files       |
| 6    | Batch D — `@core`                                        | 717 specifiers / 298 files       |
|      | **Total** (+ 3 pilot imports in step 1)                  | **1,464 specifiers / 380 files** |

Final alias usage across `src/`: `@core/` 719 · `@shared/` 450 · `@admin/` 137 · `@features/` 75 ·
`@env/` 50 · `@testing/` 28 · `@layout/` 5.

### The aliases

```jsonc
// tsconfig.json — no baseUrl, ./-prefixed targets, moduleResolution stays bundler
"@core/*":     ["./src/app/shared/core/*"],   // Phase 3 → ./src/app/core/*
"@shared/*":   ["./src/app/shared/*"],
"@layout/*":   ["./src/app/layout/*"],
"@features/*": ["./src/app/features/*"],
"@admin/*":    ["./src/app/admin/*"],
"@testing/*":  ["./src/app/testing/*"],
"@env/*":      ["./src/environments/*"]
```

Two decisions the user approved before execution, both departing from the literal text:

1. **Aliases + full codemod, not config-only.** PROMPT.md §5's Phase 2 bullet says only "add `paths` …
   verify they resolve." But PLAN.md §3 justifies running Phase 2 before Phase 3 on the grounds that
   "aliasing first collapses the Phase 3–6 diff enormously" — which is only true if the existing
   relative imports are actually rewritten. Both are in scope.
2. **`@core/*` points at today's `./src/app/shared/core/*`.** PLAN.md §3 listed `./src/app/core/*`,
   a path that does not exist until Phase 3. Pointing it at the current location means Phase 3's move
   is a **one-line tsconfig flip** instead of 719 import rewrites.

**Invariant for every later phase: core is reached only via `@core/*`, never `@shared/core/*`.** The
two aliases overlap today, and `@shared/core/…` would break silently in Phase 3. The codemod enforced
longest-alias-wins; `grep -rn "'@shared/core" src` returns **0**.

### The one thing that does not inherit `paths`: Storybook

`build`, `serve`, SSR and `test` all resolve the root `tsconfig.json` aliases with no extra config —
esbuild honours `paths` with `./` targets and no `baseUrl`, and the `@angular/build:unit-test` builder
defaults its tsconfig to `tsconfig.spec.json`. **Storybook does not.**

`@storybook/angular` is a webpack5 framework and resolves modules through
`tsconfig-paths-webpack-plugin@4.2.0`, loaded against `.storybook/tsconfig.json`. `tsconfig-paths`
rewrites **only `baseUrl`** when merging an `extends` chain — never `paths` — and anchors
`absoluteBaseUrl` to the directory of the config it loaded. A root-declared `./src/app/...` target is
therefore joined onto `<repo>/.storybook` and misses; `tsc` is fine, webpack fails with
`Module not found: Can't resolve '@core/...'`.

Fix: **the same `paths` block re-declared in `.storybook/tsconfig.json` with `../src/...` targets**,
with a `// why` comment. Both resolvers then agree. Rejected: `"baseUrl": ".."` there (reintroduces the
`baseUrl` the spec removes and changes bare-specifier resolution for stories) and a `webpackFinal`
hook (`main.ts` customises nothing today — don't start).

⚠️ **Phase 3 must repoint `@core/*` in BOTH tsconfigs.**

This was caught before the codemod ran, not after: step 1 converted one pilot import in a
`.stories.ts` precisely because `verify.mjs --quick` typechecks only `tsconfig.app.json`, so a
Storybook resolver failure would otherwise have stayed hidden until the end-of-phase gate — after
1,464 lines had already been rewritten.

### The codemod

A throwaway script (session scratchpad, not committed) resolved every `from '<rel>'` and
`import('<rel>')` specifier in the tracked `src/**/*.ts` set against its file's directory, classified
the target into an area unit, and rewrote only when importer and target are in different units.
Each `features/<x>` and `admin/<x>` counts as its own unit, per §3's "relative imports are allowed only
within the same feature" — that covers 158 intra-area edges including
`partner-platform-v2 → partner-platform` (39) and `partners → home` (14).

Three self-checks, all enforced as hard throws, not warnings:

- every rewritten target must resolve to a real file on disk;
- the alias must round-trip back to the byte-identical repo-relative target;
- the per-file import count must be unchanged.

After batch D, re-running all four batches in `--dry` mode reports **0 remaining specifiers** — the
conversion is complete, not partial.

**Deliberately left relative: 38 crossing imports** whose targets are `pages/` (32), `auth/` (5),
`configuration/` (1) and `src/app/*.ts` app-root files. §3 defines no alias for these because the
target structure has no such folders — Phases 3–6 dissolve them, and those imports get rewritten then.

### ESLint needed no change

PLAN.md §3 says Phase 2 should "add `eslint-import-resolver-typescript`". It is not needed here and was
**not** installed: `eslint-plugin-import` is absent, no type-aware `typescript-eslint` config is
enabled, no `parserOptions.project` is set, and there is no `import/no-unresolved`, `import/order`,
`boundaries` or `no-restricted-imports` rule — so nothing in the current flat config resolves a
specifier and nothing can fail on an unresolved `@core/…`. The resolver belongs to **Phase 7**, which
adds the rules that need it. `pnpm lint` is green with zero config change. No dependency was added.

## 2. Verification

`verifier` subagent, full run — **8/8 green**:

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 6s   |
| unit tests      | pass   | 18s  |
| build (local)   | pass   | 26s  |
| build (prod)    | pass   | 30s  |
| storybook build | pass   | 24s  |
| format check    | pass   | 15s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

Per batch, additionally: `verify.mjs --quick` (typecheck + lint) **plus**
`pnpm exec tsc -p tsconfig.spec.json --noEmit` — the quick gate only typechecks `tsconfig.app.json`,
and 152 spec files carry crossing imports. All four batches passed both.

`reviewer` subagent: **PASS — no spec violations.** Confirmed 384 files all `M` (zero `A`/`D`/`R`), no
`baseUrl` anywhere, no `@shared/core/…`, no `changeDetection`/template/CSS/identifier change, no new
`eslint-disable`/`@ts-ignore`/`.skip`, `package.json` and `pnpm-lock.yaml` untouched, harness files
untouched.

### Bundle parity — the real proof

Aliases must not change what is emitted. They didn't:

- Initial: **12 files, 501.5 KB raw / 101.5 KB gzip** — `-0.1 KB (-0.1%)` gzip vs
  `baseline/bundle.json`, i.e. compression rounding noise. File count, raw sizes and chunk breakdown
  unchanged.
- Lazy: **271 chunks**, 10,254.9 KB raw / 3,042.4 KB gzip — unchanged.

### `fileReplacements` still fire through `@env/*`

The 50 `environment` imports now go through an alias, so the Phase 1 mock-leak proof was re-run
explicitly rather than assumed:

```
OK: "ACMEALLI-55AA11BB" not present in the browser build
OK: "partnerMock" not present in the browser build
```

`angular.json`'s `fileReplacements` match on resolved file path, so alias-form imports still hit them —
now measured, not inferred.

### SSR smoke — all four recorded routes

```
OK   /                                                     302  ""
OK   /us/accounting/partners/cpacanada                     200  "Miles Masterclass - AI-Powered CPE Training…"
OK   /us/accounting/masterclass/154/adulting-in-business    200  "Miles Masterclass"
OK   /admin/login                                          200  "Miles Masterclass - AI-Powered CPE Training…"
```

(The course route's generic title is the pre-existing degraded baseline — open question 8, unchanged
by this phase.)

## 3. Decisions needed / skipped / suspicious

**No decision is needed to proceed to Phase 3.** Nothing in this phase is blocked.

### Findings logged, not fixed (PROMPT.md §7)

1. **Six component `.css` files use `@reference '../../../../styles/styles.css'`.** TS path aliases do
   not cover CSS — Tailwind resolves these on disk — so they break when those components move in
   **Phase 4**. PLAN.md does not currently cover them. Phase 4 must update them by hand, or add a
   `@shared`-style CSS convention.
2. **Move-time landmines for Phase 3**, none of them alias problems but all in the same blast radius:
   - `tsconfig.spec.json`'s explicit `include` of `"src/app/shared/core/constant/icon.ts"`
   - `eslint.config.mjs`'s two `ignores` entries for `constant/location.ts` and `location-min.ts`
   - `angular.json`'s `fileReplacements` pair for
     `src/app/shared/core/interceptors/dev/dev-interceptors.ts`
   - `scripts/generate-version.mjs:42`, which **writes** `src/app/shared/core/version/app-version.ts`
   - **both** `@core/*` entries — `tsconfig.json` and `.storybook/tsconfig.json`
3. **Build-generated churn is in the diff again** — `public/version.json` and
   `src/app/shared/core/version/app-version.ts` are regenerated by every `pre*` script. This is Phase
   1's open question 6, still unresolved; it will dirty every remaining phase's diff. Revert before
   committing if you want a clean Phase 2 commit:
   `git checkout -- public/version.json src/app/shared/core/version/app-version.ts`
   (Claude is blocked from running that form by the harness guard.)

### Nothing skipped

Every aliasable crossing import was converted; the four `--dry` re-runs report 0 remaining. No test,
lint rule or gate was weakened, skipped or disabled.

## 4. Visual QA

**None.** Part A changes no rendering. The SSR smoke and the unchanged bundle report cover this phase.

## 5. Commit message

```
refactor(structure): phase 2 path aliases

Add tsconfig `paths` for @core/@shared/@layout/@features/@admin/@testing/@env
(no baseUrl, ./-prefixed targets) and convert 1,464 cross-area relative import
specifiers across 380 files to use them.

@core/* points at today's ./src/app/shared/core/* so Phase 3's move of that
folder is a one-line tsconfig change rather than 719 import rewrites. Core is
reached only via @core/*, never @shared/core/*, which would break in Phase 3.

.storybook/tsconfig.json re-declares the same paths with ../src/* targets:
@storybook/angular resolves through tsconfig-paths-webpack-plugin, which anchors
`paths` to the directory of the config it loads and never rewrites them across
`extends`, so the root config's ./src/* targets resolve to .storybook/src/* and
miss. Phase 3 must repoint @core/* in both files.

Imports targeting pages/, auth/, configuration/ and the app root stay relative —
those folders have no alias in the target structure and are dissolved in
Phases 3-6.

No files moved, created or deleted. No logic, template, CSS or change-detection
change. No new dependency: ESLint has no import-resolution rule today, so
eslint-import-resolver-typescript waits for Phase 7.

Verifier 8/8 green. Initial bundle 501.5 KB raw / 101.5 KB gzip, -0.1% vs
baseline (compression noise); 271 lazy chunks unchanged. Environment
fileReplacements re-proven through the @env alias: the Phase 1 needles
ACMEALLI-55AA11BB and partnerMock are still absent from the production browser
bundle. SSR smoke green on all four recorded routes.
```
