# Phase 5 — Features: `uae-caira`

Part A, structure only. Fourth session of Phase 5.

## 1. Summary

The first Phase 5 feature with a real internal `shared/` layer to dissolve, and the first to delete a
file.

| Step | What                                                                                        | Files               |
| ---- | ------------------------------------------------------------------------------------------- | ------------------- |
| 1    | `pages/uae-caira/` → `features/uae-caira/{pages,components,services}/`; `shared/` dissolved | 9 moved + 1 deleted |

Resulting shape — the internal `shared/` layer is gone, and the facade is a **flat file** per §3
("Services and models are flat files"):

```
features/uae-caira/
  pages/uae-caira/uae-caira.{ts,html,css}
  components/caira-levels-section/
  components/caira-webinar-section/
  services/uae-caira-facade.ts          ← was shared/services/uae-caira-facade/uae-caira-facade.ts
```

**`src/app/pages/` is down to 5 folders:** `ai-labs`, `faculty`, `how-to-claim-credly-badge`,
`instructor-details`, `milesverse`.

### The duplicate pipe was merged, not moved

`pages/uae-caira/shared/pipes/local-time-zone.pipe.ts` was **deleted**. It and
`shared/pipes/local-time-zone/local-time-zone.pipe.ts` differ in exactly one line — a doc comment
("to replace the hard-coded "ET" label." vs "to replace hard-coded "ET" labels."). Same class name,
same `@Pipe({ name: 'localTimeZone' })`, byte-identical `transform`. Its only two consumers were both
inside the moved folder and now import `@shared/pipes/local-time-zone/local-time-zone.pipe`.

This is a **plan-sanctioned duplicate merge**, not feature-code deletion: PLAN.md lists
`local-time-zone.pipe.ts ×2` under "duplicates to merge", and `reports/phase-00.md:121-122` flags this
exact pair with "Merge in Phase 3/5". PROMPT.md §5 Phase 3 said "Merge duplicates per the plan"; this
one could not be done in Phase 3 because both consumers still lived in `pages/`. The reviewer
independently confirmed both the content equivalence and the §7 classification.

### The audit made this a small move

Only **2 inbound reference lines** exist in the entire repo — `features/features.ts:4` (the facade, in
`providers`) and `:39` (the lazy `loadComponent`). Nothing else references `UaeCaira`,
`CairaLevelsSection`, `CairaWebinarSection` or `UaeCairaFacade`. No specs, no stories, no hits in
`angular.json` / `tsconfig*.json` / `.storybook/*` / `eslint.config.mjs` / `vercel.json` / `scripts/`.

**Nothing URL-facing changed, and nothing could have.** This route is `path: 'home'` gated by
`uaeCairaMatchGuard` (country `ae` + profession `accounting`), so it shares the `home` path string with
the default `Home` page and with `CpaLanding`. The URL is decided entirely by `features.ts`'s route
table plus the guard — both of which live outside the moved folder. The guard file has no diff.

Five relative imports were rewritten, all internal to the feature; the 6 cross-feature imports were
already aliased and are byte-identical to the pre-move file.

## 2. Verification

`verifier`, full run, **8/8 GREEN**. No baseline flag; `git status --porcelain docs/refactor/baseline/`
empty, verified.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 16s  |
| build (local)   | pass   | 23s  |
| build (prod)    | pass   | 23s  |
| storybook build | pass   | 20s  |
| format check    | pass   | 13s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

**Bundle:** initial 12 files / 501.5 KB raw / 101.5 KB gzip — **+0 KB (+0.0%)**, unchanged. Lazy 271
chunks (**unchanged**), 10254.5 KB raw / 3042.1 KB gzip against the previous run's 10254.9 / 3042.4.
That is a **−0.4 KB raw / −0.3 KB gzip** move in the lazy total, directionally consistent with
deduplicating the pipe, but small enough that the verifier classified it as noise — **it is not
claimed here as a proven saving.** The deleted pipe sat in a lazy chunk and the shared one it was
replaced by is pulled into that chunk instead, so a near-wash is the expected outcome either way.

**SSR smoke — OK on all 4 routes.** Worth stating plainly: **`/ae/accounting/home` is not in the smoke
list**, so the SSR gate does not cover this feature's own route. It confirms the other four did not
regress; it proves nothing about the UAE page.

**`reviewer`: PASS, zero violations, no suppressions.** It confirmed the CSS/HTML/facade files are
0-line-diff renames; that the three `.ts` files changed only import specifiers (+1/−1, +1/−1, +3/−3);
that the 6 cross-feature import lines are byte-identical to the pre-move file, so **no new cross-feature
edge was introduced**; that the route, the guard and the lazy `loadComponent` are intact; and that the
folder had zero `.spec`/`.stories` files before the move, so none were lost.

## 3. Decisions needed / skipped / suspicious

### 1. The six cross-feature edges — a decision, deliberately not fixed here

