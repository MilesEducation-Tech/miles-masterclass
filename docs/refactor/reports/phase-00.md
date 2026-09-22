# Phase 0 — Audit & plan

Date: 2026-09-22 · Branch: `master` · Source changes: **none**

## 1. Summary

Wrote `docs/refactor/PLAN.md` (13 sections) and updated `docs/refactor/STATE.md`. No file under
`src/` was read-modified; the audit was read-only plus one throwaway analysis script in the session
scratchpad.

What was inventoried (all measured, not estimated):

| Inventory        | Result                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Config baseline  | tsconfig ×4, angular.json, eslint.config.mjs, `.storybook/`, hydration providers, vercel/husky/postcss |
| Import graph     | 708 non-spec `.ts` files parsed; **~150 real boundary violations** across 13 categories                |
| Move map         | old → new for all 7 Part A phases, incl. 33 dialogs and the `pages/` dissolution                       |
| Services         | 55 decorated services + 3 interceptors + 13 guards/resolvers                                           |
| HTTP             | ~95 reads, ~60 mutations, 7 downloads, ~10 searches, 42 Supabase calls, 3 backends                     |
| Headless UI      | 16 `shared/ui` components, 20 ng-primitives consumers, 2 CDK usages                                    |
| @defer           | 34 live blocks in 11 templates; 15 heavy-library import sites                                          |
| Tailwind         | 213 component stylesheets classified; `@theme` tokens; 13 NgClass/NgStyle                              |
| Change detection | 18 explicit strategies                                                                                 |
| Partner landings | 12 pages diffed pairwise                                                                               |
| Postman          | 25 env key names (4 secret, all empty)                                                                 |

### Findings that change the shape of the remaining work

1. **Several spec phases are already done or near-no-ops.** Zero constructor injection, zero
   class-based guards/interceptors, and zero `InjectionToken`/`useClass`/`useValue`/`useFactory` means
   Phase 8 reduces to a mechanical `@Injectable` → `@Service()` rename with **no kept exceptions**.
   Phase 1's `.DS_Store` bullet is a no-op (none committed). Phase 2 has no `baseUrl` to remove.
   `@angular/aria` and direct `@floating-ui/dom` usage are both already zero.
2. **The biggest bundle problem is committed data, not a library.** The largest lazy chunk —
   3418 KB raw / **839 KB gzip**, 33% of all lazy JS — is `shared/core/constant/location-min.ts`,
   loaded by exactly one file (`features/payment/.../billing.ts`) for a country dropdown. Its sibling
   `location.ts` (969,250 lines / 25 MB) has **zero importers**.
3. **`admin/partner-platform` v1 is not removable as a unit.** Its routed pages are dead (routes
   commented out), but its `shared/` folder is the live models/services layer for partner-platform-v2
   _and_ 6 other admin features (39 + 17 edges), and v2 imports three dialogs out of v1's dead pages.
   Phase 6 must extract before it deletes.
4. **`features/shared/services/feature-facade` cannot live under `features/`** — it is imported
   upward by `core/`, `shared/` and `layout/`. It is a core singleton, as AGENTS.md §3 already says.
5. **`pages/` is a second features root** — `features/features.ts` loads 11 things out of it, and
   `pages/faq/faq.ts` is imported by 6 different features.

## 2. Verification

Phase 0 changes no source, so the gates are unchanged from the recorded baseline.

| Gate                                            | Result                                                         |
| ----------------------------------------------- | -------------------------------------------------------------- |
| typecheck (`tsc -p tsconfig.app.json --noEmit`) | ✅ clean, no TS 6 deprecations                                 |
| lint                                            | ✅ (baseline)                                                  |
| unit tests                                      | ❌ 79 / 424 — **pre-existing**, see STATE.md open question 3   |
| build local                                     | ✅ (baseline)                                                  |
| build prod                                      | ✅ (baseline)                                                  |
| storybook                                       | ✅ (baseline)                                                  |
| format                                          | ✅ (baseline)                                                  |
| bundle report                                   | ✅ initial 501.9 KB raw / 101.6 KB gzip                        |
| ssr smoke                                       | ✅ (baseline, with the course-route caveat in open question 8) |

No gate moved. The red unit-test gate is untouched pre-existing debt and does not block Phase 0, but
**Phase 1 is the first phase requiring a green `verifier` run**, so it must be resolved first.

## 3. Decisions needed / taken / skipped / suspicious

### Taken during this phase (user answered in-session)

- **Trackers:** merge `features/caira-tracker` + `features/cpe-tracker` into `features/tracker/`
  with `caira/` and `cpe/` sub-features, breaking the circular dependency.
