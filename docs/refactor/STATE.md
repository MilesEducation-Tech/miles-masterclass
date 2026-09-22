# Refactor state

Cross-session handoff. Claude updates "Now", the trackers, open questions and the step log.
The user owns the "Decisions" section.

Status legend: ⬜ not started · 🟡 in progress · ✅ done (verified, reported) · ⛔ blocked · ⏸ awaiting decision

## Now

- Phase: **3 — Core ⏸ code complete, blocked on ONE user action.**
  Report: [phase-03](reports/phase-03.md). `verifier` **8/8 green** after one self-inflicted format fix.
  `reviewer` **FAIL — sole blocker: the two files in `docs/refactor/baseline/` were re-recorded.**
- 🚨 **Do this first, before anything else:**
  ```
  git checkout HEAD -- docs/refactor/baseline/
  ```
  The `verifier` run passed `--record-baseline`, overwriting `bundle.json` (274 → 271 lazy chunks,
  501.9 → 501.5 KB) and stripping `ssr.json`'s trailing newline. PROMPT.md §2.3 forbids re-recording
  and CLAUDE.md forbids Claude touching that folder, so the revert is yours. **My delegation error** —
  I asked the subagent for a full-gate run without explicitly forbidding the record flag.
  **Consequence: the bundle gate's reported "+0.0% vs baseline" this run is vacuous** — it compared the
  build against a baseline recorded from that same build. The valid parity check is by hand against
  Phase 2's figures: initial 501.5 KB raw / 101.5 KB gzip, 271 lazy chunks, largest lazy
  3418.2 KB — **all three identical to Phase 2.** Re-run the verifier (no record flag) after reverting
  to get the gate to say so on its own authority.
- Related, for your judgement: the **original** baseline predates Phase 1, which deliberately removed
  the partner mock (274 → 271 chunks, −21 KB). So it has been stale-by-design since Phase 1 and every
  phase has compared against pre-hygiene numbers. Re-recording may well be right — but as a deliberate
  act, not a verification side effect.
- Once the baseline is restored and the verifier re-run is green, Phase 3 is ✅. Commit message is in
  [phase-03](reports/phase-03.md) §5. Then **`/refactor-phase 4`** (shared & layout).
- **Phase 4 inherits three things from this phase:** (a) `core/services/utils/utils.ts:48` is the last
  `core → features` edge and Phase 4's move of that file to `shared/services/utils.ts` closes it;
  (b) the 6 refused push-down rows below, several of which unblock once Phase 4 moves the shared
  dialogs/cards that hold them in core; (c) Phase 2's finding that six component `.css` files use
  `@reference '../../../../styles/styles.css'`, which TS aliases do not cover.
- Branch `refactor/structure-3`, clean at session start. Baselines present. No unticked decision gates
  this phase.
- **Step plan** (mark each done here as it lands):
  1. ✅ **Bulk move** `src/app/shared/core/` → `src/app/core/`, `constant/` → `constants/`.
     Flip `@core/*` in **both** `tsconfig.json` and `.storybook/tsconfig.json`. Repoint the five
     hardcoded-path consumers (`tsconfig.spec.json`, `eslint.config.mjs` ×2 ignores, `angular.json`
     `fileReplacements` ×2, `scripts/generate-version.mjs`) and the three `src/*.ts` relatives
     (`legacy-redirects.ts`, `seo.ts`, `server.ts`). Rewrite 35 `@core/constant/` specifiers and
     7 intra-core `../constant/` relatives to `constants/`.
  2. ✅ **Merge facades**: `features/shared/services/{feature-facade,section-filters-facade}` →
     `core/services/` (PLAN.md §2 finding 1).
  3. ✅ **Push down to admin** — scope cut by the audit. Moved: `models/admin/{admin-auth,audit-log}.model.ts`
     - `services/{admin-auth,audit-log}` + **`interceptors/admin-token`** → `admin/core/`;
       `shared/utils/seo/seo-csv.ts` → `admin/seo/utils/`. **Not moved:** `admin-rbac.model.ts`,
       `seo.models.ts`, `supabase-seo.ts` (see Decisions).
  4. ✅ **Push down to existing features** — payment (3), offerings (5), cpe-tracker (2).
     **Not moved:** `form.model.ts`, `video-player.model.ts`, `constants/video-player.ts`,
     `cpe-tracker.model.ts`, `caira-badge.model.ts`, `badge.model.ts` (see Decisions).
  5. ✅ **Push down to Phase-5 features — DEFERRED in full to Phase 5, deliberately.**
     faq, legal, milesverse, faculty, auth: every consumer of these 12 files still lives in
     `src/app/pages/**` or `src/app/auth/`, and the destination feature folders do not exist.
     Phase 5 creates each folder and moves its pages; the constants/models/services travel in the
     same per-feature session instead of being split across two phases.
