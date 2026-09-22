# Phase 4 — Shared & layout

**Status: ✅ complete.** All 8 gates green with the snapshot folder untouched, `reviewer` clean after
two bookkeeping fixes. Five PLAN.md rows were deliberately refused and need your sign-off (§3).

---

## 1. Summary

`src/app/shared/` went from two folders (`components/`, `utils/`) to the six the spec names, the four
page layouts joined `layout/`, and 14 dialogs moved to the features that own them.
**204 files moved, every one recorded by git as a rename**, plus 178 modified for paths only.
**Zero logic changes** — the reviewer did a line-level pass over all 382 touched files and found only
import specifiers, dynamic `import()` paths, Tailwind `@reference` paths and doc comments.

| Step | Move                                                                                       | Files |
| ---- | ------------------------------------------------------------------------------------------ | ----- |
| 1+2  | `shared/components/{ui,dialog}/` → `shared/{ui,dialogs}/`                                  | 176   |
| 3    | 14 dialogs → owning feature/admin/layout `dialogs/`; `admin-rbac.model.ts` → `admin/core/` | ~50   |
| 4    | `core/pipes/*` → `shared/pipes/`; 5 helpers → `core/utils/`                                | 12    |
| 5    | `Utils` + `EngagementDialog` → `shared/services/` (flat files)                             | 3     |
| 6    | `pages/{main,plain,blog,dynamic}-layout/` → `layout/`                                      | 13    |

### The boundary result

This is the phase's real output. Counts are import lines, measured before and after.

| Edge                              | Before | After           | What is left                                                                                  |
| --------------------------------- | ------ | --------------- | --------------------------------------------------------------------------------------------- |
| `core → shared`                   | 25     | **2**           | `notification → @shared/ui/toast`; `update-checker → version-update-dialog` (already dynamic) |
| `core → features\|admin\|layout`  | 2      | **0**           | —                                                                                             |
| `shared → features\|admin\|pages` | 16     | **6** (3 files) | `subscription-dialog` ×2, `utils.ts` ×2, `ai-lab-agent-dialog` ×2 — all deferred, see §3      |

Both remaining `core → shared` edges are the dialog/toast couplings Phase 11 converts to dynamic
imports, and both already fall under the Phase 7 temporary-warning decision you ticked earlier.

### Why steps 1 and 2 ran as one step

59 imports inside `dialog/*` point at `../../ui/...`. Those strings stay byte-for-byte valid only
because both folders lose the same `components/` segment. Moving one folder without the other would
have broken all 59 in the intermediate state, so the two `git mv`s and their rewrites landed together.

### The `import-auditor` changed this phase twice

Worth recording, because in both cases my own grep was confidently wrong.

**Step 1+2.** I found the 291 alias specifiers (224 `ui` + 67 `dialog`) and concluded the rest was
config. The auditor found **37 further relative imports that break** — none contains the literal
`shared/components`, so no path-based grep matches them. They break in _both_ directions: 9 from
`dialogs/` out to non-moving siblings need a **deeper** `../../components/…`, while 14 into
`shared/utils/` need a **shallower** one. `webinar-details-dialog.ts` has a surviving `../../ui/…`
import two lines above three that break, so these had to be fixed per-import, not per-file.

Two traps inside that set:

- `toast.ts:6` used `'../../../../shared/utils/cn'` — an up-and-back-into-`shared/` detour that worked
  only by depth accident. The correct fix is `'../../utils/cn'`, not one fewer `../`.
- `core/services/{utils,engagement-dialog,update-checker}` all import `'../dialog/dialog'`. That is the
  **`Dialog` overlay service** in `core/services/dialog/`, not the folder being moved — excluded as a
  false positive.

**Step 3.** The auditor flagged that moving `cart-drawer-dialog` to payment turns `utils.ts:767` into a
`core → features` edge. That is what surfaced the correction in §3.6 below.

### Reference sweep (§2.10)

| Surface                                                                              | Result                                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `angular.json`, `tsconfig*.json`, `.storybook/*`, `eslint.config.mjs`, `vercel.json` | **no change needed** — verified, none names a path under `shared/`, `layout/` or `pages/*-layout/`               |
| `.storybook/main.ts` story globs                                                     | path-agnostic, no change                                                                                         |
| Tailwind `@source`                                                                   | none exists in the repo                                                                                          |
| Tailwind `@reference` (8 in `src/`)                                                  | 4 corrected 5 `../` → 4; all 8 then resolved against the filesystem — every one lands on `src/styles/styles.css` |
| Route strings (`loadComponent`/`loadChildren`)                                       | **zero** point at anything moved                                                                                 |
| Doc comments                                                                         | `core/models/aria.model.ts:3`, `AGENTS.md:46`                                                                    |