- **Dead code:** list only, do not delete. Consequence recorded: `location.ts` (25 MB, 969,250 lines)
  will be `git mv`'d in Phase 3 and stays in the ESLint ignore list.
- **`Utils` service:** move `shared/core/services/utils/utils.ts` → `shared/services/utils.ts` in
  Phase 4 rather than into `core/`. Pure move, no logic change; clears 17 boundary violations.

### Still needed from the user

- [ ] **PLAN.md approved.**
- [ ] Phase 5: `pages/` dissolved per the plan's §3 map.
- [ ] Phase 5: promote `home/components/offerings/*` and `partner-content-list` to `shared/`.
- [ ] Phase 10: keep the 2 CDK usages (`CdkTrapFocus` in header, `BreakpointObserver` in credly
      badge page) — ng-primitives has no equivalent. Recommend keeping.
- [ ] Phase 11: how to fix the 839 KB `location-min` chunk (API lookup vs dynamic `import()`).
- [ ] Phase 13: partner landing consolidation — the diff strongly supports yes.

### Closed as not applicable

- "Components with explicit `ChangeDetectionStrategy.Eager`" — **there are none.** All 18 explicit
  strategies are `OnPush`.

### Kept `@Injectable` (spec §4.1 requires listing these)

**None.** No service needs an advanced provider, so every one can become `@Service()` in Phase 8.

### CSS files kept (spec §7 requires listing)

Deferred to Phase 12's per-feature reports; the full classification is in the plan's §8 (~30 MUST
STAY with per-file reasons, ~15 CONVERTIBLE, 137 deletable).

### Heavy-library services NOT made lazy, with reasons

- `core/services/milesverse` (`@milesverse/sdk`) — **verified harmless**: the SDK compiles to an 8 KB
  lazy chunk and is absent from the initial bundle. `injectAsync` would add complexity for no gain.
- `core/services/html-to-pdf` — **already lazy** via `injectAsync` at both call sites.

### Bugs found (logged, not fixed — spec §7)

1. `--radius-4xl` used at `styles.css:297,303,308` but never defined; scrollbar radii silently
   resolve to nothing.
2. `@ng-icons/*` (8 packages) sit in `devDependencies` but are imported by production code via
   `configuration/ng-icon.ts`.
3. `app.config.ts` wires a dev-only mock interceptor into the production root injector.
4. `lenis` is an unused dependency — imported nowhere.
5. AGENTS.md §9 says `pnpm start` uses port 4100; `package.json` uses 4101.
6. AGENTS.md §9 says the initial bundle "sits near its 2.00 MB budget"; it is 501.9 KB. Correct in
   Phase 14.
7. Pre-existing: `footer-overlay.isAllowedRoute` returns `true` for a route outside the allowlist.

### Suspicious / worth a second look

- Two byte-identical `local-time-zone.pipe.ts` files (`shared/core/pipes/` and
  `pages/uae-caira/shared/pipes/`), same class and pipe name. Merge in Phase 3/5.
- `shared/utils/eastern-time.ts` looks like a third copy but is **not** — different semantics
  (`'EST'|'EDT'` for America/New_York as a `DatePipe` arg). Leave it.
- Tailwind v4 has **no `@source` directive at all**; class detection in `.ts` files using `cn()`
  string literals is unverified.

## 4. Visual QA list

Not applicable — Phase 0 is Part A and changes no source.

## 5. Commit message

```
docs(refactor): add Phase 0 audit and plan

Write docs/refactor/PLAN.md from a full read-only audit of src/: config
baseline, a measured import-boundary graph (~150 violations), the old -> new
move map for Part A phases 1-7, and the services, HTTP, headless-UI, @defer,
Tailwind and change-detection inventories for Part B.

Key findings:
- Phase 8 is near-mechanical: zero constructor injection, zero class-based
  guards/interceptors, zero InjectionToken/useClass/useFactory in src/.
- The largest lazy chunk (839 KB gzip, 33% of lazy JS) is committed country
  data in shared/core/constant/location-min.ts, used by one file. Its sibling
  location.ts (25 MB) has zero importers.
- admin/partner-platform v1 cannot be removed as a unit: its routed pages are
  dead but its shared/ layer backs v2 and six other admin features.
- features/shared/services/feature-facade is imported by core/, shared/ and
  layout/, so it belongs in core/.

Also records the Part B feature order in STATE.md and closes the
ChangeDetectionStrategy.Eager decision as not applicable (there are none).

No source changes.
```
