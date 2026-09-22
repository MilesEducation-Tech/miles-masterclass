# Spec repair — make `pnpm test` green before the refactor baseline

## Goal

Get `pnpm ng test --watch=false` from **79 failed / 344 passed (424)** across 71 spec files to **0 failed**,
so `node scripts/refactor/verify.mjs --record-baseline` records a fully green baseline and every later
refactor phase has a real "did I break this?" signal.

This is **pre-refactor cleanup**, not a refactor phase. It does not run through `/refactor-phase`.

## What it read

- `docs/refactor/PROMPT.md` §2 (harness contract), §6 (definition of done)
- `AGENTS.md` §8 (code standards), §9 (before you ship)
- `docs/refactor/.cache/verify-unit-tests.log` (the full failure log)
- `src/app/shared/components/section-nav/section-nav.ts` + `.spec.ts`,
  `src/app/shared/core/services/section-nav/section-nav.ts`
- `src/app/shared/components/__mocks__/{content,services,dialog,toast}.mock.ts`
- `src/app/shared/components/surround-carousel/surround-carousel.spec.ts` (the house pattern for a
  correctly-written spec: `provideRouter([])`, stubbed `ApiClient`, stubbed `Utils`)
- `angular.json` test target (`@angular/build:unit-test`, no `setupFiles` configured)

## Locked decisions

1. **Spec files and test config only.** No production code under `src/app/**` changes. If a failure can
   only be fixed by changing a component or service, it is **logged, not fixed** (PROMPT.md §7).
2. **No weakening.** No `it.skip`, no `describe.skip`, no deleted assertions, no `expect(true)`. A test
   that cannot be made honest gets logged as a decision for the user, not neutered. (CLAUDE.md: never
   disable, skip, or weaken a test.)
3. **Fix the boilerplate at the root, not per-file where a shared fix exists.** `IntersectionObserver`
   is missing from jsdom for every spec, so it goes in one setup file, not 2 specs.
4. **No new abstraction for its own sake.** Existing `__mocks__/*.mock.ts` are reused. A new shared
   helper is added only where 10+ specs would otherwise repeat the identical provider block.
5. **`src/app/testing/` is NOT created.** Phase 1 of the refactor owns that move; creating it now would
   collide. New test-only files stay beside the existing `__mocks__/` folder.

## Root causes (all 79, grouped)

| #   | Cause                                                                                                  | Count | Fix                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `NG0201: No provider found for ActivatedRoute`                                                         | 16    | add `provideRouter([])` to the spec's `providers`                                                                                                                                             |
| B   | `NG0950: Input "x" is required but no value is available yet`                                          | 16    | `fixture.componentRef.setInput(...)` before the first `detectChanges()`, values from `__mocks__/content.mock.ts`                                                                              |
| C   | `NG0201: No provider found for _MasterclassFacade / _ChapterFacade / _FinalAssessmentFacade / _Tracks` | 13    | these are **route-scoped** (`providers:` on the route, not `providedIn:'root'`), so the spec must list them explicitly, with `provideHttpClient()` + `provideHttpClientTesting()` behind them |
| D   | `TypeError: Cannot read properties of undefined` in dialog specs                                       | 7     | provide the dialog's data/ref token (`__mocks__/dialog.mock.ts`)                                                                                                                              |
| E   | `Resource is currently in an error state … 404 Not Found` (real HTTP to `uat-api.milescaira.com`)      | 3     | `provideHttpClientTesting()` + flush; **a unit test must never hit the network**                                                                                                              |
| F   | `ReferenceError: IntersectionObserver is not defined` (unhandled, can false-positive other suites)     | 2     | one global stub in a new setup file                                                                                                                                                           |
| G   | Genuine assertion failures                                                                             | ~22   | see below — each investigated individually                                                                                                                                                    |

### Group G detail (the ones that are not boilerplate)

- **`section-nav.spec.ts` (7).** **Not a product bug — a jsdom artifact.** `shareWithHeader` defaults to
  `true`; `afterNextRender` calls `registerNav`, and `checkNavPosition()` reads `getBoundingClientRect()`,
  which is all-zeros in jsdom. Top `0 ≤ TRIGGER_OFFSET (80)` ⇒ the service sets `showInHeader = true`
  ⇒ the inline `@if (!shareWithHeader() || !showInHeader())` renders nothing. Verified by probe: the same
  host with `mode="sidenav"` renders full markup; with `mode="inline"` it renders four empty
  `<!--container-->` comments. Fix: the inline/sidenav render tests bind `[shareWithHeader]="false"`,
  which is the component's own documented opt-out and isolates the rendering concern the tests name.
  Add one _new_ test that pins the docking behaviour deliberately rather than by accident.
