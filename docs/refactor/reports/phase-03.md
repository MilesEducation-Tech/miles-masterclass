# Phase 3 — Core

**Status: ⏸ blocked on one user action.** All code work is done and every gate is green, but the
`verifier` run re-recorded the two baseline files in `docs/refactor/baseline/`, which PROMPT.md §2.3
forbids. The `reviewer` returned FAIL with that as its sole blocker. The fix is a one-line revert that
only the user can run (§3 below).

---

## 1. Summary

`src/app/shared/core/` is now `src/app/core/`, `constant/` is `constants/`, and 17 files that were
sitting in core but belonged elsewhere have been pushed out. **132 files moved, every one recorded by
git as a rename**, so history is intact. **Zero logic changes** — the reviewer inspected every
non-100%-similarity rename line by line and found only import-specifier edits.

| Move                                                                                  | Files   |
| ------------------------------------------------------------------------------------- | ------- |
| `shared/core/` (whole folder, `constant/` → `constants/`)                             | 126     |
| `features/shared/services/{feature-facade,section-filters-facade}` → `core/services/` | 4       |
| `shared/utils/seo/seo-csv.ts` + spec → `admin/seo/utils/`                             | 2       |
| **Total distinct files moved**                                                        | **132** |

Of the 126 that left `shared/core/`, **111 stay in `core/`** and **15 continue out to their owners** in
the same `git mv`: 5 → `admin/core/` (`admin-auth.model.ts`, `audit-log.model.ts`, `admin-auth.ts`,
`audit-log.ts`, `admin-token-interceptor.ts`) and 10 → features (3 payment, 5 offerings, 2 cpe-tracker).
Each is a single rename from its original `shared/core` path, which is why the total is 132, not 147.

Alongside the moves: **101 files modified for import paths only**, plus 7 config/script files.

### The alias flip

