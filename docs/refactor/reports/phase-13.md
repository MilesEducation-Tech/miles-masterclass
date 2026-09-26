# Phase 13 — Partner landing consolidation

## 1. Summary

**The 10 partner landing pages now run on two config-driven pages.** Each partner's content lives in
`features/partners/data/<partner>.ts`. URLs are unchanged, and the server-rendered text of every route is
byte-identical to the pre-change build.

| Page type             | Page                      | Config                             | Partners                                                                        |
| --------------------- | ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| Member-access landing | `pages/partner-landing/`  | `models/partner-landing.model.ts`  | ctcpa, dscpa, hawaii, cpa-canada, mgi-world, mgi-north-america, allinial-global |
| Long-form showcase    | `pages/partner-showcase/` | `models/partner-showcase.model.ts` | cpe-for-corporate, boomer-knowledge-network, illinois                           |

**The second layout was your call (2026-09-26).** PLAN §10 expected all 10 pages to fit one page. The last three turned
out to be a different page type:

- a full-screen hero, or a compliance-first opening
- a scheduler dialog and partnership tabs
- optional plan benefits

Rather than grow `partner-landing` escape hatches, they got their own config-driven page.

**How the config reaches the page:**

- Each route keeps its path. It loads the shared page with `loadComponent` and resolves the partner's config with
  `resolve: { partner: () => import('./data/<partner>') }`.
- `withComponentInputBinding` binds the config to `partner = input.required<…>()`.
- The data stays out of `partner.routes.ts` on purpose. That file is mounted at `path: ''` ahead of other feature
  routes, so the router loads it while matching unrelated URLs.
- Each partner keeps its own lazy chunk, as before: lazy chunks went 324 → 329.

**History:** each `data/<partner>.ts` is the old page's `.ts`, moved with `git mv` and rewritten as config. Content
arrays, comments and imports were lifted verbatim by script, and the old `.html` and `.spec.ts` files were deleted.

**What the configs capture:**

- **`partner-landing`:**
  - The pill brand and its colour.
  - The two anchors. They can't be derived: Allinial's content anchor is `allinial-content-section` but its form is
    `allinial-global-section`.
  - A plain or highlighted benefits heading.
  - `audience: 'society' | 'firm'`, which drives the offer copy and CTA label.
  - CPA Canada's `shortOffer` `<h3>`, `iconClass` and `keepUpdatedLabel`.
  - The enquiry type, and the hero, offering and footer content, plan pointers and offerings list.
- **`partner-showcase`:**
  - An optional hero, with the second glow's class.
  - The compliance, partnership and sample content.
  - The tabs, with their panels and card arrays kept as local constants in each data file.
  - The selected tab.
  - The optional Illinois benefits and offer.
  - The anchors and enquiry type.
  - An optional "OR / Book a Strategy Call" block. Its absence adds `mb-32`, as Illinois had.
- **Shared constants on each page:** the video list, the partnership content and the scheduler call. Each was
  identical across its pages.

**Bugs caught during the work, before any commit:**

1. A heading slot wrapped in `@if` still projects the `@if` anchor, which suppresses `plan-benefits`'
   `{{ heading() }}` fallback. The benefits heading would have vanished on every plain-heading partner. The fix is two
   `<app-plan-benefits>` branches sharing one body template, and the spec guards it.
2. My first model put the full $599 copy into CPA Canada's `<h3>`. The original holds only the closing sentence. The
   SSR text diff caught it, and `shortOffer` now models it.

**Left alone:** `caira-landing` is a different page type. The dead `ascpa` stub stays, because its route is commented
out and deletion needs your approval.

**Dropped:** Illinois's `OrContent` array. Its markup was already commented out in the old template, so it was dead
data. The commented markup is not carried into `partner-showcase`, because `orContent` is simply absent for Illinois.

## 2. Verification

