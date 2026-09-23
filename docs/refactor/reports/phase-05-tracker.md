# Phase 5 — session 5: `tracker` merge

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
Fifth session of the sequence in [PHASE-05-REMAINING.md](../PHASE-05-REMAINING.md).

## 1. Summary

`features/caira-tracker/` and `features/cpe-tracker/` are now `features/tracker/{caira,cpe}/`.
**50 files moved; every one is a git rename, history preserved.**

**The last circular dependency in the codebase is gone** — dissolved structurally, not relabelled.
The four symbols both halves shared moved up to their new common parent:

| Promoted file          | From                               | To                    |
| ---------------------- | ---------------------------------- | --------------------- |
| `tracker-links.ts`     | `caira-tracker/shared/utils/`      | `tracker/utils/`      |
| `course.util.ts`       | `cpe-tracker/shared/utils/`        | `tracker/utils/`      |
| `slug.util.ts` (+spec) | `cpe-tracker/shared/utils/`        | `tracker/utils/`      |
| `badge-filter-chips/`  | `caira-tracker/shared/components/` | `tracker/components/` |

Within each half the `shared/` layer dissolved, routed components moved into `pages/`, and the four
services became flat files. Each half keeps its own `*.routes.ts` at its own root, and both URLs stay
separate and unchanged.

Feature `shared/` layers repo-wide: **9 -> 7** (272 -> 230 files). `features/` is now 16 features
plus `features.routes.ts`.

### The cycle, and why the merge actually fixes it

The four edges were:

- `caira/utils/badge-action.ts:2,3` -> cpe's `TRANSACTION_TO_URL` and `toSlug`
- `cpe/pages/cpe-tracker/cpe-tracker.ts:33,34` -> caira's `localeLink` and `BadgeFilterChips`

Section 3's placement rule says code shared by siblings goes to their nearest common parent. Before
the merge these two features had no common parent below `features/`, so there was nowhere legal to
put the four files and the cycle had no structural fix. Creating `features/tracker/` creates that
parent. Both directions are now zero — verified including dynamic `import()`, type-only imports, and
`.spec.ts` / `.stories.ts` files.

**Note what was NOT done:** the four files did not go to `core/` or `shared/`. They are used by two
sub-features of one feature, not by two top-level features, so promoting them out of `features/`
would have been over-promotion.

### The first promotion in this phase with no hidden sibling dependency

Three previous sessions were caught by a promoted file importing a sibling that stayed behind —
`partner-icons.ts`, then `micro-learning-hero-reel-card`, and `laptop`/`floating-assets` would have
been a third had they not been dragged along deliberately.

Here the audit found nothing: `tracker-links.ts` imports `@angular/core` and `@shared/services/utils`;
`course.util.ts` imports one core model; `badge-filter-chips` imports `@shared/utils/cn`; and
`slug.util.ts` **has no imports at all**. The audit still had to run to establish that — the absence
is the finding, not a reason to have skipped it.

## 2. Verification

`verifier` subagent — **8/8 GREEN** on the second run.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 18s  |
| build (local)   | pass   | 30s  |
| build (prod)    | pass   | 50s  |
| storybook build | pass   | 33s  |
| format check    | pass   | 16s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 6s   |

The first run was **7/8**: `format check` on `caira-tracker.routes.ts`, because the longer
`./pages/<name>/<name>` specifiers pushed three `loadComponent` arrows past the print width. **The
same failure mode as the `auth` session's route split** — a route file whose specifiers all grow at
once is reliably the file Prettier rejects. Worth running Prettier on any route file immediately
after a split rather than waiting for the gate.

**Bundle — this was the session's real risk.** Two separately-lazy features now share a parent folder
and four common files, which could have fused their chunks or created a new shared one. Initial is
**12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**. Lazy **271 chunks,
unchanged**; no chunk created, removed, or fused, and the top-ten sizes match baseline one-for-one.

**SSR smoke** — all four routes match baseline. **Neither `/cpe-tracker` nor `/caira-tracker` is in
the smoke set**, so the gate exercised none of this session's work; the chunk-count match is the
strongest signal available, which is why the QA list below matters.

