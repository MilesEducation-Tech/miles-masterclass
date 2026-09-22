# Refactor state

Cross-session handoff. Claude updates "Now", the trackers, open questions and the step log.
The user owns the "Decisions" section.

Status legend: ⬜ not started · 🟡 in progress · ✅ done (verified, reported) · ⛔ blocked · ⏸ awaiting decision

## Now

- Phase: **2 — Path aliases ✅ COMPLETE.** Report: [phase-02](reports/phase-02.md).
  `verifier` **8/8 green** (lint 6s · unit tests 18s · build local 26s · build prod 30s ·
  storybook 24s · format 15s · bundle report · ssr smoke 3s, all four routes).
  `reviewer` **PASS — no spec violations.**
- What landed: **2 config files + 380 `.ts` files edited, 0 files moved/created/deleted.**
  **1,464 relative import specifiers converted to aliases**, in four verified batches —
  A `@env`/`@testing`/`@layout` (82), B `@admin`/`@features` + intra-area cross-unit (212),
  C `@shared` (450), D `@core` (717), plus 3 pilots. Re-running all four batches in `--dry` mode
  afterwards reports **0 remaining**, so the conversion is complete, not partial.
  Final usage: `@core/` 719 · `@shared/` 450 · `@admin/` 137 · `@features/` 75 · `@env/` 50 ·
  `@testing/` 28 · `@layout/` 5.
- **`@core/*` points at today's `./src/app/shared/core/*`** (PLAN.md §3 listed `./src/app/core/*`,
  which does not exist until Phase 3). **Phase 3's core move is therefore a one-line tsconfig flip
  instead of 719 import rewrites** — but it must be flipped in **BOTH** `tsconfig.json` **and**
  `.storybook/tsconfig.json`.
- **Invariant for every later phase: core is reached only via `@core/*`, never `@shared/core/*`.**
  The two aliases overlap today and `@shared/core/…` would break silently in Phase 3. The codemod
  enforced longest-alias-wins; `grep -rn "'@shared/core" src` returns **0**.
- ⚠️ **Storybook does not inherit root `paths`** — caught in step 1 by a deliberate pilot import in a
  `.stories.ts`, before the codemod ran. `@storybook/angular` is webpack5 and resolves through
  `tsconfig-paths-webpack-plugin@4.2.0`, which rewrites only `baseUrl` across `extends` (never
  `paths`) and anchors to the directory of the config it loads, so the root's `./src/...` targets
  resolve to `.storybook/src/...` and miss. Fix: the same block re-declared in
  `.storybook/tsconfig.json` with `../src/...` targets. `verify.mjs --quick` typechecks only
  `tsconfig.app.json`, so this would otherwise have surfaced only at the end-of-phase gate.
- **No dependency added.** PLAN.md §3's "add `eslint-import-resolver-typescript`" is **not** needed
  here: `eslint-plugin-import` is absent, no type-aware config is on, no `parserOptions.project` is
  set, and no rule resolves specifiers. It belongs to **Phase 7**, which adds the rules that need it.
- **Bundle parity proven**, which is the real gate for this phase: initial **12 files, 501.5 KB raw /
  101.5 KB gzip** (−0.1% gzip vs baseline = compression noise), lazy **271 chunks** unchanged.
  The Phase 1 mock-leak needles were re-run explicitly because all 50 `environment` imports now go
  through `@env/*` — `ACMEALLI-55AA11BB` and `partnerMock` are still **absent** from the production
  browser bundle, so `fileReplacements` still fire through the alias.
- **38 crossing imports deliberately left relative** — targets in `pages/` (32), `auth/` (5),
  `configuration/` (1) and `src/app/*.ts`. §3 defines no alias for these; Phases 3–6 dissolve those
  folders and rewrite the imports then.
