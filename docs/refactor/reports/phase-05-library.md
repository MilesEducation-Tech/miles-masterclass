# Phase 5 — session 3: `library`

Run 2026-09-23 on `refactor/structure-5`. Part A, structure only.
Third session of the sequence in [PHASE-05-REMAINING.md](../PHASE-05-REMAINING.md).

## 1. Summary

`src/app/features/library/` now matches section 3 exactly. All three sub-features lost their internal
`shared/` layer; the three facades became flat files; the three routed pages moved into `pages/`; and
the inline `LibraryRoutes` table was split out into `library.routes.ts`.

**17 files moved, 5 edited, 1 created.** Only the three page `.ts` files are non-`R100`, and each
differs solely in import specifiers.

| Sub-feature  | Moves                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `badge`      | 2 components -> `components/`, facade -> flat `services/badge-facade.ts`, `badge.*` -> `pages/badge/`    |
| `course`     | 2 components -> `components/`, facade -> flat `services/course-facade.ts`, `course.*` -> `pages/course/` |
| `instructor` | facade -> flat `services/instructor-facade.ts`, `instructor.*` -> `pages/instructor/`                    |
| feature root | `LibraryRoutes` split out of `library.ts` into `library.routes.ts`; `Library` stays (D2)                 |

Feature `shared/` layers repo-wide: **12 -> 9** (289 -> 272 files).

### The audit made two expensive-looking moves cheap

**The sibling relatives needed no rewrite at all.** `badge-library-hero.ts:3` imports
`../badge-spot-animation/badge-spot-animation`, and `course-filters-drawer.ts:6` imports
`../course-filters/course-filters`. Both pairs move in lockstep from `shared/components/` up to
`components/`, so the relative path stays valid. Rewriting them "to be safe" would have broken them.

**None of the three facades is route-provided.** `BadgeFacade`, `CourseFacade` and `InstructorFacade`
are all `providedIn: 'root'` and injected only by their own page component — a repo-wide sweep for
them in any `providers: [...]` array returns nothing. Flattening each therefore touched exactly one
import line, not a route config.

### The `auth` stranded-import trap did not reproduce — and that was predicted, not lucky

The previous session's split left `AuthFacade` behind in `auth.ts`, used only by the departed route
table; lint caught it. Here the auditor checked import ownership _before_ the split and found
`library.ts`'s only route-table-owned symbol is `Route` itself, so dropping it from the
`@angular/router` import was the entire job. Verified afterwards by diff anyway: the `Library` class
is byte-identical, and `LibraryRoutes` differs only in the three lazy `loadComponent` specifiers that
had to change.

**Four route-table splits remain** — the four `offerings` sub-feature roots. Each of those files
holds a real landing page rather than a shell, so their import sets are much larger than
`library.ts`'s three, and the trap is correspondingly more likely.

## 2. Verification

`verifier` subagent, full run — **8/8 GREEN**.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 18s  |
| build (local)   | pass   | 31s  |
| build (prod)    | pass   | 30s  |
| storybook build | pass   | 20s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 3s   |

**Bundle.** Initial **12 files / 501.5 KB raw / 101.5 KB gzip — identical to baseline, +0.0%**.
Lazy **271 chunks, unchanged**, no chunk added or removed. One chunk shifted +0.6 KB raw / +0.1 KB
gzip, consistent with the `shared/` dissolution moving code across a chunk boundary. Three lazy
`loadComponent` specifiers changed in this session, so chunk splitting for the three library pages
was the thing most at risk; it did not move.

**SSR smoke** — all four routes match baseline. **Caveat worth stating plainly: no library route is
in the smoke set**, so SSR did not exercise anything this session touched. The bundle report is the
only indirect signal, which is why the QA list below matters more than usual here.

`reviewer` subagent — **PASS, zero violations.** It independently confirmed the byte-identity of both
halves of the split, that no import was stranded or duplicated, that no `shared/` folder remains
anywhere under `features/library/`, that the three facades are flat files, and that none of the
URL-carrying files (`seo.ts`, `legacy-redirects.ts`, `seo.constants.ts`, `nav.config.ts`,
`footer.ts`, `footer-overlay.config.ts`) appears in the diff at all.