`reviewer` subagent — **PASS, zero violations.** It independently confirmed the cycle is gone in both
directions, that all 50 files are renames rather than delete+add, that every sub-100% file differs
only in import specifiers, that no `changeDetection` changed, and that no `shared/` remains under
`features/tracker/`.

**Recorded-baseline check:** clean after both runs.

## 3. Decisions needed / skipped / suspicious

### The headline number

1. **Cross-feature edges are down to two lines repo-wide.** Both are
   `offerings -> @features/payment`: `masterclass-facade.ts:29` and
   `micro-learning-course-facade.ts:40`, each importing `PaymentFacade`. Independently confirmed by
   the reviewer. These are the ones already decided to survive Part A — promoting `PaymentFacade` to
   `core/` would drag the payment domain into core, and the real fix (a narrow payment API for the
   two offerings callers) is a logic change Part A forbids. They go on Phase 7's temporary-warning
   list.

   For the record, the phase started at 23 such lines. 21 are gone.

### Logged, not fixed (PROMPT.md section 2.7)

2. **`certificate-access-policy.spec.ts:44` contains an `it.skip(...)`.** Pre-existing — the file is
   a 100% pure rename and the skip is in `HEAD`. Flagged because a skipped test is invisible in a
   green gate, and this is the only one in the merged tree.
3. **Three empty `.css` files still wired via `styleUrl`**: `cpe-tracker.css`, `tracker-table.css`,
   `cpe-compliance-dialog.css`. Phase 12, joining the eight from `library` and two from `home`.
4. **`@core/models/cpe-tracker.model.ts` is a different file from the `cpe-tracker` feature** and
   stays in core. Easy to conflate when grepping; recorded so nobody "tidies" it into the feature.
5. Both route files carry a deliberate comment explaining why they have no `providers` — every page
   owns its own `resource()`, and `CpeTrackerFacade` no longer exists. Those comments moved verbatim
   and are still accurate.

## 4. Visual QA list

Part A changes no markup; every `.html` in the tree is a byte-identical rename. The risk is runtime
module resolution, and **the SSR gate covers neither tracker route**.

- **`/{c}/{p}/cpe-tracker`** — the highest-value check. This page consumes _both_ promoted utilities
  (`localeLink` from `tracker/utils/`, `BadgeFilterChips` from `tracker/components/`) plus four
  flattened services. It is the page that would break if the promotion arithmetic were wrong.
- **`/{c}/{p}/caira-tracker`** — renders `badge-row` and `caira-level-hero`, both of which reach up
  to `tracker/utils/tracker-links`. Open a badge to trigger `caira-level-hero`'s **dynamic**
  `import()` of `caira-badge-info-dialog`, whose specifier changed — a broken dynamic import fails
  only at click time, never at build.
- **`/{c}/{p}/caira-tracker` -> course badges and webinar badges** — the two sub-pages that moved into
  `pages/`, each importing the promoted filter chips from three levels up.
- **A certificate download from the CPE tracker** — exercises the three flattened services in
  sequence (`certificate-download` -> `certificate-access-policy` -> `tracker-dialog-orchestrator`),
  whose relative imports all changed depth.

## 5. Commit message

```
refactor(structure): phase 5 merge the two trackers

Merge features/caira-tracker/ and features/cpe-tracker/ into
features/tracker/{caira,cpe}/, dissolving the last circular dependency in the
codebase.

The four symbols both halves shared move up to their new common parent:
- caira-tracker/shared/utils/tracker-links.ts -> tracker/utils/
- cpe-tracker/shared/utils/{course.util,slug.util}.ts(+spec) -> tracker/utils/
- caira-tracker/shared/components/badge-filter-chips/ -> tracker/components/

Before the merge these two features had no common parent below features/, so
there was nowhere legal to put the four files and the cycle had no structural
fix. Creating features/tracker/ creates that parent; neither half now imports
the other in either direction.

Within each half: shared/ dissolved, routed components moved to pages/, the
four services flattened to flat files, and each half keeps its own routes file.

Structure only: no logic, URL, selector or template change. The cpe-tracker and
caira-tracker route segments are byte-identical and remain separate top-level
URLs. Initial bundle unchanged and lazy chunk count still 271 — the two
features did not fuse into one chunk.
```
