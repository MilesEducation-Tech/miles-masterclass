# Phase 1 — Hygiene

Run 2026-09-22 on `refactor/structure-1`. Spec: `docs/refactor/PROMPT.md` §5 (Phase 1).
Plan: `docs/refactor/PLAN.md` §3. Previous phase: [phase-00](phase-00.md).

## 1. Summary

**15 files moved (all recorded by git as renames, so history is preserved), 26 files edited, 3 files
created, 0 files deleted.** No logic changed anywhere — the single behavioural delta is _where_ the
Partner Platform mock interceptor is registered, which is the spec bullet itself.

| Step | What moved                                                                      | Reference updates                                  |
| ---- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1    | `Postman Collection/` → `postman/` (4 files)                                    | 3 path references                                  |
| 2    | `shared/components/__mocks__/` → `src/app/testing/mocks/` (4 files)             | 28 import lines in 22 files + 2 of the mocks' own  |
| 3    | `partner-mock-{interceptor,handlers,role}.ts` → `src/app/testing/partner-mock/` | 3 model imports + `app.config.ts` + `angular.json` |
| 4    | 4 `.scss` → `.css` under `features/home/components/`                            | 4 `styleUrl`, 23 comments converted                |

### The notable item: the mock no longer ships to production

Phase 0 suspected this; Phase 1 measured it. `app.config.ts` statically imported
`partnerMockInterceptor` into the root injector, so its `import('./partner-mock-handlers')` chunk was
emitted in **every** build. Before this phase, the fixture string `ACMEALLI-55AA11BB` was present in
`dist/miles-masterclass-v3/browser/chunk-WULZM25R.js` (15.7 KB) **and** in
`dist/miles-masterclass-v3/server/chunk-JF3XDP7Z.mjs` — fake partner data, fake admin emails
(`admin@deloitte.com`) and a fake API contract served to real users.

The fix is a `fileReplacements` split:

- `src/app/shared/core/interceptors/dev/dev-interceptors.ts` — production, exports `[]`
- `src/app/testing/partner-mock/dev-interceptors.ts` — exports `[partnerMockInterceptor]`
- `angular.json` swaps them on the `local` and `development` configurations only
- `app.config.ts` spreads `...devInterceptors` **last**, so the interceptor order is unchanged

The stub deliberately lives in production space, not `testing/`: production code must never import
`testing/`, and a stub inside `testing/` would have made `app.config.ts` do exactly that. An
`environment.PARTNER_MOCK` flag was considered and **rejected** — it keeps a static import of the
interceptor alive, so the handlers chunk would still be emitted and the `--must-not-contain` proof
the spec requires would fail.

### Steps 1–4, detail

- **Postman.** `git mv "Postman Collection" postman`. Three references updated:
  `src/app/shared/core/models/auth.model.ts:9` (JSDoc), `docs/AUTH_API.md:6`, `AGENTS.md:145`.
  Two hits deliberately left: `.claude/hooks/guard-edit.mjs` is user-owned and its regex
  `/^(postman|Postman Collection)\/.*environment/i` already matches the new path, and `PROMPT.md`
  is the spec describing the rename.
- **Story/spec mocks.** 28 import lines across 22 files (13 `.stories.ts`, 9 `.spec.ts`). The `.spec.ts`
  importers did not exist when the plan was written — spec-repair added them, taking the count from
  21 to 28.
- **Partner mock.** The interceptor's `import('./partner-mock-handlers')` was kept a **dynamic**
  import, as the plan required. Three model imports inside the handlers repointed to `../../admin/…`.
- **SCSS.** `app-download` and `offerings` were 0 bytes. `floating-assets` needed no edits.
  `laptop.css` needed its 23 `//` comments converted to `/* */`, line by line; several are
  commented-out CSS someone will want back, so they were preserved rather than dropped. No `.scss`
  remains under `src/`, and `sass` was never a dependency, so nothing left `package.json`.
- **`.DS_Store`** — confirmed no-op, as Phase 0 predicted. Nothing tracked; `.gitignore:46` already
  covers it.

### Two things the approved plan did not anticipate

Both were caught by the per-step `verify.mjs --quick` typecheck, not by review:

1. The **moved mock files' own imports** needed repointing (`../../core/models/…` →
   `../../shared/core/models/…`). The plan accounted for consumers of the mocks, not the mocks'
   own dependencies.
2. The two course-hero specs spec-repair added import `content.mock` through a
   `shared/components/` path prefix, so they did not match the pattern that rewrote the other 26
   import lines and needed a separate pass.

## 2. Verification

`verifier` subagent, full `node scripts/refactor/verify.mjs`:

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 15s  |
| build (local)   | pass   | 23s  |
| build (prod)    | pass   | 22s  |
| storybook build | pass   | 19s  |
| format check    | pass   | 13s  |
| bundle report   | pass   | —    |
| ssr smoke       | pass   | 4s   |