**Recorded-baseline check:** clean after the full run.

## 3. Decisions needed / skipped / suspicious

### Needs your attention

1. **THREE units are now uncommitted in one tree, and it has started to confuse review.** The
   reviewer flagged `instructor-details/*` and `instructor-hero/*` as looking like newly added logic
   — `git status` shows them as `A`/`AM` — and had to run `git diff -M --find-renames=40%` across two
   directories at once to establish they are actually `R100`/`R098` renames belonging to the earlier
   `pages/` dissolution. Nothing was wrong, but a human reviewer would likely not do that check and
   would see phantom new code. **This is the concrete cost of not committing**, and it grows with each
   session. `partners` (60 files) and `payment` (64) are next but one.

2. **`LibraryRoutes` keeps its PascalCase name.** Every other route export is `authRoutes`,
   `featuresRoutes`, `offeringsRoutes`, `PAYMENT_ROUTES`, `AI_LABS_ROUTES`. Renaming an export is
   outside Part A's structural mandate, so it was deliberately not done. One line in
   `features.routes.ts:46` plus the declaration, whenever you want it.

### Logged, not fixed (PROMPT.md section 2.7)

3. **Every `.css` file in the library tree is empty** — `badge.css`, `course.css`, `instructor.css`,
   `instructor-details.css`, `course-filters.css`, `course-filters-drawer.css`,
   `badge-library-hero.css`, `badge-spot-animation.css`: eight files, all zero bytes, all still
   wired via `styleUrl`. Phase 12 deletes emptied CSS; recorded here so it need not be rediscovered.
4. **`course-filters` and `course-filters-drawer` have no specs**, unlike the two `badge` components
   which both do. `library/course` is the least-tested sub-feature.
5. The three facades' doc comments reference the `course-library` / `badge-library` /
   `instructor-library` URL segments. Those comments moved verbatim with the flattened files and are
   still accurate — no action, noted only so a future reader does not mistake them for stale paths.

## 4. Visual QA list

Part A changes no markup, and every `.html`/`.css` in the library tree has zero content diff. The
risk is purely runtime module resolution — and, as noted above, **the SSR gate covers none of these
routes**.

All three are lazy `loadComponent` targets whose specifiers changed in this session:

- **`/{c}/{p}/library/badge-library`** — renders `badge-library-hero`, which in turn renders
  `badge-spot-animation` through the sibling relative that deliberately was not rewritten. If that
  reasoning was wrong, this is the page that shows it.
- **`/{c}/{p}/library/course-library`** — renders `course-filters` and `course-filters-drawer`; open
  the filter drawer, since the drawer reaches the filters component by the same kind of sibling
  relative.
- **`/{c}/{p}/library/instructor-library`** — then click through to an instructor, which lands on
  `instructor-details` (moved in the previous session) and exercises the `pages/ -> components/`
  cross-folder import for `instructor-hero`.
- **The `Library` shell itself** — the back control and the container layout wrap all three pages;
  confirm it still renders around each.

## 5. Commit message

```
refactor(structure): phase 5 library

Flatten features/library/ to the target shape. No shared/ layer remains under it.

- badge:      shared/components/{badge-library-hero,badge-spot-animation} ->
              components/; shared/services/badge-facade/ -> services/badge-facade.ts;
              badge.* -> pages/badge/
- course:     shared/components/{course-filters,course-filters-drawer} ->
              components/; shared/services/course-facade/ -> services/course-facade.ts;
              course.* -> pages/course/
- instructor: shared/services/instructor-facade/ -> services/instructor-facade.ts;
              instructor.* -> pages/instructor/
- split the inline LibraryRoutes table out of library.ts into
  library.routes.ts; Library stays at the feature root as a <router-outlet/>
  shell (recorded decision D2); features.routes.ts now loads
  @features/library/library.routes

The sibling relatives inside each component pair were deliberately left alone:
both halves move in lockstep, so the paths stay valid. None of the three
facades is route-provided, so flattening them touched one import line each.

Structure only: no logic, URL, selector or template change. The three
instructor-library / badge-library / course-library path segments are
byte-identical. Initial bundle and lazy chunk count are unchanged from baseline.
```
