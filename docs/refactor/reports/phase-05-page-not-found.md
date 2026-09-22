# Phase 5 — Features: `page-not-found`

Part A, structure only. First feature of Phase 5. Run as `/refactor-phase 5 page-not-found`.

## 1. Summary

The smallest feature in the phase, run first deliberately to prove the Phase 5 pattern before it
reaches anything with a route table, a facade or a `shared/` layer.

| Step | What                                                                      | Files | References updated |
| ---- | ------------------------------------------------------------------------- | ----- | ------------------ |
| 1    | `pages/page-not-found/` → `features/page-not-found/pages/page-not-found/` | 4     | 1                  |

All 4 files recorded by git as **renames** at 100% similarity (`.ts`, `.html`, `.css`, `.spec.ts`).
The one reference is `src/app/app.routes.ts:5`, repointed from the relative
`'./pages/page-not-found/page-not-found'` to the alias
`'@features/page-not-found/pages/page-not-found/page-not-found'` — required by PROMPT.md §3, since the
import now crosses a top-level folder.

**The `import-auditor` sweep is what made this a one-line change rather than a guess.** It returned:
2 static imports (one of which is the spec's self-reference, which moves with the folder), **0** lazy
route references, **0** template usages of the `app-page-not-found` selector, **0** stories, **0**
hits in `angular.json` / `tsconfig*.json` / `.storybook/*` / `eslint.config.mjs` / `vercel.json`, and
**4** outbound imports from the component — all package imports (`@angular/core`, `@angular/router`,
`@ng-icons/core`, `@ng-icons/heroicons/outline`), so nothing broke in the other direction.

It also surfaced the three places that mention `page-not-found` as a **URL path string** and therefore
must NOT change: `app.routes.ts` registers it eagerly at `path: 'page-not-found'` and
`path: 'maintenance'`, with `{ path: '**', redirectTo: 'page-not-found' }` as the 404 terminus;
`core/services/analytics/analytics.ts:79` lists it in `NON_LOCALE_PREFIXES`; and
`shared/utils/seo/seo-route-slug.ts` lists it in `NON_LOCALE_ROOTS`. The URL is unchanged, so all
three keep working untouched — which is the whole point of a Part A move.

### Three structural decisions, all upheld by the `reviewer`

1. **Nested under `pages/`, not flattened.** PROMPT.md §3 says routed components **always** live in
   `pages/`. PLAN.md §3's row reads `pages/{connect-us,how-to-claim-credly-badge,page-not-found}` →
   `features/<name>/`, but that is the same abbreviated shorthand every other row in the table uses
   (`pages/faq/` → `features/faq/` unquestionably keeps `faq/pages/faq`), so it does not contradict §3.
   Phase 5's "flatten single-file folders" bullet governs services and models — which §3 makes flat
   files — not component folders, where §3's "one component per folder" rule applies.
2. **No `page-not-found.routes.ts` was created.** The component is registered **eagerly** via
   `component:` at two paths. PROMPT.md §5 names exactly four route tables to extract in this phase
   (`auth`, `features`, `library`, `offerings`) and this is not one of them. Adding a lazy routes file
   would change loading behaviour, which Part A forbids.
3. **The empty (0-byte) `page-not-found.css` and its `styleUrl` were kept.** Deleting emptied CSS is
   PROMPT.md §4.6 — a Phase 12 concern, not a Part A one.

`src/app/pages/` still exists with **12** folders (`ai-labs`, `compliance`, `connect-us`, `faculty`,
`faq`, `how-to-claim-credly-badge`, `instructor-details`, `milesverse`, `privacy-policy`, `shared`,
`terms-of-service`, `uae-caira`). PROMPT.md §5's "delete the empty `app/pages/`" fires after the last
feature moves, not now.

## 2. Verification

`verifier` subagent, full run, **8/8 GREEN**. No baseline flag was passed, and
`git status --porcelain docs/refactor/baseline/` is empty, verified — so the bundle comparison is
meaningful on its own authority.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 16s  |
| build (local)   | pass   | 22s  |
| build (prod)    | pass   | 23s  |
| storybook build | pass   | 19s  |
| format check    | pass   | 13s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 4s   |

**Bundle — byte-identical to Phase 4 and to the baseline:** initial 12 files / 501.5 KB raw /
101.5 KB gzip (**+0 KB, +0.0%** vs baseline); 271 lazy chunks / 10254.9 KB raw / 3042.4 KB gzip;
largest lazy `chunk-6HHQGW3L.js` at 3418.2 KB raw / 839.1 KB gz (still `constants/location-min.ts` —
Phase 11's item).

**SSR smoke — OK on all 4 routes:** `/` 302; `/us/accounting/partners/cpacanada` 200;
`/us/accounting/masterclass/154/adulting-in-business` 200 (title `"Miles Masterclass"` — still the
degraded fallback recorded in the baseline, open question 8, unchanged by this phase);
`/admin/login` 200.

Per-step gate: the harness Bash guard blocks Claude from running the `verify.mjs --quick` wrapper at
all (harness-owned path), so the step was gated by running its two underlying checks directly —
`tsc -p tsconfig.app.json` clean, `tsc -p tsconfig.spec.json` clean, `pnpm lint` "All files pass
linting". Same workaround as Phases 3 and 4.

**`reviewer`: PASS, no spec violations, no suppressions.** It confirmed zero logic change (the rename
diff is 100% similarity with no content hunks anywhere), agreed with all four scope decisions above,
and confirmed that `app.routes.ts` importing `@features/…` is not a new boundary violation — that file
is the root composition config, sits outside the `core`/`shared`/`layout`/`features`/`admin` taxonomy,
and already imports `@admin/admin.routes` and `@layout/blog-layout` the same way.

## 3. Decisions needed / skipped / suspicious

1. **The Phase 5 precondition decision _"dissolve `pages/` per PLAN.md §3"_ is still unticked**
   (STATE.md Decisions). I proceeded **for this feature only**. Its destination is not the judgement
   call that decision reserves: PROMPT.md §5 mandates `app/pages/*` → `features/` outright, and
   PLAN.md §3's Phase 5 table names this exact folder's destination in an already-approved plan.
   **Please tick it before the features whose destination genuinely is a judgement call** — `faq`, the
   three legal folders, `instructor-details` vs `faculty`, and `pages/shared`.
2. **No `@Injectable` kept, no CSS file deleted, no heavy-library service touched** — none of the
   report's standing obligations apply to a four-file presentational component with zero services.
3. **Logged, not fixed (PROMPT.md §7): `page-not-found.css` is 0 bytes but still carries a
   `styleUrl`.** Phase 12 should delete both. Noted here so that session does not have to rediscover it.
4. **Logged, not fixed: the "Return Home" control is a `<button role="link" routerLink="/">`.**
   A `routerLink` on a `<button>` does navigate, but the element is not a real link — no `href`, no
   middle-click, no open-in-new-tab, no copy-link-address, and link semantics are asserted via `role`
   rather than native. An `<a routerLink="/">` styled identically would be correct. Pre-existing, and
   untouched by this phase.
5. **Build churn recurred and was cleaned this time.** The verifier's builds regenerated
   `public/version.json` and `src/app/core/version/app-version.ts`; both were restored to `HEAD` with
   `git checkout HEAD --`, which the harness permitted in this session — unlike the Phase 4 handoff,
   where the user had to do it. The diff to commit is exactly the 4 renames plus `app.routes.ts` plus
   `STATE.md`. Open question 6 (gitignore these two) is still worth closing.

## 4. Visual QA list

None. Part A, zero template/style/selector change, and the route paths `/page-not-found` and
`/maintenance` are untouched. If you want a spot check anyway: `pnpm start` (port **4101**) and hit any
unknown URL — the `**` wildcard should still land on the 404 video page with a working "Return Home".

## 5. Commit message

```
refactor(structure): phase 5 page-not-found

Move pages/page-not-found/ to features/page-not-found/pages/page-not-found/,
the first feature of Phase 5's pages/ dissolution.

- 4 files moved, all recorded as renames at 100% similarity
- app.routes.ts:5 repointed to the @features/* alias (crosses a top-level
  folder, so PROMPT.md section 3 requires an alias)
- no routes file added: the component is registered eagerly at two paths
  plus the ** wildcard redirect, and is not one of the four route tables
  PROMPT.md section 5 extracts
- routed component nested under pages/ per PROMPT.md section 3
- empty page-not-found.css kept; deleting it is a Phase 12 concern

Zero logic change. Verifier 8/8 green, bundle byte-identical (+0.0%),
SSR smoke OK on all 4 routes. Reviewer PASS.
```