PROMPT.md §5's fourth Phase 4 bullet ("update the Storybook globs and Tailwind `@source` paths") is a
**confirmed no-op**, as PLAN.md §1 predicted and this phase re-verified against the post-Phase-3 tree.

---

## 2. Verification

| Gate            | Result                     | Time |
| --------------- | -------------------------- | ---- |
| lint            | ✅ pass                    | 6s   |
| unit tests      | ✅ pass                    | 15s  |
| build (local)   | ✅ pass                    | 22s  |
| build (prod)    | ✅ pass                    | 24s  |
| storybook build | ✅ pass                    | 19s  |
| format check    | ✅ pass (red first; fixed) | 13s  |
| bundle report   | ✅ pass                    | —    |
| ssr smoke       | ✅ pass, all 4 routes      | 4s   |

**The bundle gate is meaningful this run.** No record flag was passed, and `git status --porcelain` on
the snapshot folder is empty — so unlike Phase 3, the comparison is against the committed figures and
not against the build itself.

| Metric       | Recorded                      | Phase 4                       | Δ        |
| ------------ | ----------------------------- | ----------------------------- | -------- |
| Initial      | 12 files, 501.5 KB / 101.5 gz | 12 files, 501.5 KB / 101.5 gz | **none** |
| Lazy chunks  | 271                           | 271                           | **none** |
| Largest lazy | 3418.2 KB / 839.1 gz          | 3418.2 KB / 839.1 gz          | **none** |

204 renames and 178 modified files with zero bundle drift is the proof this was pure structure. The
largest chunk's _filename_ changed (`chunk-SPORRQN6.js` → `chunk-6HHQGW3L.js`) because content hashes
follow the paths; its size did not.

**Format check went red again, same mechanism as Phase 3 but in the opposite direction.** Two files
(`admin-users.ts`, `firm-form-dialog.ts`) had a `checkbox-list` import _shrink_ below Prettier's
100-char `printWidth` once `@shared/components/ui/` became `@shared/ui/`, so Prettier wanted it
collapsed onto one line. Fixed on those two files only — never `format:fix` across `src/`
(AGENTS.md §8).

**`reviewer`: FAIL → resolved.** Both findings were bookkeeping in `STATE.md`, not code:

1. The five refused PLAN.md rows were written into the session plan but never into STATE.md
   "Decisions" — so `faq-content` read as "in scope, undone, undocumented". Now recorded (§3.4).
2. Steps 5–6 were complete in the tree but still ⬜ in STATE.md.

It also **corrected my boundary count**: `shared → features|pages` is **3 files / 6 import lines**, not 4. I had counted before step 5 moved `utils.ts` into `shared/`. The table in §1 uses the corrected
figure.

---

## 3. Decisions needed

### 3.1 Two dialogs stay shared — they have two feature owners each

PLAN.md sends both to a single feature; §3's placement rule does not allow it.

| Dialog                        | Importers                                           | Verdict        |
| ----------------------------- | --------------------------------------------------- | -------------- |
| `app-download-dialog`         | `features/home` **and** `features/offerings`        | strike the row |
| `certificate-download-dialog` | `features/cpe-tracker`, `features/library`, `Utils` | strike the row |

### 3.2 `subscription-dialog` → payment is net zero, deferred to Phase 11

Its only importers are `Utils` and `EngagementDialog`, which both now live in `shared/services/`.
Moving it would trade 2 outbound `→ features/payment` edges for 2 new **static** inbound
`shared → features` edges. Phase 11 makes those two services' dialog imports dynamic, which unblocks
the move properly.

### 3.3 The three badge/tracker models stay in `core/models/` — closing the Phase 3 row

Phase 3 deferred `{cpe-tracker,caira-badge,badge}.model.ts` to this phase on the theory that their
dialogs were the blocker. **They were not.** `cpe-compliance-dialog` and `caira-badge-info-dialog` did
move out this phase and the models still cannot follow, because the real blockers are shared **cards**
that §3 keeps in `shared/components/`: `cards/badge-{card,course-card,level-card}`,
`cards/badge-hero-card` and `caira-level-stack`. Since `shared → core` is legal and
`shared → features` is not, leaving them in core is the boundary-correct outcome rather than a
compromise. **Recommendation: strike all three rows permanently.**

### 3.4 `faq-content` was NOT promoted — PLAN.md §2 finding 2 is wrong