The move **reclassifies** six pre-existing edges from `pages/uae-caira → features/*` (unclassified —
`pages/` is not in §3's taxonomy) to **`features/uae-caira → features/*`**, which §3 bans. They were
not introduced by this move and they all still compile, because they were already aliased. Unlike
`connect-us`'s `Faq` import, there is no build-level problem forcing a decision now.

PLAN.md §3 says these should be resolved **in Phase 5** ("move the magnet, don't duplicate it"), and
STATE.md already carries an unticked decision to promote two of them. **Counts re-derived from the
import graph** (PLAN.md's have been wrong twice):

| Component (current home)                                        | Importers in its own feature | External features                       | Total top-level features |
| --------------------------------------------------------------- | ---------------------------- | --------------------------------------- | ------------------------ |
| `partners/shared/components/partner-content-list`               | 11                           | offerings (3), home, library, uae-caira | **5**                    |
| `partners/shared/components/caira-steps-grid`                   | 1                            | uae-caira                               | 2                        |
| `partners/shared/components/caira-feature-grid`                 | 1                            | uae-caira                               | 2                        |
| `partners/shared/models/caira-step-icons`                       | 1                            | uae-caira                               | 2                        |
| `home/components/app-download`                                  | 1                            | uae-caira                               | 2                        |
| `offerings/webinar/shared/components/webinar-registration-form` | 2                            | uae-caira                               | 2                        |

All six meet §3's bar ("if 2+ top-level features use it, promote it to `shared/`"), and Phase 4 already
set the precedent — `app-download-dialog` was kept in `shared/` on exactly a 2-feature count.
**`partner-content-list` is the strong case at 5 features; the other five are 2-feature only because
`uae-caira` exists.**

Three ways forward:

- **(a) Promote all six to `shared/components/`** — follows §3 and PLAN.md literally, clears every edge.
  Blast radius ~20 files across partners (11 pages), offerings, home and library.
- **(b) Promote only `partner-content-list`** (the 5-feature magnet) and leave the other five for
  Phase 7's temporary-warning list. Smallest diff that fixes the real problem.
- **(c) Make `uae-caira` a sub-feature of `partners`.** Four of the six edges are into
  `partners/shared/`, and `partners` already owns a `caira-landing` page, so this would dissolve them
  structurally rather than by promotion. It contradicts PLAN.md's explicit
  `pages/uae-caira/ → features/uae-caira/` mapping, so it needs an explicit override.

### 2. Other items

- **`uae-caira` has no specs and no stories at all** — four components including a facade with HTTP
  calls, zero test coverage. Not a refactor blocker; relevant to Part B Phase 9.
- **`uae-caira-top` is a DOM anchor id** used by `scrollToTop()` in `uae-caira.ts` and `scrollToForm()`
  in `caira-webinar-section.ts`. Internal to the feature and moved intact, but it is cross-file
  coupling by string — worth knowing before anyone renames it.
- **Build churn cleaned** — `public/version.json` and `core/version/app-version.ts` restored to `HEAD`.
- **This commit is not isolated.** The working tree still carries the uncommitted `connect-us` +
  `Faq` promotion work and the user's `compliance` move, because the user chose to continue without
  committing. `pages/uae-caira/uae-caira.ts` was already modified by the `connect-us` session (its
  `Faq` import), so the two features are entangled in one diff. Splitting them by path is possible but
  fiddly; the commit message below covers **uae-caira only** and assumes the rest is committed with it
  or separately.

## 4. Visual QA list

Part A, zero template change — but this feature's route is **not covered by the SSR smoke test**, so
it deserves an eye. With `pnpm start` (port **4101**):

- **`/ae/accounting/home`** — the UAE CAIRA landing page. Check the levels carousel
  (`caira-levels-section`, driven by `UaeCairaFacade` over HTTP), the webinar section, the FAQ block,
  and the app-download and registration-form sections that come from other features.
- Confirm the **timezone label** still renders (e.g. "GST") in the webinar section — that is the merged
  pipe's only visible output, and the one thing the deletion could plausibly have broken.
- **`/us/accounting/home`** — confirm the _default_ Home page still renders, since it shares the `home`
  path string and the guard decides between them.

## 5. Commit message

```
refactor(structure): phase 5 uae-caira

Move pages/uae-caira/ into features/uae-caira/, dissolving its internal
shared/ layer and merging a duplicated pipe.

- pages/ -> features/uae-caira/{pages,components,services}/
- the internal shared/ layer is gone: components move up to components/,
  and the facade is flattened from shared/services/uae-caira-facade/
  uae-caira-facade.ts to services/uae-caira-facade.ts, per PROMPT.md
  section 3 (services are flat files)
- shared/pipes/local-time-zone.pipe.ts DELETED as a duplicate of
  shared/pipes/local-time-zone/local-time-zone.pipe.ts (identical but for
  one doc-comment word); both consumers repointed. PLAN.md lists this pair
  under duplicates to merge
- features.ts lines 4 and 39 repointed; still lazy

Only 2 inbound references existed repo-wide. The route is path: 'home'
gated by uaeCairaMatchGuard, so no URL string changes and the guard is
untouched. The 6 pre-existing cross-feature imports are byte-identical and
are reported as a decision, not fixed here.

Verifier 8/8 green, initial bundle +0.0%, lazy chunk count unchanged at
271. Reviewer PASS.
```