- **`slider.spec.ts` (2)**, **`footer-overlay.spec.ts` isAllowedRoute (1)**, **`app.spec.ts` render title (1)**,
  **`partner-platform.model.spec.ts` blob message (1)**, **`salesforce-lead.spec.ts` (2)**,
  **`aria-autocomplete.spec.ts` (1)** — each read against its implementation first, then classified:
  stale expectation ⇒ fix the spec; implementation actually wrong ⇒ **log it, don't fix it**, and list it
  under "Decisions needed".
- **`NG02956` NgOptimizedImage (2)** — missing `width`/`height` or `priority` in the test fixture.

## Phases

1. **Setup file (unblocks F, and stops 2 unhandled errors polluting other suites).**
   Add `src/test-setup.ts` with a minimal `IntersectionObserver` stub (+ `ResizeObserver` only if a spec
   needs it). Wire it via `setupFiles` on the `test` target in `angular.json`. Verify: the 2 unhandled
   errors disappear.
2. **Group A** — 16 specs, add `provideRouter([])`.
3. **Group C** — 13 specs, add the route-scoped facade + HTTP testing providers.
4. **Group E** — 3 library specs, `provideHttpClientTesting()`. Confirm no spec reaches the network
   (grep the run for `milescaira.com`).
5. **Group B** — 16 specs, `setInput` with mock data.
6. **Group D** — 7 dialog specs.
7. **Group G** — one at a time, each judged on its implementation.
8. Full `node scripts/refactor/verify.mjs --no-ssr`.

After each phase: `pnpm ng test --watch=false` and report the failure count, so progress is a number,
not a claim.

## Files touched

- **New:** `src/test-setup.ts`, `prompts/spec-repair.md` (this file)
- **Modified:** `angular.json` (test target `setupFiles` only), ~71 `*.spec.ts` files
- **Not touched:** anything under `src/app/**` that is not a `.spec.ts`; `.claude/`, `scripts/refactor/`,
  `docs/refactor/PROMPT.md`, `docs/refactor/baseline/`

## Security requirements

- No real credentials, tokens or endpoints in specs. Group E exists _because_ three specs currently call
  `https://uat-api.milescaira.com` for real; after this, no spec performs network I/O.
- Mock data stays synthetic (the existing `__mocks__` use `placehold.co` — keep that).

## Acceptance criteria

- [ ] `pnpm ng test --watch=false` → **0 failed**, 0 unhandled errors
- [ ] No `.skip`, no `@ts-ignore`, no `any`, no deleted assertion anywhere in the diff
- [ ] No production file (non-`.spec.ts` under `src/app/`) modified
- [ ] No spec performs network I/O
- [ ] `pnpm lint`, `pnpm format`, `pnpm build:prod`, `pnpm build-storybook` all still green
- [ ] Every "implementation looks wrong" finding is listed in STATE.md, not silently fixed

## Checks to run

```bash
pnpm ng test --watch=false     # the gate being fixed
pnpm lint
pnpm format:fix
node scripts/refactor/verify.mjs --no-ssr   # full gate set minus SSR (no baseline yet)
```

## How to verify

1. `pnpm ng test --watch=false` prints `Tests  0 failed | 424 passed` (count may shift by the one added
   section-nav docking test).
2. `git diff --stat -- src | grep -v '\.spec\.ts'` prints nothing (proves production code untouched).
3. Run twice; the count is identical (proves no order-dependent leakage between suites).

## Risks

- **Specs that pass for the wrong reason.** Adding a provider can turn a failing test green without the
  test asserting anything real. Mitigation: locked decision #2 — every group-G spec is read against its
  implementation, and "should create"-only stubs are left as-is rather than padded out.
- **Hidden product bugs.** Group G may surface real defects (`footer-overlay.isAllowedRoute` returning
  `true` for a route outside the allowlist looks like one). These are logged, not fixed — fixing product
  code here would contaminate the refactor baseline.
- **Order-dependent suites.** `SectionNavService` is `providedIn:'root'` and shared; TestBed resets per
  file but not per `it`. Verified by running the suite twice.
- **Scope creep.** 71 files is large. If context runs long, stop at a phase boundary, report the failure
  count, and hand off — the phase list above is the resume point.