`reviewer` subagent: **PASS — no spec violations.** It independently confirmed interceptor order is
unchanged, that no production `.ts` statically imports `testing/`, that every reference in §2.10's
list is updated, and that no `eslint-disable`, `@ts-ignore`, `.skip`/`.only` or `changeDetection`
edit appears in the diff.

### Bundle

|             | Before                  | After                   | Delta                     |
| ----------- | ----------------------- | ----------------------- | ------------------------- |
| Initial     | 501.9 KB raw / 101.6 gz | 501.5 KB raw / 101.5 gz | **−0.1 KB gz (−0.1%)**    |
| Lazy chunks | 274 / 10275.9 KB raw    | 271 / 10254.9 KB raw    | **−3 chunks, −21 KB raw** |

The three chunks that left are the mock. SSR smoke passed on all four routes.

### The mandated proof

```
node scripts/refactor/bundle-report.mjs \
  --must-not-contain "ACMEALLI-55AA11BB" --must-not-contain "partnerMock"

OK: "ACMEALLI-55AA11BB" not present in the browser build
OK: "partnerMock" not present in the browser build
```

Both needles matched before this phase. Two checks beyond the gate, because `bundle-report.mjs` only
scans `dist/.../browser` and a green gate alone would not prove the mock still works:

- `grep -rl "ACMEALLI-55AA11BB\|partnerMock" dist/miles-masterclass-v3/server` → **clean**
- `pnpm build` (local configuration) → fixtures **still present**, so the dev mock flow is intact

## 3. Decisions needed / skipped / suspicious

**No decisions are needed to proceed to Phase 2.**

Kept `@Injectable`: none — Phase 1 touched no service. CSS kept: all four converted files stay as
`.css`; none needed to remain `.scss`. No heavy-library service was in scope.

Flagged for later phases:

- **Phase 7 will need to judge `src/app/testing/partner-mock/dev-interceptors.ts`.** It is `testing/`
  code reachable from a build configuration. The reviewer's position — which I share — is that this
  is not a §3 violation, because `fileReplacements` is a build-config substitution and the static
  import graph of production code never touches `testing/`. `eslint-plugin-boundaries` works on the
  import graph, so it should not fire either. Worth confirming when Phase 7 configures it.
- **`partner-mock-handlers.ts` imports three models from `admin/`.** An outbound import _from_
  `testing/`, which §3's rule (which governs who may import _into_ `testing/`) does not prohibit.

Bugs found, logged not fixed (PROMPT.md §7):

- Nothing new this phase. The production mock leak was itself the Phase 1 bullet, so it was fixed
  in scope rather than logged. The eight findings from the spec-repair task that preceded this phase
  are recorded in `STATE.md` under "Findings from spec repair".

Out-of-scope files dirty in the tree, both already self-disclosed in `STATE.md`:

- `public/version.json` + `src/app/shared/core/version/app-version.ts` — build-generated churn
  (`STATE.md` open question 6).
- `docs/refactor/baseline/{bundle,ssr}.json` — a `--record-baseline` run at 10:47 UTC that this
  session did not make. Timestamp and trailing newline only; every recorded number is unchanged.
  These files are user-owned; `git checkout docs/refactor/baseline/` reverts them.

⚠️ **This phase was started with the spec-repair change still uncommitted**, at the user's explicit
instruction. The Phase 1 diff therefore sits on top of ~78 spec-repair files, and
`src/app/testing/mocks/content.mock.ts` carries edits from both (spec-repair added
`MOCK_CONTENT_DETAILS`; Phase 1 moved the file and repointed its imports). Reviewing the two
separately means filtering by path.

## 4. Visual QA list

Part A changes nothing visual, so there is no Part B-style QA list. One optional sanity check: the
four converted stylesheets all belong to the **home page** offerings section
(`app-download`, `offerings`, `laptop`, `floating-assets`). A rename plus comment-syntax conversion
cannot change rendering, and `build:prod` and the `anyComponentStyle` budget both stayed green — but
if you want one look, `pnpm start` (port 4101) and scroll the home page.

## 5. Commit message

```
refactor(structure): phase 1 hygiene — testing/, postman/, css

Move the story mocks to src/app/testing/mocks/ and the Partner Platform mock
to src/app/testing/partner-mock/, updating 28 import lines across 22 files.

Register partnerMockInterceptor only on the local and development build
configurations, via a fileReplacements swap between an empty production stub
(shared/core/interceptors/dev/dev-interceptors.ts) and the testing copy.
This keeps ~21 KB of mock fixtures, fake admin emails and a fake API contract
out of the shipped browser AND server bundles — they were reaching production
before. Proven with bundle-report.mjs --must-not-contain; a local build still
carries them, so the dev mock flow is unchanged.

Rename "Postman Collection/" to postman/ and convert the last four .scss
files to .css. All 15 moves are git renames. No logic, URL, selector or
change-detection changes.
```