- **Deviation from the ~30-file step guidance, deliberate:** step 1 moves 126 files in one `git mv`.
  The folder must move atomically — `@core/*` is a single alias line, so splitting it would require a
  broken intermediate state with two overlapping core roots. The actual risk surface is ~15 config and
  import lines, not 126 files, and every one is enumerated above.
- **Phase 2 verified facts this phase leans on:** zero relative imports escape `shared/core/`
  (all aliased), and `grep '@shared/core' src` returns 0 — so the bulk move breaks nothing that the
  alias flip does not fix.
- **PLAN.md path correction:** §3 lists `utils/seo/seo-csv.ts` under "From `shared/core/...`".
  It actually lives at `src/app/shared/utils/seo/seo-csv.ts`. Destination (`admin/seo/`) unchanged.
- **Status: steps 1–5 done. `verifier` 8/8 green after one fix.**
  First verifier run was **7/8 — format check RED on 5 files.** Cause was mechanical and entirely
  self-inflicted: the alias rewrites changed import-specifier lengths, so Prettier's 100-char
  `printWidth` wanted those import statements reflowed — one had grown past 100 chars
  (`assessment.model.ts`), one had shrunk below it (`footer-overlay.ts`), and three others likewise.
  Fixed by running Prettier on **only those 5 files**, not `pnpm format:fix` across `src/`, so no
  untouched file was reformatted (AGENTS.md §8). `pnpm format` now reports
  "All matched files use Prettier code style!", with typecheck + lint still green.
  **Bundle parity holds — but check it against Phase 2, not against the gate's own number:**
  initial 12 files, 501.5 KB raw / 101.5 KB gzip, 271 lazy chunks, largest lazy 3418.2 KB —
  all identical to Phase 2's recorded figures. The gate's own "+0.0% vs baseline" is **vacuous this
  run** because the baseline was re-recorded first (see the blocker at the top). SSR smoke passed all
  four routes.
- ⚠️ **Build-generated churn recurred, third phase running (open question 6, still open).** The
  verifier's builds rewrote `public/version.json` and — now at its new path —
  `src/app/core/version/app-version.ts`. They are the only source files newer than this file, and
  neither is a Phase 3 edit. To get a clean Phase 3 commit:
  `git checkout -- public/version.json src/app/core/version/app-version.ts`
  (Claude is blocked from that form by the harness guard.) Note the path moved this phase, so the
  Phase 2 version of this command is now stale.
- **Result so far: `core/` has exactly ONE outbound boundary violation left** —
  `core/services/utils/utils.ts:48` imports `@features/payment/.../payment-facade`. PLAN.md §2
  finding 3 already assigns that file to `shared/services/utils.ts` in **Phase 4**, so Phase 4 closes
  it. Every other `core → features|admin|layout` edge is gone.

## Part A tracker

| Phase | Scope           | Status | Report                          | Committed |
| ----- | --------------- | ------ | ------------------------------- | --------- |
| 0     | Audit & plan    | ✅     | [phase-00](reports/phase-00.md) |           |
| 1     | Hygiene         | ✅     | [phase-01](reports/phase-01.md) |           |
| 2     | Path aliases    | ✅     | [phase-02](reports/phase-02.md) |           |
| 3     | Core            | ⏸      | [phase-03](reports/phase-03.md) |           |
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