These are the `verifier` subagent's results from the full `verify.mjs` run, which passed first time.

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (182 files / 692 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass                                      |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 OK, 9 WARN "not in baseline"      |

- **Environment:** local, macOS, Node 24.15.
- **Tests:** there are 8 fewer files and 6 fewer tests. That is 10 deleted per-page "should create" specs, replaced by
  2 layout specs with 4 branch-level tests.
- `reviewer`: **PASS**. It compared every data file and template line by line against `HEAD`.
- **Bundle:** the initial bundle is 89.5 KB gz (+0.3% vs baseline), unchanged. Lazy chunks went 324 → 329, now one per
  partner config plus the two pages.

**The SSR "identical output" proof.** The spec requires it. Your recorded baseline has only 4 routes, so the smoke test
can only WARN on the 9 new partner routes. So:

- **The before snapshot:** I captured the full SSR HTML of all 10 partner routes from a prod build of the untouched
  code (commit `9b5c356`), and checked that two runs matched exactly.
- **After each step:** the rendered text of all 10 routes was compared. It is **byte-identical on every route**.
- **Tag-level DOM, the stricter check:** it is identical except in three ways:
  - the host tag name (`app-ctcpa` → `app-partner-landing`, and so on)
  - attribute order (`id` and `class` swapped)
  - static-input reflection: child components no longer carry reflected attributes such as `heading="…"`,
    `iconclass` and `keepupdatedlabel`, because those inputs are now bound. The rendered output is the same.

  No CSS or code targets the old host tags.

## 3. Decisions needed / skipped / suspicious

- **Please record the SSR baseline** with the 13 routes in `docs/refactor/smoke-routes.json`. Until then the smoke gate
  only warns on partner routes.
  - **Most independent:** record it from `9b5c356`, the pre-consolidation code, for example in a worktree. Then this
    commit's smoke run proves identity on its own.
  - **Alternative:** record it after committing. My before/after diff above is then the proof of identity.
- **Needs your approval:** deleting the dead `ascpa` stub (`pages/ascpa/`, route commented out).
- **PR size:** the source diff is ~1,500 lines in and ~1,440 out, but ~2,000 of those lines are the 10 data files
  moving from class members to config.
  - The new code is ~650 lines: 2 models, 2 pages, 2 specs and the routes.
  - If you want it under ~400 lines per PR, split it in two: `partner-landing` + 7 partners, then
    `partner-showcase` + 3. They only share `partner.routes.ts` hunks.
- The spinner-colour and dialog-gradient items are still open, from Phase 12.

## 4. Visual QA list

Check at 375 / 768 / 1440 px:

- **All 10 routes:**
  - `/us/accounting/cpe-for-corporate`
  - `/us/accounting/partners/{connecticut,delaware,hawaii,illinois}-society-of-cpas`
  - `/us/accounting/partners/{cpacanada,boomer-knowledge-network,mgi-world,mgi-north-america,allinial-global}`
- **Interactions**, which SSR can't show:
  - the hero pill's **Activate** scrolls to the form
  - the benefits CTA scrolls to the form
  - showcase **Explore Courses** / **Schedule Discovery Call** / **Book Demo** scroll correctly
  - **Book a Strategy Call** and Corporate's **Schedule Discovery Call** open the Calendly dialog
  - the partnership tabs switch
  - the enquiry form submits with the right `enquiry_type`
  - CPA Canada's form shows its custom "Keep me up to date…" label

## 5. Commit message

```
refactor(partners): consolidate partner landing pages into two config-driven pages

- partner-landing renders the 7 member-access pages (ctcpa, dscpa,
  hawaii, cpa-canada, mgi-world, mgi-north-america, allinial-global);
  partner-showcase renders the 3 long-form pages (corporate, bkn,
  illinois)
- each partner's content moves to data/<partner>.ts (git mv of the old
  page class), resolved per route with a dynamic import so it stays in
  its own lazy chunk
- URLs unchanged; SSR text identical on all 10 routes
- add the 9 other partner routes to the SSR smoke list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