- ⚠️ **Build-generated churn is in the diff again** (Phase 1's open question 6, still open):
  `public/version.json` + `src/app/shared/core/version/app-version.ts` are rewritten by every `pre*`
  script and will dirty every remaining phase. To get a clean Phase 2 commit:
  `git checkout -- public/version.json src/app/shared/core/version/app-version.ts`
  (Claude is blocked from that form by the harness guard.)
- Branch: **`refactor/structure-2`**, clean before this session. Baselines present.
- Next command: commit Phase 2 (message in [phase-02](reports/phase-02.md) §5), then
  **`/refactor-phase 3`** (core). Phase 3's move list is PLAN.md §3; the reference-update checklist
  it must not miss is in "Findings from Phase 2" below. No unticked decision gates Phase 3 —
  the remaining ones gate phases 5, 6, 10, 11 and 13.

## Part A tracker

| Phase | Scope           | Status | Report                          | Committed |
| ----- | --------------- | ------ | ------------------------------- | --------- |
| 0     | Audit & plan    | ✅     | [phase-00](reports/phase-00.md) |           |
| 1     | Hygiene         | ✅     | [phase-01](reports/phase-01.md) |           |
| 2     | Path aliases    | ✅     | [phase-02](reports/phase-02.md) |           |
| 3     | Core            | ⬜     |                                 |           |
| 4     | Shared & layout | ⬜     |                                 |           |
| 5     | Features        | ⬜     |                                 |           |
| 6     | Admin           | ⬜     |                                 |           |
| 7     | Boundaries      | ⬜     |                                 |           |

## Part B tracker

Filled by Phase 0 from PLAN.md §13. Each cell holds a status. **Run features top to bottom** —
ordered smallest/lowest-risk first so the pattern is proven before it reaches `offerings`.
Names are the **post-Part-A** folder names (so `features/tracker` = today's caira-tracker + cpe-tracker).
`—` = not applicable to that phase.

| Feature / area                 | 8 Services | 9 Data | 10 UI | 11 Defer+Lazy  | 12 Tailwind |
| ------------------------------ | ---------- | ------ | ----- | -------------- | ----------- |
| `shared/ui` (primitives)       | —          | —      | ⬜    | —              | ⬜          |
| `features/blog`                | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/library`             | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/tracker` (caira+cpe) | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/auth`                | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `layout`                       | ⬜         | ⬜     | ⬜    | — (above fold) | ⬜          |
| `features/home`                | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/partners`            | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/payment`             | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `features/offerings`           | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `admin/*` (non-partner)        | ⬜         | ⬜     | —     | ⬜             | ⬜          |
| `admin/partner-platform(-v2)`  | ⬜         | ⬜     | —     | ⬜             | ⬜          |

Phase 11 also has two **one-off, first-session** items that are not per-feature:
enable `provideClientHydration(withIncrementalHydration())`, and move
`@import 'video.js/dist/video-js.css'` out of the global `styles.css`.
Phase 12's first session moves design tokens into `@theme`.

| Phase | Scope                         | Status | Report |
| ----- | ----------------------------- | ------ | ------ |
| 13    | Partner landing consolidation | ⏸      |        |
| 14    | Documentation                 | ⬜     |        |

## Decisions (owner: user)

- [x] **PLAN.md approved (Phase 0)** — approved by the user 2026-09-22.
- [x] Baseline recorded on untouched code — done 2026-09-22 (see the course-route caveat, Q8)
- [ ] Phase 6: v1 partner platform removal and v2 → `partner-platform` rename.
      **Phase 0 finding:** v1 is not removable as a unit. Its routed pages are dead (routes commented
      out in `admin.routes.ts`), but `partner-platform/shared/` is the live models/services layer for
      v2 (39 edges) and 6 other admin features (17 edges), and v2 imports 3 dialogs out of v1's dead
      pages. Phase 6 extracts that layer to `admin/core/` first; removal is a later decision.
- [ ] Phase 7: temporary warnings allowed for violations Part B will fix. **Expected list:** the
      `Utils` → shared-dialog imports that Phase 11 converts to dynamic `import()`.
- [ ] Phase 10: CDK usages. **Phase 0 finding: only 2 exist** — `CdkTrapFocus` (`layout/header`) and
      `BreakpointObserver` (`how-to-claim-credly-badge`). ng-primitives has no equivalent for either.
      **Recommendation: keep both**, migrate neither.
- [ ] Phase 13: consolidate partner landing pages (yes/no). **Phase 0 finding: strongly supported** —
      `ctcpa` vs `dscpa` differ by 8 hunks, all name/id swaps; 10 of 12 pages collapse into one
      config-driven page. See PLAN.md §10.
- [x] ~~Components with explicit `ChangeDetectionStrategy.Eager`~~ — **NOT APPLICABLE.** All 18
      explicit `changeDetection:` lines in `src/` are `OnPush`; there are zero `Eager` and zero
      `Default`. Closed by Phase 0.

New decisions raised by Phase 0:

- [ ] Phase 5: dissolve `pages/` per PLAN.md §3 (the target structure has no top-level `pages/`;
      the destination of each page folder is the judgement call).
- [ ] Phase 5: promote `home/components/offerings/*` (14 cross-feature importers) and
      `partner-content-list` (6) into `shared/components/`.
- [ ] Phase 11: how to fix the **839 KB gzip** `constant/location-min.ts` chunk — serve from the API
      (`v2/locations/autocomplete/` already exists) or `await import()` behind the country field.
      Biggest single perf win in the audit.

Decisions the user already settled in-session on 2026-09-22 (recorded, no action needed):

- [x] Trackers: **merge** `caira-tracker` + `cpe-tracker` → `features/tracker/{caira,cpe}/` in
      Phase 5, breaking their circular dependency.
- [x] Dead code: **list only, do not delete.** Consequence: `constant/location.ts` (25 MB,
      969,250 lines, zero importers) gets `git mv`'d in Phase 3 and stays in the ESLint ignore list.
- [x] `Utils` service: **move to `shared/services/utils.ts`** in Phase 4, not into `core/`.

## Findings from Phase 2 (logged, not fixed — PROMPT.md §7)

1. **Six component `.css` files use `@reference '../../../../styles/styles.css'`.** TS path aliases do
   not cover CSS — Tailwind resolves these on disk — so they break when those components move in
   **Phase 4**. PLAN.md does not cover them.
2. **Phase 3's reference-update checklist**, beyond the move itself. None are alias problems; all are
   hardcoded `src/app/shared/core/...` paths in the same blast radius:
   - `tsconfig.json` **and** `.storybook/tsconfig.json` — the `@core/*` target
   - `tsconfig.spec.json` — explicit `include` of `"src/app/shared/core/constant/icon.ts"`
   - `eslint.config.mjs` — `ignores` entries for `constant/location.ts` and `location-min.ts`
   - `angular.json` — the `fileReplacements` pair for
     `src/app/shared/core/interceptors/dev/dev-interceptors.ts`
   - `scripts/generate-version.mjs:42` — **writes** `src/app/shared/core/version/app-version.ts`
     (harness-owned; the user edits this one)

## Findings from spec repair (logged, not fixed — PROMPT.md §7)

These are environment and product observations the repair surfaced. None changed production code.

1. **`environment.production` is `false` during `ng test`.** The unit-test builder resolves
   `environment.development.ts` (UAT API URL) — confirmed by probe. Anything gated on
   `environment.production` is therefore **dead code under test by default**; `SalesforceLead.create`
   had three assertions passing vacuously against a method that had already returned. `vi.mock` is
   rejected outright for relative imports by the Angular unit-test system, so that spec flips the
   flag on the shared object and restores it in `afterAll`. Worth deciding whether the test target
   should point at the production configuration instead.
2. **Zoneless TestBed changes how host specs must be written.** Reassigning a plain field on a test
   host and calling `detectChanges()` no longer marks the view dirty, so the binding keeps its old
   value and the test asserts stale DOM without failing loudly. `section-nav.spec.ts` was doing
   exactly this. Test hosts need **signal** inputs. Any spec written before this is suspect.
3. **Two jsdom gaps are now polyfilled centrally in `src/test-setup.ts`:** no `IntersectionObserver`
   (constructed unguarded inside `afterNextRender` by section-nav, the three library pagination
   pages and the tracker badge lists — it threw on a timer and Vitest blamed unrelated suites), and
   no `Blob.prototype.text` (so `partnerBlobErrorMessage()` always fell into its catch and its test
   asserted the fallback string instead of the path it names).
4. **`video-list-wrapper`: the `videoList` default of `[]` is unreachable.** The template
   dereferences `activeVideo().videoSrc` with no guard, so rendering it with the default throws.
   Every real call site passes a list. Either the default should go or the template should guard.
5. **`badge-info-dialog` close button lost its specific accessible name.** It now renders the shared
   `<app-button variant="close">`, whose `aria-label` is hard-coded to `'Close'`; the spec was still
   looking for `'Close badge dialog'`. A generic "Close" is a small a11y regression on a dialog.
6. **`footer-overlay.isAllowedRoute` is NOT a product bug** — closes open question 5. The spec
   contradicted itself: one test asserted descendants match, the next asserted a `masterclass`
   descendant must not. Prefix matching is intended; `CONTINUE_CARD_ROUTES` + `isExactRoute` exist
   precisely to narrow the Continue Learning card alone. The expectation was corrected, not the code.
7. **`section-nav` docking in jsdom** — confirms open question 4. `getBoundingClientRect()` is
   all-zeros, so `rect.top (0) <= TRIGGER_OFFSET (80)` and the service always reports
   `showInHeader`, hiding the inline nav. The render tests opt out via `shareWithHeader`; the
   docking rule now has its own two tests instead of silently breaking the other six.
8. **`micro-learning-course.spec.ts` had a drifted hand-written facade stub** (missing
   `scrollToIdRequest`). Replaced with the real route-scoped facades behind the testing HTTP
   backend, which cannot go stale. Other specs with hand-written facade stubs carry the same risk.

## Open questions (from Claude)

0. **NEW (Phase 0) — bugs found, logged not fixed** (spec §7). Full list in
   `reports/phase-00.md` §3. The ones worth acting on outside the refactor:
   `--radius-4xl` is used at `styles.css:297,303,308` but never defined; the 8 `@ng-icons/*` packages
   are in `devDependencies` while production code imports them via `configuration/ng-icon.ts`;
   `lenis` is an unused dependency; `app.config.ts` wires a dev-only mock interceptor into the
   production root injector (Phase 1 fixes that one). Two AGENTS.md §9 statements are stale —
   `pnpm start` uses port **4101** not 4100, and the initial bundle is **501.9 KB**, not "near its
   2.00 MB budget". Phase 14 should correct both.
1. ~~**Branch.**~~ **RESOLVED 2026-09-22.** We are on `refactor/structure-1` with a clean working
   tree, so Phase 1 is free to move source once the test gate is green.
2. ~~**Storybook gate.**~~ **RESOLVED 2026-09-22.** User chose restore. `git checkout 8271fa4^ -- .storybook`
   brought back main/preview/manager/tsconfig×2/typings; `pnpm build-storybook` completes successfully.
   Config-only, nothing under `src/`.
3. ~~**Unit tests.**~~ **RESOLVED 2026-09-22** — `prompts/spec-repair.md` approved and executed;
   `ng test` is 0 failed and the full verifier is 8/8 green. Original analysis kept below for
   reference; the live group counts turned out to differ (see "Now").
   _Historical:_ Implementation prompt written to `prompts/spec-repair.md` (AGENTS.md §1 step 5).
   Root causes now traced; 58 of 79 are mechanical:
   - 16 × missing `provideRouter([])` / `ActivatedRoute`
   - 16 × `NG0950` required input never set (`setInput` + `__mocks__/content.mock.ts`)
   - 13 × route-scoped facades not in the spec's `providers` (`MasterclassFacade` 6, `ChapterFacade` 4,
     `FinalAssessmentFacade` 2, `Tracks` 1)
   - 7 × dialog specs missing their data/ref token
   - 3 × specs making **real network calls** to `https://uat-api.milescaira.com` (library badge/course/
     instructor) — need `provideHttpClientTesting()`
   - 2 × `IntersectionObserver` undefined → new `src/test-setup.ts` wired via `angular.json`
   - ~22 × genuine assertion failures, judged individually
4. ~~**`section-nav.spec.ts` (7 failures)**~~ **RESOLVED 2026-09-22.** Confirmed, plus a second
   cause the original diagnosis missed: zoneless change detection meant the host's plain `mode`
   field never reached the binding, so the sidenav tests were asserting against an inline render.
   See findings 2 and 7 above. Original note kept below. `shareWithHeader` defaults
   `true`; `afterNextRender` → `registerNav` → `checkNavPosition()` reads `getBoundingClientRect()`,
   all-zeros in jsdom, so `0 ≤ TRIGGER_OFFSET (80)` sets `showInHeader = true` and the inline
   `@if (!shareWithHeader() || !showInHeader())` renders nothing. Probe confirmed: same host renders
   full markup in `sidenav` mode, four empty `<!--container-->` comments in `inline`. Spec fix
   (`[shareWithHeader]="false"`), not a component change.
5. ~~**Suspected real bug**~~ **RESOLVED 2026-09-22 — it was NOT a product bug.** The spec
   contradicted itself; prefix matching is the intended design. See finding 6 above. No production
   fix was needed, so "0 failed" was reachable without you approving any. Original note below.
   "rejects routes outside the allowlist" expects `false`, gets `true`. That reads like a genuine
   product defect, not a stale spec. PROMPT.md §7 says log bugs, don't fix them — so I plan to log it
   and leave that test red. Same treatment for any other group-G failure that turns out to be a real
   defect, which means a literal "0 failed" may not be reachable without you approving production fixes.
6. **`src/app/shared/core/version/app-version.ts` is tracked but auto-generated** by
   `scripts/generate-version.mjs` on every build, so it dirties the working tree after each `pnpm build`
   and will pollute every refactor phase diff. Phase 1 hygiene candidate (gitignore + generate at build).
7. **`docs/refactor/README.md` does not exist** — referenced in the setup request but not in the repo.
8. **The recorded course-route SSR baseline captured DEGRADED SEO — needs your call.**
   `baseline/ssr.json` for `/us/accounting/masterclass/154/adulting-in-business` recorded
   `title: "Miles Masterclass"`, `canonical: ""`, `jsonLdBlocks: 0`. Live production for the same URL
   serves `<title>Adulting in Business | Miles Masterclass</title>`. So the local prod SSR could not
   resolve course 154's data (consistent with `https://api.milescaira.com/v2/library/` returning 404
   from this machine) and fell back to generic SEO. `textLength` was still 23907, so the page body
   rendered — only the course-specific SEO is missing.
   **Consequence:** that route currently pins the fallback state, so course-page SEO could regress
   during the refactor and the SSR gate would still report OK — exactly the regression that route was
   added to catch. The other three routes are fine (`/` 302 → `/us/accounting/home`; the partner page
   recorded a real canonical + 1 JSON-LD block; `/admin/login` is `RenderMode.Client`, textLength 72,
   as expected).
   Options: (a) accept it — the route still guards status, structure and text length, just not course
   SEO; (b) find why SSR can't reach the course API locally (auth header? egress? different host?) and
   re-record; (c) swap in a different route — though any dynamic course page hits the same wall.
   I cannot re-record (harness-owned); you run `--record-baseline` after deciding.

## Step log (latest first; keep the last 30 lines)

- 2026-09-22 **Phase 2 ✅ complete — aliases added and 1,464 imports converted; 8/8 green.**
  `tsconfig.json` gets the 7 aliases (no `baseUrl`, `./` targets, `moduleResolution` untouched);
  380 `.ts` files get alias specifiers. **Zero moves, zero logic change**, and the bundle report
  proves it — initial 501.5 KB raw / 101.5 KB gzip (−0.1% = compression noise), 271 lazy chunks,
  both unchanged. Four batches, each gated on `--quick` **plus** a `tsconfig.spec.json` typecheck the
  harness does not run; a `--dry` re-run of all four afterwards reports 0 remaining. **The find that
  justified the pilot step: Storybook does not inherit root `paths`** — `tsconfig-paths-webpack-plugin`
  rewrites only `baseUrl` across `extends` and anchors to the config it loads, so `./src/...` becomes
  `.storybook/src/...` and misses; `.storybook/tsconfig.json` now re-declares the block with
  `../src/...`. Because `--quick` typechecks only `tsconfig.app.json`, that failure would otherwise
  have surfaced only after 1,464 lines were already rewritten. Two deviations from PLAN.md §3, both
  user-approved beforehand: the codemod is in scope at all (the literal spec bullet is config-only,
  but the collapse of the Phase 3–6 diff is the whole reason this phase runs first), and `@core/*`
  points at today's `shared/core` rather than the not-yet-existing `src/app/core`. PLAN.md's
  "add `eslint-import-resolver-typescript`" was checked and **rejected for this phase** — nothing in
  the flat config resolves a specifier, so it belongs to Phase 7. 38 imports into
  `pages/`/`auth/`/`configuration/`/app-root stay relative by design. `fileReplacements` re-proven
  through `@env/*` with the Phase 1 needles.
- 2026-09-22 **Phase 1 steps 1–4 executed; closing gates in flight.** All four `--quick` checks green
  along the way. 15 `git mv`s, all recorded as **renames**. Headline: the Partner Platform mock no
  longer reaches production — `--must-not-contain "ACMEALLI-55AA11BB"` and `"partnerMock"` both pass
  where both previously matched, the server bundle greps clean by hand, and a `local` build still
  carries the fixtures so the dev flow is unbroken. 274 → 271 lazy chunks, −21 KB raw, initial
  −0.1% gzip. Two things the approved plan missed, both caught by the per-step typecheck: the moved
  mock files' **own** imports needed repointing (`../../core/models/…` → `../../shared/core/…`), and
  the two hero specs spec-repair added reach `content.mock` through a `shared/components/` prefix, so
  they fell outside the pattern that rewrote the other 26 import lines. Started with spec-repair
  still uncommitted (user instruction), so this diff sits on top of those 78 files and
  `testing/mocks/content.mock.ts` carries edits from both.
- 2026-09-22 **spec-repair executed — `ng test` 79 failed → 0, full verifier 8/8 GREEN.** Not a
  refactor phase; it is the prerequisite that unblocks Phase 1. ~75 `*.spec.ts` rewritten, new
  `src/test-setup.ts`, `angular.json` `test.options.setupFiles`, `tsconfig.spec.json` include,
  `MOCK_CONTENT_DETAILS` appended to the existing `__mocks__/content.mock.ts`. 427 passed / 1 skipped
  of 428; the 4 added tests replace assertions that could not stand (the `ng new` `<h1>` scaffold, a
  four-slide expectation against a one-item mock, an `isOpen` assertion for state aria-autocomplete
  handed to ng-primitives). **6 assertions removed, 10 added; no `.skip`, no `@ts-ignore`, no `any`,
  no silently dropped coverage.** Initial bundle +0.0% vs baseline. Eight findings logged above —
  the two that matter most for later phases: `environment.production` is **false** under `ng test`,
  and zoneless CD means plain-field test hosts assert stale DOM. Closed open questions 3, 4 and 5;
  question 5's "suspected real bug" was a self-contradictory spec, not a defect.
- 2026-09-22 **Phase 1 planned, NOT executed — precondition failed.** `ng test` is still red (79) and
  the verify script gates it by exit code, so the phase could not close green; the user chose to run
  `prompts/spec-repair.md` first. **No `src/` changes** — read-only audit plus this file. Ran
  `import-auditor` over all 7 files Phase 1 moves: 37 references total, every `__mocks__` consumer is
  a `.stories.ts` (zero production, zero spec), and the only production wiring point is
  `app.config.ts:24`. Confirmed against the built `dist/` that the partner mock **ships to production
  today**, in both the browser (`chunk-WULZM25R.js`, 15.7 KB) and server bundles. Settled two design
  points: the `fileReplacements` stub lives in production space at
  `shared/core/interceptors/dev/dev-interceptors.ts` — an `environment` flag was rejected because it
  keeps a static import of the interceptor, so the handlers chunk would still be emitted and the
  absence proof would fail; `ACMEALLI-55AA11BB` and `partnerMock` chosen as the bundle needles. Also
  confirmed: branch is `refactor/structure-1`, closing open question 1; and no `sass` dependency
  exists, so the `.scss` conversion removes nothing from `package.json`.
- 2026-09-22 **PLAN.md approved by the user.** Decision ticked. Phase 1 not started — it still needs
  the green unit-test gate and the branch switch. No `src/` changes.
- 2026-09-22 **Phase 0 ✅ complete.** Wrote `docs/refactor/PLAN.md` (13 sections) and
  `reports/phase-00.md`. **No `src/` changes** — read-only audit plus one throwaway import-graph
  script in the session scratchpad. Parsed all 708 non-spec `.ts` files: **~150 real boundary
  violations**. Headline findings: (a) the 3418 KB / **839 KB gzip** largest lazy chunk is
  `constant/location-min.ts`, used by one file, and its sibling `location.ts` (25 MB) has zero
  importers; (b) Phase 8 is near-mechanical — zero constructor injection, zero class-based
  guards/interceptors, zero `InjectionToken`/`useClass`/`useFactory`, so **no `@Injectable` needs
  keeping**; (c) admin partner-platform v1 is not removable as a unit — its `shared/` backs v2 and
  6 other admin features; (d) `feature-facade` is imported by `core`/`shared`/`layout`, so it is
  core, not feature code; (e) `pages/` is a second features root. Three spec bullets are already
  satisfied: no committed `.DS_Store`, no `baseUrl` to remove, no `@source`/Storybook globs to
  update. Closed the `ChangeDetectionStrategy.Eager` decision as **not applicable** (all 18 are
  `OnPush`). User settled 3 decisions in-session: merge the trackers, list-only dead code, move
  `Utils` to `shared/`. Filled the Part B tracker with 12 ordered rows.
- 2026-09-22 no-op: user asked for an empty test snapshot via `git`; refused by
  `.claude/hooks/guard-bash.mjs` ("Never commit"). Nothing was recorded, HEAD still `444d638`.
  No `src/` changes this session — the stop gate fired only because pre-existing dirty files
  (`.storybook/`, `app-version.ts`) are newer than this file.
- 2026-09-22 baselines recorded (user ran `verify.mjs --record-baseline`): 7/8 gates green, only unit
  tests red (79). `baseline/ssr.json` + `baseline/bundle.json` written. Storybook gate confirmed green
  inside the harness (22s), validating the `.storybook/` restore. SSR smoke passed against all four
  routes in `smoke-routes.json`. **Caveat found:** the course route's snapshot captured fallback SEO,
  not course SEO — see open question 8. No `src/` changes.
- 2026-09-22 spec-repair prep: wrote `prompts/spec-repair.md` (goal, locked decisions, 8 execution
  phases, acceptance criteria, risks). Traced all 79 failures to 7 root-cause groups; probed
  `section-nav` to prove its 7 failures are a jsdom `getBoundingClientRect()` artifact, not a component
  bug (throwaway probe spec deleted). Flagged `footer-overlay.isAllowedRoute` as a suspected real
  product bug to be logged, not fixed. **No `src/` changes** — awaiting approval to execute.
- 2026-09-22 storybook gate fixed: user approved restore; `git checkout 8271fa4^ -- .storybook`
  (main.ts, preview.ts, manager.ts, tsconfig.json, tsconfig.doc.json, typings.d.ts).
  `pnpm build-storybook` → "Storybook build completed successfully". Gate green. No `src/` changes.
  Noted `src/app/shared/core/version/app-version.ts` is regenerated by every build and dirties the tree.
- 2026-09-22 setup: harness verified complete (`.claude/settings.json`, 5 hooks, 3 agents, 3 skills,
  `scripts/refactor/{verify,ssr-smoke,bundle-report}.mjs`, `docs/refactor/{PROMPT,STATE,smoke-routes}`).
  `docs/refactor/README.md` does not exist in the repo. `chmod +x` applied to `.claude/hooks/*.mjs` and
  `scripts/refactor/*.mjs`. Added `docs/refactor/.cache/` to `.gitignore`. `src/server.ts` reads
  `process.env['PORT']` (default 4000) — OK for ssr-smoke. Filled `smoke-routes.json` with `/`,
  `/us/accounting/partners/cpacanada`, `/us/accounting/masterclass/154/adulting-in-business`,
  `/admin/login`; canonical locale prefix is `us/accounting` (seo.constants), not `us/cpa`, and the
  course id/slug comes from the live production sitemap. Typecheck clean; `verify.mjs --no-ssr` →
  2 red gates (see open questions). No `src/` changes.