New decisions raised by Phase 3 — **PLAN.md §3's Phase 3 push-down table is partly wrong.**
The `import-auditor` sweep (35 files, 128 references) found that 6 of its rows would create a new
boundary violation instead of clearing one. I executed the rows that are safe and stopped on these.
Each needs your call before the phase that owns it:

- [ ] **`models/seo.models.ts` + `services/seo/supabase-seo.ts` must NOT go to `admin/seo/`.**
      PLAN.md sends them there, but `core/services/seo/seo-manager.ts` imports both, and
      `shared/utils/seo/course-seo-{config,setup}.ts` import `SeoConfig`. That is the SEO render path
      for **every page on the site**, not an admin path — the move would force `core → admin` and
      `shared → admin`. Recommendation: **strike these two rows from the plan**; they are core.
- [ ] **`models/form.model.ts` is not an offerings model.** PLAN.md sends it to `features/offerings/`,
      but it holds the generic `SelectOption` / `AutoCompleteOption` types used by
      `core/services/job-sectors`, `shared/components/ui/autocomplete`, `shared/components/enquiry-form`
      and `shared/components/dialog/firm-sponsorship-dialog`. Recommendation: **strike the row**; it is core.
- [ ] **`models/video-player.model.ts` + `constants/video-player.ts` cannot go to `features/offerings/`.**
      `shared/components/{video-js,audio-js}` both import **and re-export** `VideoState`/`PlayerMode`,
      so every consumer of those players would transitively depend on `features/offerings`. PROMPT.md §3
      explicitly lists `video-js` under `shared/components/`. Recommendation: **strike the rows**; they are core.
- [ ] **`models/{cpe-tracker,caira-badge,badge}.model.ts` are blocked by shared UI, not by core.**
      Six `shared/components` cards/dialogs (`badge-hero-card`, `badge-info-dialog`,
      `badge-claim-upsell-dialog`, `cpe-compliance-dialog`, `caira-level-stack`,
      `caira-badge-info-dialog`) and three `shared/components/cards/badge-*` import them directly.
      PLAN.md §3 **Phase 4** already moves feature-specific dialogs to their owners. Recommendation:
      **move these three models in Phase 4/5, after their dialogs move** — not in Phase 3.
- [ ] **`models/admin/admin-rbac.model.ts` is blocked the same way**, by
      `shared/components/dialog/edit-admin-roles-dialog`. PLAN.md §3 Phase 4 (line 216) already assigns
      that dialog to `admin/`. Recommendation: **move the model in Phase 4 with its dialog.**
      Consequence today: `core/models/admin/` holds exactly one file.
- [ ] **Phase 3 added a move PLAN.md does not list: `core/interceptors/admin-token/` → `admin/core/interceptors/`.**
      It was mandatory — that interceptor imports `AdminAuth`, `AuditLog` and `AuditCategory` directly,
      so moving those three to `admin/core/` without it would have inverted the layering to `core → admin`.
      PROMPT.md §3 lists interceptors under `admin/core/`, so this is the spec-correct home, but note it is
      still registered globally in `app.config.ts` (`withInterceptors`), which now imports from `@admin/`.
      **Confirm you are happy with the composition root reaching into `admin/`.**
- [ ] **Phase 3 deferred PLAN.md's faq / legal / milesverse / faculty / auth push-downs (12 files) to Phase 5.**
      Every consumer still lives in `src/app/pages/**` or `src/app/auth/`, and none of the destination
      feature folders exist yet. Doing them now would create five near-empty feature folders and split each
      feature across two phases. Recommendation: **accept** — Phase 5 moves each feature's pages and its
      constants/models/services in one session.

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