Phase 2 pointed `@core/*` at the old `shared/core` location precisely so this phase would be a
one-line retarget instead of 719 import rewrites. That paid off — but it had to be flipped in **both**
`tsconfig.json` and `.storybook/tsconfig.json`, because Storybook does not inherit root `paths`
(Phase 2's finding).

### Reference sweep (PROMPT.md §2.10)

Every hardcoded `src/app/shared/core/...` path was repointed:

| File                                        | What                                                      |
| ------------------------------------------- | --------------------------------------------------------- |
| `tsconfig.json`, `.storybook/tsconfig.json` | the `@core/*` target                                      |
| `tsconfig.spec.json`                        | explicit `include` of `constant/icon.ts`                  |
| `eslint.config.mjs`                         | 2 `ignores` entries (`location.ts`, `location-min.ts`)    |
| `angular.json`                              | 2 `fileReplacements` for `dev-interceptors.ts`            |
| `scripts/generate-version.mjs:42`           | the path it **writes** `app-version.ts` to                |
| `src/{legacy-redirects,seo,server}.ts`      | 3 relative imports Phase 2 had left deliberately relative |

Plus 35 `@core/constant/` specifiers across 33 files and 7 intra-core relatives → `constants/`.
A repo-wide grep for `shared/core` or `@core/constant/` now returns nothing.

### The headline structural result

**`core/` has exactly one outbound boundary violation left:**
`core/services/utils/utils.ts:48` imports `@features/payment/.../payment-facade`. PLAN.md §2 finding 3
already assigns that file to `shared/services/utils.ts` in **Phase 4**, so Phase 4 closes it.
Every other `core → features|admin|layout` edge is gone, including one the moves actively fixed:
`payment.guard.ts` was importing `@features/payment/...` from inside `core/`.

The pre-existing `core → shared` edges (11 files) predate this phase verbatim — the reviewer confirmed
against `git show HEAD:` — and are Phase 7 debt, not something this diff introduced.

---

## 2. Verification

| Gate            | Result                     | Time |
| --------------- | -------------------------- | ---- |
| lint            | ✅ pass                    | 6s   |
| unit tests      | ✅ pass                    | 36s  |
| build (local)   | ✅ pass                    | 52s  |
| build (prod)    | ✅ pass                    | 61s  |
| storybook build | ✅ pass                    | 22s  |
| format check    | ✅ pass (red first; fixed) | 13s  |
| bundle report   | ✅ pass                    | —    |
| ssr smoke       | ✅ pass, all 4 routes      | 3s   |

**The one red gate was self-inflicted and mechanical.** The alias rewrites changed import-specifier
lengths, so Prettier's 100-char `printWidth` wanted 5 import statements reflowed — one had grown past
100 chars (`assessment.model.ts`), one had shrunk below it (`footer-overlay.ts`). Fixed by running
Prettier on **only those 5 files**, not `pnpm format:fix` across `src/`, so no untouched file was
reformatted (AGENTS.md §8). `pnpm format` now reports "All matched files use Prettier code style!"

### ⚠️ Correction: the bundle gate's "+0.0% vs baseline" this run is vacuous

The verifier re-recorded the baseline **before** comparing, so the bundle gate compared the build
against itself. That number proves nothing and should be disregarded.

The meaningful parity check, done by hand against Phase 2's recorded figures:

| Metric       | Phase 2 (recorded)            | Phase 3 (this run)            | Δ        |
| ------------ | ----------------------------- | ----------------------------- | -------- |
| Initial      | 12 files, 501.5 KB / 101.5 gz | 12 files, 501.5 KB / 101.5 gz | **none** |
| Lazy chunks  | 271, 10,254.9 KB              | 271, 10,254.9 KB              | **none** |
| Largest lazy | 3418.2 KB / 839.1 gz          | 3418.2 KB / 839.1 gz          | **none** |

Identical. 132 file moves produced a byte-comparable bundle, which is the real proof this was a pure
structural change. But the **gate** needs re-running against the restored baseline to say so on its own
authority.

---

## 3. Decisions needed

### 3.1 BLOCKER — restore the two baseline files (user action, I am blocked from it)

The `verifier` run passed `--record-baseline`, overwriting both files. That violates PROMPT.md §2.3
("Never re-record baselines") and CLAUDE.md ("Never edit `docs/refactor/baseline/`). This was my
delegation error — I asked for a full-gate run and did not explicitly forbid the record flag.

```bash
git checkout HEAD -- docs/refactor/baseline/
```

What was lost, for context on whether you want to re-record deliberately afterwards:

| Field       | Original (untouched code) | Overwritten with |
| ----------- | ------------------------- | ---------------- |
| initial raw | 501.9 KB                  | 501.5 KB         |
| initial gz  | 101.6 KB                  | 101.5 KB         |
| lazy chunks | **274**                   | **271**          |

`ssr.json`'s content is unchanged — only its trailing newline was stripped.

**Worth knowing:** the original baseline predates Phase 1, which _deliberately_ removed the partner
mock from the production bundle (274 → 271 chunks, −21 KB). So the baseline has been legitimately
stale-by-design since Phase 1, and every phase since has compared against pre-hygiene numbers. Whether
to re-record on purpose is your call — but it should be a deliberate act, not a side effect of a
verification run. After restoring, phase-end verification should be re-run **without**
`--record-baseline`.

### 3.2 PLAN.md §3's Phase 3 push-down table is partly wrong — 6 rows refused

The `import-auditor` sweep (35 candidate files, 128 references) found that most of the table would
**create** boundary violations rather than clear them. I executed the safe rows and stopped on these.
Full text is in STATE.md "New decisions raised by Phase 3"; in brief:

| Row                                                  | Why refused                                                                                                                 | Recommendation             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `seo.models.ts`, `supabase-seo.ts` → `admin/seo/`    | `core/services/seo/seo-manager.ts` + `shared/utils/seo/course-seo-{config,setup}.ts` use them on **every page**             | **strike the rows** — core |
| `form.model.ts` → `features/offerings/`              | generic `SelectOption`/`AutoCompleteOption`; used by core + 3 shared components                                             | **strike the row** — core  |
| `video-player.model.ts`, `constants/video-player.ts` | `shared/components/{video-js,audio-js}` import **and re-export** `VideoState`/`PlayerMode`; PROMPT §3 keeps video-js shared | **strike the rows** — core |
| `{cpe-tracker,caira-badge,badge}.model.ts`           | 6 shared cards/dialogs import them; PLAN §3 **Phase 4** already moves those dialogs                                         | **move in Phase 4/5**      |
| `admin-rbac.model.ts` → `admin/core/`                | `shared/.../edit-admin-roles-dialog` imports it; PLAN §3:216 assigns that dialog to Phase 4                                 | **move in Phase 4**        |

### 3.3 One move PLAN.md does not list was mandatory

`core/interceptors/admin-token/` → `admin/core/interceptors/`. That interceptor imports `AdminAuth`,
`AuditLog` and `AuditCategory` directly, so moving those three to `admin/core/` without it would have
inverted the layering to `core → admin`. PROMPT.md §3 lists interceptors under `admin/core/`, so this
is the spec-correct home — **but it is still registered globally in `app.config.ts`**, which now
imports from `@admin/`. The reviewer accepted this (the composition root sits outside the four
top-level folders). **Please confirm you are happy with that.**

### 3.4 faq / legal / milesverse / faculty / auth deferred to Phase 5 (12 files)

Every consumer still lives in `src/app/pages/**` or `src/app/auth/`, and none of the destination feature
folders exist. Doing them now would create five near-empty folders and split each feature across two
phases. The reviewer explicitly agreed ("No objection"). Recommendation: **accept.**

### 3.5 Skipped / noted, not fixed

- **`feedback-model.ts` does not follow the `<name>.model.ts` convention.** Moved under its existing
  name; renaming belongs to Phase 5's feature-internal normalization.
- **`core/models/admin/` now holds exactly one file** (`admin-rbac.model.ts`), pending 3.2.
- **`core/directives/html-to-pdf.directive.ts` confirmed dead** — 0 importers (the _service_ is used,
  via lazy dynamic import in `invoice.ts` and `partner-report-preview-dialog.ts`; the directive is
  not). Per the standing "list only, do not delete" decision it was moved with core, not removed.
- **`core/services/` keeps folder-per-service** (`api-client/api-client.ts`). PROMPT §3 says services
  are flat files, but neither PROMPT §5 Phase 3 nor PLAN.md asks for flattening, and doing 30 service
  folders would be a large unrequested diff. **New `admin/core/` was created flat**, matching both the
  target and admin's existing convention. Flag: if you want `core/services/` flattened, it needs its
  own decision and probably its own step.
- **Build-generated churn recurred** (open question 6, third phase running): `public/version.json` and
  `src/app/core/version/app-version.ts` are rewritten by every `pre*` script. Note the path **moved**
  this phase, so Phase 2's cleanup command is stale. Current one:
  `git checkout -- public/version.json src/app/core/version/app-version.ts`
- **PLAN.md path error:** §3 lists `utils/seo/seo-csv.ts` under "From `shared/core/...`"; it actually
  lived at `src/app/shared/utils/seo/seo-csv.ts`. Destination unchanged.
- **Harness note:** the Bash guard rejects any command whose text contains the verify script's path, so
  per-step `--quick` was unavailable to me. Each step was gated on its two underlying checks
  (typecheck against `tsconfig.app.json` **and** `tsconfig.spec.json`, plus lint) run directly.

### 3.6 Bugs found — none

No new bugs surfaced this phase.

---

## 4. Visual QA

None. Part A is structure only; no template, style, selector or `changeDetection` change is in this
diff (the reviewer verified: `grep changeDetection` hits only prose in STATE.md).

---

## 5. Commit message

```
refactor(structure): phase 3 core

Move src/app/shared/core/ to src/app/core/ and rename constant/ to
constants/. Retarget @core/* in tsconfig.json and .storybook/tsconfig.json
(Storybook does not inherit root paths), and repoint every hardcoded path:
tsconfig.spec.json, eslint.config.mjs, angular.json fileReplacements,
scripts/generate-version.mjs, and three relative imports in src/.

Merge feature-facade and section-filters-facade into core/services/ —
both were already @core-only in their own imports, clearing PLAN.md's
worst 15-importer boundary violation as a pure move.

Push 17 files out of core to their owners: admin-auth, audit-log and the
admin-token interceptor to a new admin/core/; seo-csv to admin/seo/utils/;
payment constants and guard, offerings models and app-download-prompt, and
cpe-credit.model to their features. Moving payment.guard.ts also fixes a
live core -> features import.

132 file moves, all recorded as renames. No logic, template, selector or
changeDetection changes. Bundle output identical to phase 2: initial
501.5 KB raw / 101.5 KB gzip, 271 lazy chunks.

Six of PLAN.md's phase 3 push-down rows are deliberately not done — they
would create boundary violations rather than clear them. See
docs/refactor/reports/phase-03.md section 3.
```