The finding claims 16 importers "across offerings, blog, home, partners, uae-caira, connect-us and
pages/shared", and that is what justified promoting it to `shared/components/`. The real count is
**5**, all inside `pages/faq` (3) and `pages/shared` (2 — the `legal-doc` / `legal-section`
components). The 12 `features/* → pages/faq` edges PLAN.md §2 counts are imports of the routed
**`pages/faq/faq`** page component, a different file. Both real consumers become Phase 5 features
(`features/faq`, `features/legal`), after which the import may not cross a feature boundary at all.
**Recommendation: strike the row; let Phase 5 decide.**

### 3.5 Deferred, not refused

- The three `ai-lab-*` dialogs — `features/ai-labs/` does not exist until Phase 5. They keep 2
  `shared → pages/ai-labs` edges meanwhile.
- `apply-partner-code-dialog`, `block-status-dialog` — two admin owners each; Phase 6 owns the admin
  shape. Verified they carry no boundary-violating imports today.

### 3.6 Correction: Phase 4 does **not** close the last `core → features` edge

Phase 3's report and STATE.md both say moving `utils.ts` to `shared/services/` closes it. It does not —
it **relabels** it `shared → features`, which §3 bans just as firmly. `utils.ts` still imports
`PaymentFacade` statically (line 48) and `cart-drawer-dialog` dynamically (line 767).

Moving `cart-drawer-dialog` to payment was still right (it cleared 2 of that dialog's own outbound
payment edges, net −1), but the edge on `utils.ts` survives Part A and belongs to **Phase 11**.
Note that promoting `PaymentFacade` into `core/` the way `FeatureFacade` was promoted in Phase 3 is
**not** the fix — it would drag the payment domain into core. **Please confirm you are content for
this edge to survive Part A.**

### 3.7 Skipped / noted

- **`shared/services/` is not in §3's shared list.** Created on your approval this session, honouring
  the recorded `Utils` decision. Phase 14 should add it to the documented shape.
- **`core/utils/` is not in §3's core list either** — but §4.5 names `core/utils/prefetch-triggers.ts`
  itself, so the folder is spec-sanctioned in practice. Same Phase 14 note applies.
- **`shared/pipes/` and `shared/ui/` keep folder-per-item**, matching the existing convention. §3 says
  only _services and models_ are flat files, which steps 3 and 5 honoured.
- **Three dead dialogs confirmed, none deleted** (standing "list only" decision):
  `badge-info-dialog`, `badge-claim-upsell-dialog` (zero importers, moved into `shared/dialogs/`), and
  `webinar-registration-dialog` (zero importers, but moved to `features/offerings/dialogs/` anyway
  because it _imports_ an offerings component, so the move cleared a real edge).
- **`core/models/admin/` no longer exists** — `admin-rbac.model.ts` moved to `admin/core/` with
  `edit-admin-roles-dialog`, closing the Phase 3 note that the folder held exactly one file.
- **`AGENTS.md:46` corrected** (`shared/components/ui` → `shared/ui`). The two other stale AGENTS.md
  statements logged in Phase 0 (port 4101, the bundle-budget sentence) are still open for Phase 14.
- **Build-generated churn recurred, fourth phase running** (open question 6). To get a clean commit:
  ```
  git checkout -- public/version.json src/app/core/version/app-version.ts
  ```
  The harness blocks me from that command form.

### 3.8 Bugs found — none

No new product bugs surfaced this phase.

---

## 4. Visual QA

None. Part A is structure only — no template, style, selector or `changeDetection` change is in this
diff, and the reviewer verified that line by line.

---

## 5. Commit message

```
refactor(structure): phase 4 shared and layout

Split shared/components/ into the target shape: ui/ and dialog/ become
shared/ui/ and shared/dialogs/, core/pipes/ becomes shared/pipes/, and
shared/services/ is created for the two dialog-launching services.

Push 14 dialogs down to their owners (offerings 4, payment 4, cpe-tracker,
caira-tracker, layout, admin 3) and move admin-rbac.model.ts to admin/core/
with edit-admin-roles-dialog, which empties core/models/admin/.

Move Utils (853 lines, 63 importers) and EngagementDialog to
shared/services/ as flat files, and move five pure helpers the other way
into core/utils/. Together these take core -> shared from 25 edges to 2
and core -> features|admin|layout to 0.

Move the four page layouts into layout/. No lazy route string referenced
them; all four were eager component imports, so only three import sites
changed.

204 file moves, all recorded as renames, plus 178 files modified for import
paths only. No logic, template, selector or changeDetection changes. Bundle
output identical to the recorded figures: initial 501.5 KB raw / 101.5 KB
gzip, 271 lazy chunks, largest lazy 3418.2 KB.

Five of PLAN.md's phase 4 rows are deliberately not done — they would
create boundary violations rather than clear them, and PLAN.md's importer
count for faq-content is wrong (5, not 16). See
docs/refactor/reports/phase-04.md section 3.
```
