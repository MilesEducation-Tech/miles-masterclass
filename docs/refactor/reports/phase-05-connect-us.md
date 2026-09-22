# Phase 5 — Features: `connect-us` (+ the `Faq` promotion)

Part A, structure only. Third session of Phase 5. Run as `/refactor-phase 5 connect-us`.

## 1. Summary

`connect-us` is four files. Getting it moved required first settling a question that had been quietly
mis-recorded since Phase 4 and that gates most of the remaining phase.

| Step | What                                                                                                               | Files | Refs updated |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ----- | ------------ |
| 1    | `pages/faq/faq.*` → `shared/components/faq/`; `faq-item/` → `shared/components/faq-item/`; **delete `pages/faq/`** | 8     | 16           |
| 2    | `pages/connect-us/` → `features/connect-us/pages/connect-us/`                                                      | 4     | 1            |

**12 files moved, every one recorded by git as `R100`** — byte-identical renames with zero content
delta, confirmed by the reviewer. Every other hunk in the diff is an import specifier or a Prettier
reflow.

### Why this feature was blocked, and what the audit actually found

`connect-us` is a two-line composite — `<app-enquiry-form>` + **`<app-faq />`** — that imported `Faq`,
the **routed FAQ page**, from `'../faq/faq'`. Moving it to `features/connect-us/pages/connect-us/`
while `Faq` stayed at `pages/faq/` would have turned that into `'../../../../pages/faq/faq'`: a
relative import crossing top-level folders, which §3 forbids, with no `@pages/*` alias available
(Phase 2 left `pages/` un-aliased by design). That **creates** a violation rather than clearing one —
the same test Phases 3 and 4 used to refuse PLAN.md rows — so nothing was moved until the user decided.

**A wrong claim in STATE.md was corrected in the process.** Since Phase 4 the handoff had said the
`features/* → pages/faq` edges "clear when `pages/faq` becomes `features/faq`". **They do not — they
relabel to `features/* → features/faq`, which §3 bans identically.** This is precisely the Phase 3
error about `utils.ts` ("closes the last `core → features` edge") that Phase 4 had to correct to
"relabels it `shared → features`". The same mistake, made twice, about two different files.

**Counts were re-derived from the import graph rather than trusted from PLAN.md**, whose figures have
now been wrong twice. **13 files import the routed `Faq`**, plus `features.ts:6` which legitimately
registers the route. They span **7 top-level features**: `offerings` (6 — webinar, micro-learning,
podcast, masterclass, masterclass-course, podcast-course), `blog` (3), `home`, `partners`
(caira-landing), plus `connect-us` and `uae-caira`, which become features in this very phase.

**Root cause: `Faq` is deliberately dual-purpose.** `faq.ts:14` declares
`standalone = input<boolean>(true)` — an input that exists only so the routed page can be embedded as
a section widget. §3's placement rule (2+ features → promote to `shared/`) and §3's "routed components
always live in `pages/`" point in opposite directions for this one component, so it was the user's
call, not a judgement to make silently.

### The two decisions

1. **`Faq` promoted to `shared/components/faq/`**, with `faq-item` beside it at
   `shared/components/faq-item/`. A pure move, zero logic change, and it clears all 13 banned edges at
   once rather than relabelling them. `features.ts` now routes `component: Faq` out of `@shared/`.
   The audit confirmed this is safe: `Faq` and `FaqItem` import **nothing** from `features/*` or any
   other `pages/*` folder, so no `shared → features` edge is created. `AccordionMode` is consumed only
   by its own sibling.
2. **`compliance` stays at `features/legal/pages/compliance/`.** The user moved it there outside this
   session, reverting the `legal` session's split back to PLAN.md's grouping, and confirmed the
   reversal. It was done with a plain `mv` rather than `git mv`, so it shows in this diff as 4
   deletions plus an untracked folder; all four files were verified byte-identical to `HEAD`, and
   git will resolve it as a rename at commit time. **`d12ae67`'s report has been corrected** — §1
   decision 1, the shape diagram, the step table and the commit-message note.

### The knock-on nobody asked for but everybody gets

Promoting `Faq` **empties `pages/faq/` completely** — it held only `faq.*` and `faq-item/` (`faq-content`
having left in the `legal` session). So **there is no `features/faq/` folder at all, and there never
will be.**

That **dissolves** the open `shared → features` item rather than resolving it. The earlier decision to
move `faq.model.ts` → `features/faq/models/` now has **no destination**, so `faq.model.ts` and
`constants/faq.ts` stay in `core/` — which is the outcome originally recommended when that row was
first questioned. Nothing is left outstanding from it, and PLAN.md §3's Phase 3 row for those two
files is now permanently moot.

`src/app/pages/` is down to **7** folders: `ai-labs`, `faculty`, `how-to-claim-credly-badge`,
`instructor-details`, `milesverse`, `uae-caira` — and nothing else.

**`connect-us` stays lazy.** It is the first Phase 5 feature that is genuinely lazy-loaded
(`loadComponent` at `features.ts:91-94`), unlike `page-not-found` and the legal pages, which are all
eager. The alias pushed that line past Prettier's 100-char `printWidth`, so it was reflowed — the same
mechanism seen in Phases 3 and 4, and again only that one file was formatted, never `format:fix`
across `src/`.

## 2. Verification

`verifier`, full run, **8/8 GREEN**. No baseline flag; `git status --porcelain docs/refactor/baseline/`
empty, verified.