- 2026-09-22 **Phase 3 steps 3–4 ✅ — 17 files pushed out of core; 6 PLAN.md push-downs refused.**
  The `import-auditor` sweep over all 35 candidate files (128 referencing file:line entries) is what
  drove this: **most of PLAN.md §3's Phase 3 push-down table would have created new boundary
  violations rather than cleared them.** Moved to `admin/core/` (flat files, matching admin's existing
  convention): `admin-auth.model.ts`, `audit-log.model.ts`, `admin-auth.ts`, `audit-log.ts` — **plus
  `interceptors/admin-token-interceptor.ts`, which PLAN.md does not list.** That interceptor is the
  single root cause tying all three admin files to `core/`: it imports `AdminAuth`, `AuditLog` and
  `AuditCategory` directly, so moving them without it would have inverted the layering into
  `core → admin`. PROMPT.md §3 puts admin interceptors in `admin/core/` anyway, so it moved too;
  `app.config.ts` now wires it from `@admin/core/interceptors/…`. Also moved `seo-csv.ts` + spec →
  `admin/seo/utils/` (admin-only, clean). Then payment (`constants/payment.ts`,
  `constants/location-min.ts` + its `eslint.config.mjs` ignore, `guards/payment.guard.ts` — that guard
  already imported `@features/payment/…`, so the move **fixes** a live `core → features` violation),
  offerings (`assessment.model.ts`, `feedback-model.ts`, `micro-learning-course.model.ts`,
  `app-download-prompt.ts` + spec) and `cpe-credit.model.ts` + spec → `features/cpe-tracker/models/`
  (**not** PLAN.md's `features/tracker/`, which Phase 5 creates by merging the two trackers — moving
  into a folder that does not exist yet would have made every importer a cross-feature import).
  Typecheck ×2 + lint green after each step.
- 2026-09-22 **Phase 3 step 2 ✅ — the two shared facades merged into `core/services/`.**
  `git mv` of `features/shared/services/{feature-facade,section-filters-facade}` →
  `core/services/` (4 files, renames), 16 alias specifiers rewritten
  `@features/shared/services/...` → `@core/services/...`. Both facades were already
  **`@core/*`-only in their own imports** — zero feature dependencies — so this is a pure move that
  clears PLAN.md §2 finding 1's 15-importer violation with no logic change. `features/shared/` now
  holds only `services/tracks/`, which stays for Phase 5 (its 2 importers are `features/features.ts`
  and a `cpa-landing` component, both inside `features/`). Typecheck ×2 + lint green.
- 2026-09-22 **Phase 3 step 1 ✅ — core moved, aliases flipped, typecheck + lint green.**
  `git mv src/app/shared/core src/app/core` (126 files, all recorded as renames) and
  `git mv core/constant core/constants`. `@core/*` retargeted in `tsconfig.json` **and**
  `.storybook/tsconfig.json`. Five hardcoded-path consumers repointed (`tsconfig.spec.json` icon
  include, `eslint.config.mjs` ×2 `location*.ts` ignores, `angular.json` ×2 `fileReplacements`,
  `scripts/generate-version.mjs:42` write target) plus the three `src/*.ts` relatives
  (`legacy-redirects.ts`, `seo.ts`, `server.ts`) and one comment path in
  `testing/partner-mock/dev-interceptors.ts`. 35 `@core/constant/` specifiers across 33 files and
  7 intra-core `../constant/` relatives rewritten to `constants/`. A repo-wide grep for the old
  path over `src`, `.storybook`, `scripts`, `angular.json`, `tsconfig*.json` and `eslint.config.mjs`
  returns **NONE**. Gates: `tsc -p tsconfig.app.json` clean, `tsc -p tsconfig.spec.json` clean,
  `pnpm lint` "All files pass linting".
  **⚠️ Note for the user:** the harness Bash guard rejects every command whose text contains the
  verify script's path, so Claude cannot run the per-step `--quick` wrapper at all. Each step was
  gated by running its two underlying checks (typecheck + lint) directly instead. End-of-phase
  verification still goes through the `verifier` subagent, which is unaffected.

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