| Gate            | Result | Time |
| --------------- | ------ | ---- |
| lint            | pass   | 5s   |
| unit tests      | pass   | 16s  |
| build (local)   | pass   | 23s  |
| build (prod)    | pass   | 29s  |
| storybook build | pass   | 23s  |
| format check    | pass   | 14s  |
| bundle report   | pass   | 0s   |
| ssr smoke       | pass   | 4s   |

**Bundle — byte-identical for the fourth phase running:** initial 12 files / 501.5 KB raw / 101.5 KB
gzip (**+0 KB, +0.0%**). **Lazy chunk count held at 271 → 271** — the specific risk of this phase,
since promoting a component out of a lazy route tree could in principle have reshuffled chunks. It did
not. The largest lazy chunk is unchanged in size and rank (3418.2 KB / 839.1 KB gz); only its
content-hashed filename moved, which is expected when any file relocates.

**SSR smoke — OK on all 4 routes**, titles unchanged.

Per-step gating used `tsc -p tsconfig.app.json` + `tsc -p tsconfig.spec.json` + `pnpm lint` directly,
since the harness guard blocks Claude from invoking the `--quick` wrapper.

**`reviewer`: PASS, zero violations, no suppressions.** It confirmed all 12 moves are `R100`; that
`shared/components/faq/` and `shared/components/faq-item/` import only `@angular/*`, `@ng-icons/*`,
`@core/*` and `@shared/*` — no `features/` or `pages/` import anywhere; that all 14 `Faq` consumers now
import from `@shared/`, with **zero relative crossings left**; that `pages/faq/` is gone with no
surviving reference to `pages/faq` or `faq/shared`; that the route strings `faq`, `mobile/faq` and
`connect-us` are **byte-unchanged**; that `Faq` is still registered at **both** route sites and
`connect-us` is still lazy, not converted to eager; and independently that the four relocated
`compliance` files are byte-identical to `HEAD` with nothing still referencing `features/compliance`.

## 3. Decisions needed / skipped / suspicious

1. **None outstanding.** This session closed the last open item from the `legal` session rather than
   creating a new one.
2. **`connect-us.css` is empty (0 bytes) but still carries a `styleUrl`** — the third such file
   (`page-not-found.css`, `compliance.css`). A Phase 12 batch item.
3. **`faq.css` and `faq-item.css` moved into `shared/` unexamined.** Part A does not open CSS files;
   Phase 12 should check whether either contains a `@reference` whose depth changed. _(The verifier's
   green Tailwind build implies they do not, but it was not inspected by hand.)_
4. **Logged, not fixed — a false positive worth recording so nobody chases it:**
   `pages/how-to-claim-credly-badge/how-to-claim-credly-badge.html:36` contains
   `scrollToSection('connect-us')` inside a **commented-out** button. It is a dead in-page anchor id,
   not a route or component reference.
5. **URL strings that must never change**, all verified untouched: `seo.ts:76,79` (`STATIC_PATHS` for
   `faq` and `connect-us`), `core/models/seo.constants.ts:94`, `legacy-redirects.ts:189`
   (`/accounting/help-desk` → `/{c}/{p}/connect-us`), `legacy-redirects.spec.ts:30,31,164`, and
   `features/payment/shared/pages/plan/plan.ts:285`, which navigates to
   `/${country}/${profession}/connect-us`.
6. **This commit bundles the user's out-of-band `compliance` move.** It is not Claude's change; it is
   included because it was already in the working tree and is a prerequisite for a green build.
7. **Build churn cleaned** — `public/version.json` and `core/version/app-version.ts` restored to
   `HEAD`.

## 4. Visual QA list

Part A, zero template change — but **this is the first session with real visual blast radius**, because
`Faq` renders on 13 pages. The gates prove it compiles and SSRs; they do not prove it still renders.
Worth a quick pass with `pnpm start` (port **4101**):

- `/us/accounting/faq` — the standalone routed page (`standalone` defaults to `true`).
- `/us/accounting/mobile/faq` — plain layout, no header/footer.
- `/us/accounting/connect-us` — enquiry form **plus** the embedded FAQ, the only consumer that embeds
  it with `standalone` left at its default.
- Any one of the embedded-widget consumers, which all pass `[standalone]="false"`:
  `/us/accounting/home`, a masterclass or podcast course page, a blog page, or
  `/us/accounting/partners/cpacanada`.

## 5. Commit message

```
refactor(structure): phase 5 connect-us and the Faq promotion

Promote the dual-purpose Faq component to shared/ and move connect-us into
features/, deleting pages/faq/ entirely.

- Faq is both the routed /faq page and a widget embedded by 13 pages across
  7 top-level features, so PROMPT.md section 3's placement rule puts it in
  shared/components/faq/, with faq-item alongside it
- this clears 13 banned features/* -> pages/faq edges outright rather than
  relabelling them to features/* -> features/faq, which section 3 bans just
  as firmly
- pages/faq/ is now gone, so there is no features/faq/ folder at all; as a
  result faq.model.ts and constants/faq.ts stay in core/ and PLAN.md's
  Phase 3 row for them is permanently moot
- pages/connect-us/ -> features/connect-us/pages/connect-us/, still lazy
- compliance stays at features/legal/pages/compliance/ per the user's
  revert; the phase-05-legal report has been corrected to match

12 files moved, all recorded as byte-identical renames. Route path strings
faq, mobile/faq and connect-us verified unchanged.

Verifier 8/8 green, bundle byte-identical (+0.0%) with the lazy chunk count
held at 271, SSR smoke OK on all 4 routes. Reviewer PASS.
```
