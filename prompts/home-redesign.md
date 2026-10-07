# Home page redesign: v3 design on this repo's structure and the `home-page/` API

Status: **approved 2026-10-06 (Claude Code plan mode). PR1 (promote the home-page read) implemented,
UNCOMMITTED; PR2–PR5 not started.** This file is the plan as approved, kept as the repo's implementation
prompt; the per-PR reports are appended under "Reports" at the end.

## Context

The sibling repo `miles-masterclass-v3` carries the approved home redesign (Figma "Home Page" `2175:21139`,
approved 2026-09-25): a CAIRA hero over a tilted, scrolling grid of course thumbnails, horizontal track
rails, a live-webinar ticket, the AI Labs ring, the CAIRA level stack, a pricing card, a new app-download
section and the FAQ. This repo still ships the old home (video hero, v2 track rails fetched browser-side
only, offerings laptop, plan benefits, coming soon).

Port that design here, on this repo's conventions (features/pages/components, facades, ESLint boundaries,
Tailwind-first, structure ratchet), with these rules:

1. The track rails read **`web-api/v1/masterclass/home-page/`**, the call the masterclass page already
   makes. No v3 API (`v2/tracks`, `v2/webinar/home_section`, `v2/plans`, `v2/library`) is adopted.
2. Sections whose data is not in that response are **designed as presentational components with the
   required API flagged**, not wired to v2.
3. Page performance is the first acceptance criterion.

Decisions taken on 2026-10-06: pricing + webinar = design the section, flag the API · ring + CAIRA visual
ports = separate follow-up PRs · the home-page read is promoted to a root facade in core.

## Jira (fill `MIL-XXX`; one child per PR; rename the branch with `git branch -m` once issued)

**Parent — Summary:** `feat(home): redesign the home page on the masterclass home-page API`
**Issue type:** Story · **Component / scope:** home, shared, core
**Links:** this file · Figma `2175:21139` · Postman `web-api/v1/masterclass/home-page/`

### Context

The v3 design was approved 2026-09-25; this repo still ships the old home. Guests land on it first, so its
load performance is the product's first impression.

### Current behaviour

`features/home/pages/home` renders a video hero (`home-hero.html`), v2 track rails through
`FeatureFacade.getResource('track')` (browser-only, so no rails in the SSR HTML), offerings, coming soon,
plan benefits and the FAQ. The masterclass page already reads `home-page/` (`pages/masterclass/masterclass.ts`).

### Expected behaviour

The v3 sections in order (hero, rails, webinar, AI Labs ring, CAIRA stack, pricing, app download, FAQ);
rails from `home-page/`; pricing and webinar designed with their API flagged; `/masterclass` unchanged.

### Scope

- In: PR1–PR5 below.
- Out: F1–F7 below (each its own ticket).

### Acceptance criteria

- [ ] The sections render in order on `/us/accounting/home`; `/us/accounting/masterclass` is unchanged.
- [ ] Initial bundle ≤ +0.5 kB over 242.5 kB transfer; three/gsap/swiper stay out of the initial set.
- [ ] LCP ≤ 2.5 s mobile-throttled and CLS ≤ 0.05 on the local SSR build (environment stated).
- [ ] Visual parity at 375 / 768 / 1440 with every intentional difference listed.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

### How to verify

See "Verification" below (local `pnpm start` on 4101, the SSR server on 4000, Lighthouse via `pnpm dlx`).

### Risks / assumptions / open questions

The "Ask" column of the API flags table, and "Risks" below.

**Children** (summary = PR title): `refactor(core): promote the masterclass home-page read for the home page`
(M) · `feat(home): rebuild the sections on the masterclass home-page tracks` (M) ·
`feat(home): redesign the hero with the CAIRA copy and the course grid` (M, data file) ·
`feat(home): add the pricing section and redesign the app download` (M) ·
`feat(home): add the live webinar ticket` (S–M).

## Decisions (locked)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Promote the home-page read.** `features/home` may not import `@features/offerings/*` (eslint-plugin-boundaries, `eslint.config.mjs:135`). Model + `parseHomePage` → `core/models/masterclass-home.model.ts`; the read + its constants → root `@Service()` `core/services/masterclass-home-facade/masterclass-home-facade.ts`; the card → `shared/components/cards/masterclass-course-card/`. | AGENTS.md §3: "Move a model up only when a second feature needs it." Home is that second reader. Root is justified the way `FeatureFacade` is: two routes share one read, and the parsed page is reused on home → masterclass navigation without a refetch.                                                                                                                                                                                |
| D2  | **`shared/utils/with-previous-value.ts` moves to `core/utils/`** (same PR, 14 import-line edits across features and admin). `openTrailer` stays a 2-line page method (`Utils.openVideoDialog` is shared; core cannot import it).                                                                                                                                                               | Core cannot import shared, and the facade needs `withPreviousValue`. The util is generic and non-UI, used by 2+ features and admin, so `core/utils` is its correct home by the placement rule.                                                                                                                                                                                                                                             |
| D3  | **Card links become absolute.** `[routerLink]="[c.id, c.slug]"` is relative and would resolve to `/home/<id>/<slug>`. The card computes `['/', country, profession, 'masterclass', id, slug]` from `Utils`.                                                                                                                                                                                    | Root-cause fix in the one shared place.                                                                                                                                                                                                                                                                                                                                                                                                    |
| D4  | **Rails: all horizontal cards, no filters, no load-more.**                                                                                                                                                                                                                                                                                                                                     | v3 home renders every rail horizontal. `home-page/` returns every course (`page_size=100`), and the filter button needs `v2/filters/`. Same as `/masterclass` today.                                                                                                                                                                                                                                                                       |
| D5  | **Hero grid reuses the 64 pre-compressed S3 thumbnails and the generated `hero-grid-columns.ts`.** No runtime call. The regen script (`scripts/compress-hero-grid.mjs`, prod `v2/tracks`) is **not** ported.                                                                                                                                                                                   | Zero API cost, SSR-rendered, already uploaded (all 64 answer 200, ~30 KB each).                                                                                                                                                                                                                                                                                                                                                            |
| D6  | **Pricing ships with the price block hidden; the webinar section is absent until data exists.** Both are presentational (`input()`), each with a Storybook story fed by a mock so the design is reviewable now. The page binds no data and carries an `// API flag:` comment.                                                                                                                  | Today's `#plan` section (plan-benefits) has no price either, so no regression. Alternative, if preferred: keep `app-plan-benefits` as `#plan` until the plan endpoint is decided.                                                                                                                                                                                                                                                          |
| D7  | **Ring and CAIRA stack: current components, new section order only.** v3 visuals (convex ring + proof points; cross-fade pin + mobile dots) are follow-ups F1/F2, keeping this repo's endpoints.                                                                                                                                                                                               | ~500 diff lines each.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D8  | **App download redesign happens in place in `shared/components/app-download`.** `features/uae-caira` renders it too and inherits the new look (intentional, listed).                                                                                                                                                                                                                           | Two consumers, same section.                                                                                                                                                                                                                                                                                                                                                                                                               |
| D9  | **Simple keyframes go to `@theme` in `src/styles/styles.css`** (`--animate-home-pricing-glow`, `--animate-download-arrow-in`, `--animate-download-ring-draw`); component CSS only where Tailwind cannot express the rule: `home-hero-grid.css` (`cos(11.7deg)` calc, container units, loop keyframe) and `home-webinar-ticket.css` (four-layer `mask-composite: intersect`).                   | AGENTS §4.6: animations live in `@theme`; each new component CSS needs a `structure-baseline.json` entry with a reason (CODEOWNERS review).                                                                                                                                                                                                                                                                                                |
| D10 | **Hero grid cards are plain `<img>`, not `NgOptimizedImage`.** `width="480" height="270" decoding="async" fetchpriority="low"`, eager only for the first 4 of each _visible_ column, lazy elsewhere; `CARDS_PER_COLUMN = 8` (64 `<img>` instead of 128, 40 s loop) with the constant to revert to 16.                                                                                          | The directive pins `fetchpriority` to `auto`/`high` and `decoding` to `auto`, so the decorative thumbnails cannot be demoted behind the logo, fonts and JS through it; with no `IMAGE_LOADER` it adds no srcset. `max-md:hidden` is `display:none`, and an eager `<img>` in a hidden column still downloads (−150 KB on phones). Visually identical. **Intentional differences from v3.**                                                  |
| D11 | **Rails: first rail rendered directly, rails 2..n `@defer (on viewport; prefetch on idle)`; no `hydrate on viewport` on rails.** Placeholders are fixed heights measured from the rendered rail, not `aspect-video`; `skeletonClass="aspect-video"` so the Carousel's own skeleton matches horizontal cards.                                                                                   | At 1440×900 the first rail's heading sits ~660 px down (10:4 hero + 80 px header): §4.4 forbids deferring it. `Carousel` keeps Swiper inside its own plain `@defer (on idle)` (`carousel.html:27`), so Swiper stays lazy regardless and a hydrated rail would carry only an `<h2>` + skeleton in SSR HTML. A `w-full aspect-video` placeholder is ~730 px tall at 1300 px wide against a ~300 px rail: a layout shift on every rail today. |
| D12 | **One shared resource, `tracks.courses.page_size=100`.** Knob (not default): `track.courses.slice(0, HOME_RAIL_MAX_CARDS)` per rail cuts DOM, not bytes.                                                                                                                                                                                                                                       | A home-specific page size is a second cache key: home → masterclass would refetch 216 KB instead of reusing the root facade's value. DOM cost is controlled by the viewport defer.                                                                                                                                                                                                                                                         |
| D13 | **One ticket = one PR**, five PRs in series, each ≤ ~400 lines (PR3 over by the generated data file). Branch names use `MIL-XXX` until tickets are issued.                                                                                                                                                                                                                                     | CLAUDE.md.                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## API flags (for the backend / Jira)

| Section             | Data it needs                                                                                                     | v3 source                                                                     | Here, now                                                                                                                                          | Ask                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track rails         | tracks + courses (uuid, slug, title, thumbnails, fields_of_study, total_cpe_credits, trailer_url, caira flags)    | `v2/tracks` + `v2/tracks/:id/courses`                                         | **`web-api/v1/masterclass/home-page/?login_type=…&tracks.courses.page_size=100`** (parsed, SSR for `pre_login`)                                    | none; report p50 of the call at 100 (if > ~400 ms, ask for a lighter card projection, not a smaller page)                                                                  |
| Hero grid           | 64 thumbnails                                                                                                     | build-time snapshot of prod `v2/tracks` → S3                                  | S3 files + list reused (D5)                                                                                                                        | optional: a `web-api` list endpoint so the snapshot script can move here, or CDN-resized thumbnails                                                                        |
| Live webinar ticket | highlighted webinar: id, title, short overview, square/horizontal thumbnail, next session start/end, registration | `v2/webinar/home_section/?section=highlight&page_size=1`                      | **not wired** (section absent)                                                                                                                     | **`web-api/v1/webinar/…` highlight endpoint.** Wiring also needs `features/offerings/dialogs/webinar-registration-dialog` promoted to `shared/dialogs/` (own refactor PR). |
| Pricing             | recommended plan: amount, currency, suffix, base_amount, discount_percent, commitment_months, optional yearly alt | `v2/plans/` (branch) / `promotion/subscription/?is_recommended=true` (master) | **not wired** (price block hidden). `PAYMENT_ROUTES.getSubscriptionPlans` = `promotion/subscription/` exists in `core/models/payment.model.ts:118` | **confirm the web source of truth for plan prices**                                                                                                                        |
| AI Labs ring        | ai_lab courses                                                                                                    | `v2/library/?course_type=ai_lab`                                              | unchanged: `shared/components/surround-carousel` reads `v2/tracks/7/courses/?course_type=ai_lab` (browser only, deferred)                          | flag: `web-api` twin                                                                                                                                                       |
| CAIRA stack         | badge ladder                                                                                                      | `v2/caira-badges/`                                                            | unchanged: `shared/components/caira-level-stack` reads it during SSR, as today                                                                     | flag: `web-api` twin                                                                                                                                                       |
| `coming_soon`       | —                                                                                                                 | —                                                                             | sent by `home-page/`, not parsed                                                                                                                   | not rendered (v3 removed Coming Soon)                                                                                                                                      |

## Target structure

```
src/app/core/models/masterclass-home.model.ts                 ← moved from features/offerings/masterclass/models/
src/app/core/utils/with-previous-value.ts                     ← moved from shared/utils/ (14 imports updated)
src/app/core/services/masterclass-home-facade/
  masterclass-home-facade.ts                                  ← NEW root @Service(): endpoint + page-size constants
                                                                 (from constants/masterclass.ts, deleted), loginType,
                                                                 httpResource(parse), withPreviousValue, tracks, isLoading,
                                                                 loadError (+ field effect() log), reload()
src/app/shared/components/cards/masterclass-course-card/      ← moved; absolute links (D3); + .stories.ts
src/app/features/offerings/masterclass/pages/masterclass/masterclass.{ts,html}  ← injects the facade; hero + nav + openTrailer unchanged
src/app/features/offerings/masterclass/constants/masterclass-nav.ts             ← stays

src/app/features/home/
  pages/home/home.{ts,html}                 ← rewritten (sections, nav, facade, openTrailer)
  components/home-hero/home-hero.{ts,html}  ← rewritten: CAIRA logo (ngSrc priority) + h1 + 2 CTAs + <app-home-hero-grid/>
  components/home-hero-grid/home-hero-grid.{ts,html,css} + hero-grid-columns.ts   ← new (ported; D10)
  components/home-pricing/home-pricing.{ts,html,stories.ts}                       ← new, presentational
  components/home-webinar-ticket/home-webinar-ticket.{ts,html,css,stories.ts}     ← new, presentational
  constants/home-assets.ts                  ← HOME_ASSET_BASE (S3 home-v3/), HOME_HERO_GRID_BASE, HOME_ASSETS
  models/home-sections.model.ts             ← HomePrice, HomeWebinar (the two presentational inputs)
src/app/shared/components/app-download/app-download.{ts,html}  ← redesigned in place
src/app/testing/mocks/home.mock.ts          ← story fixtures (price, webinar); stories only
src/styles/styles.css                       ← three @theme animation tokens (D9)
structure-baseline.json                     ← 2 componentStylesheets entries (D9)
```

Reused as-is: `Carousel` (Swiper lazy, `swiperConfigEven`), `SectionNav`, `Faq`, `CairaLevelStack`,
`SurroundCarousel`, `Button` (`<button app-button>` here, not v3's `<app-button (clicked)>`), `CategoriesList`,
`CairaCredlyBadge`, `Utils.country()/profession()/openVideoDialog`, `AuthSession.isAuthenticated()`, `apiUrl()`,
`Logger`, `MASTERCLASS_APP_STORE_URL`/`MASTERCLASS_PLAY_STORE_URL` (`core/constants/app-store.ts`),
`appStoreIcon`/`googlePlayIcon` (`core/constants/icon.ts`), `LocalTimeZonePipe`, `NgOptimizedImage` (logo, pricing icon, phone, QR).

No longer imported by home (nothing deleted; all still have other consumers): `VideoPoster`, `MilesSlug`,
`Offering`, `PlanBenefits`, `PartnerContentList`, `ComingSoon` card, `Vertical`/`Horizontal` cards,
`AppDownloadDialog` (the hero's "Download App" CTA goes; v3's CTAs are AI Labs + CAIRA), `FeatureFacade`
(home stops calling `track`/`premiere`/`comingSoon`). v3's empty `home.css` is not ported.

## Page layout (home.html, top → bottom)

| #   | `id`                 | Content                                                                                                                                                      | Render                                                                                                                                 |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `home-hero`          | `<app-home-hero/>`: grid backdrop, 4 vignettes, CAIRA logo, h1 "The AI Credential / Built for Accountants", meta row, CTAs → `ai-labs`, `caira`              | eager, SSR. Box `aspect-9/14 sm:10/6 md:video lg:10/5 xl:10/4` (no CLS)                                                                |
| 2   | `home-masterclasses` | one `<app-carousel>` per track (`facade.tracks()`), `<app-masterclass-course-card layout="horizontal" (trailer)>`; error state + Try again; loading skeleton | D11: first rail direct, rails 2..n `@defer (on viewport; prefetch on idle)` with measured fixed-height placeholders                    |
| 3   | `webinar`            | `<app-home-webinar-ticket [webinar]>`                                                                                                                        | inside `@if (webinar())` → absent until the API lands (no placeholder, no CLS); nav item hidden                                        |
| 4   | `model-carousel`     | `<app-surround-carousel/>` (current component)                                                                                                               | `@defer (on viewport; prefetch on idle)`, placeholder `min-h-[16rem] md:aspect-2/1 lg:aspect-5/2 xl:aspect-11/4`                       |
| 5   | `caira-levels`       | `<app-caira-level-stack/>` (current component)                                                                                                               | eager, as today (gsap pin needs frame zero in SSR; its SSR fetch runs in parallel with `home-page/`)                                   |
| 6   | `plan`               | `<app-home-pricing/>` (price input unbound)                                                                                                                  | `@defer (on viewport; prefetch on idle; hydrate on viewport)` → copy in SSR HTML; placeholder `min-h-[60vh]` only on client navigation |
| 7   | `app-download`       | `<app-app-download/>` (redesigned)                                                                                                                           | `@defer (on viewport; prefetch on idle; hydrate on viewport)`; re-measured placeholder heights                                         |
| 8   | `faq`                | `<app-faq [standalone]="false"/>`                                                                                                                            | `@defer (on viewport; prefetch on idle; hydrate on viewport)`; `min-h-[60vh]`                                                          |

Section nav (sidenav): Home, Master Classes, Live Webinar (visible when data), AI Labs, CAIRA, Pricing,
Download App, FAQ — lucide icons as in v3 `home.ts:41-50`.

## Performance plan

Reviewer's LCP estimate at 1440: logo ≈ 29k px², h1 ≈ 63k px², one visible grid card ≈ 65k px². The LCP is
the h1 or a grid card, not the logo, so: **measure first, then make the winner cheap.**

Budgets (measured locally on `pnpm build:prod` + the SSR server, macOS, environment stated in every report):

| Metric                         | Target                                                                                                                                                                                                                                                          | How                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Initial bundle                 | 242.5 kB transfer, ≤ +0.5 kB; no new budget warning                                                                                                                                                                                                             | `pnpm build:prod` "Initial total"                                       |
| Heavy libs stay lazy           | three, gsap, swiper absent from the initial set; no three/gsap request before their sections                                                                                                                                                                    | `bundle-report.mjs --initial-must-not-contain …`; browser resource list |
| Home lazy chunk                | ≤ 25 kB gzip (page + hero + grid list + cards)                                                                                                                                                                                                                  | `build:prod` lazy chunk table                                           |
| SSR HTML `/us/accounting/home` | exactly 1 `<h1>` (new copy); `<title>`/`og:`/`canonical` unchanged vs master; first track `<h2>` present; logo `<link rel="preload" as="image">`; `loading="eager"` count ≤ 12 (+ logo); no `<swiper-container>`/`<canvas>`; `ng-state` ≤ 260 KB raw (recorded) | `curl` greps below                                                      |
| TTFB                           | median of 5 ≤ master median + max(0, t_homepage − t_badges); `home-page/` p50 ≤ 400 ms or raise with backend                                                                                                                                                    | `curl -w` loop + the API alone                                          |
| Image bytes at load            | desktop ≤ 400 KB, mobile ≤ 250 KB                                                                                                                                                                                                                               | resource list before scrolling                                          |
| LCP                            | element = h1, logo, or a `fetchpriority="high"` grid card; mobile-throttled ≤ 2.5 s                                                                                                                                                                             | Lighthouse mobile + desktop, `PerformanceObserver`                      |
| CLS                            | ≤ 0.05 over a full slow scroll (hard limit 0.1)                                                                                                                                                                                                                 | `layout-shift` observer with sources                                    |
| TBT                            | ≤ 200 ms; Lighthouse mobile perf ≥ master baseline (measured first on master)                                                                                                                                                                                   | Lighthouse                                                              |
| Visual parity                  | 375 / 768 / 1440 vs v3, every intentional difference listed (D10, CTA change, uae-caira app-download)                                                                                                                                                           | built-in browser screenshots                                            |

Levers applied by default: D10 (grid images), D11 (rails), `priority` on the CAIRA logo only. If the measured
LCP is a grid card: `fetchpriority="high"` on the first fully visible card (`j === 1`) of the three always-visible
columns; they are in the SSR HTML, so the preload scanner finds them. Not applied: `sizes` (no loader),
`content-visibility` on cards (transform-animated content can blank a frame), a home page size (D12).

Global, out of scope → F4: render-blocking Google Fonts, no font preload.

## PR series (one ticket each, in order)

### PR1 `refactor(core): promote the masterclass home-page read for the home page`

Branch `refactor/MIL-XXX-promote-masterclass-home-read`. No visual change.

- `git mv` the model → `core/models/`; `git mv with-previous-value.ts` → `core/utils/` + 14 imports; delete `constants/masterclass.ts` (its constants move into the facade file).
- New `core/services/masterclass-home-facade/masterclass-home-facade.ts` (root). Body = the page's read moved; class doc: "root; the read is live from first inject — only pages inject this".
- `git mv` the card → `shared/components/cards/masterclass-course-card/`; absolute link (D3) via `Utils`; add a story.
- Masterclass page: inject the facade; keep `popular` hero, nav, `openTrailer`.
- Verify: `/us/accounting/masterclass` renders the same rails, trailer opens, card href = `/us/accounting/masterclass/<uuid>/<slug>`; `pnpm lint` boundary-clean; the facade's data survives a masterclass → home → masterclass navigation (one `home-page/` request in the network tab).

### PR2 `feat(home): rebuild the sections on the masterclass home-page tracks`

Branch `feat/MIL-XXX-home-sections`. Measures the TTFB side alone.

- `home.ts/html` rewrite per the layout table minus the hero (old hero kept this PR): rails on the facade + card (D11, D12), error/retry, new section order, nav items, webinar `@if` slot + API flag comment, pricing slot still `app-plan-benefits` until PR4.
- Drop the `FeatureFacade` reads and the imports listed under "No longer imported" (except hero ones).
- Verify: same 3 tracks as `/masterclass`; no browser `home-page/` request on a server-rendered load; first rail heading in SSR HTML; TTFB loop before/after; CLS over a full scroll with the new placeholders; bundle gate.

### PR3 `feat(home): redesign the hero with the CAIRA copy and the course grid`

Branch `feat/MIL-XXX-home-hero-grid`. Measures the LCP side alone. ~450 lines, 74 of them the generated list.

- `constants/home-assets.ts`; `home-hero-grid` (D10, CSS + baseline entry); `home-hero` rewrite (logo `priority`, h1, CTAs to `ai-labs`/`caira`); hero wrapper class in `home.html`.
- Verify: SSR HTML greps (preload, eager count, 1 h1); LCP element + ms on mobile and desktop presets, then apply the grid-card `fetchpriority` lever if needed; image bytes at load on both; `prefers-reduced-motion` stops the loop; 375/768/1440.

### PR4 `feat(home): add the pricing section and redesign the app download`

Branch `feat/MIL-XXX-home-pricing-app-download`.

- `models/home-sections.model.ts` (`HomePrice`), `home-pricing` (presentational, `price` input nullable, `@theme` glow token, story + mock), page slot replaces `app-plan-benefits` with `hydrate on viewport`.
- `app-download` redesign in place (phone render, QR desktop-only, SVG download mark with `@theme` arrow/ring tokens, store links from `core/constants/app-store.ts`); `uae-caira` inherits; re-measure its placeholder heights.
- Verify: price block absent on the page, present in Storybook; home and `/ae/accounting/home` at 375/768/1440.

### PR5 `feat(home): add the live webinar ticket`

Branch `feat/MIL-XXX-home-webinar-ticket`.

- `HomeWebinar` model, `home-webinar-ticket` (presentational: `webinar` input, `register`/`knowMore` outputs, ticket mask CSS + baseline entry, `LocalTimeZonePipe`, lucide calendar/clock), story + mock; page `webinar = signal<HomeWebinar | null>(null)` with the API flag; nav visibility bound to it.
- Verify: section absent on the page (no CLS); ticket renders in Storybook at 375/1440.

### Follow-ups (own tickets, not in this series)

F1 ring v3 parity (convex, header, proof points; keep endpoint, ~250 lines) · F2 CAIRA stack cross-fade
parity (~150) · F3 hero-grid snapshot script (needs a web-api list endpoint) · F4 fonts: self-host/preload,
drop render-blocking Google Fonts · F5 wire pricing + webinar once endpoints exist (+ promote the registration
dialog) · F6 add `/us/accounting/home` to `docs/refactor/smoke-routes.json` and re-record ·
F7 `HOME_RAIL_MAX_CARDS` + "View all" if the DOM audit asks.

## Verification (per PR; report real output and the environment)

```bash
pnpm lint && pnpm format:fix && pnpm build:prod 2>&1 | grep -E "Initial total|WARNING|home"
node scripts/refactor/bundle-report.mjs --initial-must-not-contain three --initial-must-not-contain gsap --initial-must-not-contain swiper
pnpm build && pnpm serve:ssr:miles-masterclass-v3 &   # port 4000
U=http://localhost:4000/us/accounting/home
curl -s $U | grep -cE '<h1'                                                        # 1
curl -s $U | grep -oE '<title>[^<]*|property="og:[a-z:]+"|rel="canonical"[^>]*' | sort -u
curl -s $U | grep -o 'rel="preload" as="image"[^>]*'                               # logo
curl -s $U | grep -o 'loading="eager"' | wc -l                                     # ≤ 13
curl -s $U | grep -o 'home-hero-grid/processed_' | wc -l                           # 64
curl -s $U | grep -o '<script id="ng-state"[^<]*' | wc -c                          # ng-state bytes
for i in 1 2 3 4 5; do curl -o /dev/null -s -w 'ttfb=%{time_starttransfer} total=%{time_total} bytes=%{size_download}\n' $U; done
curl -o /dev/null -s -w 'homepage=%{time_total}s %{size_download}B\n' "$BASE_API_URL/web-api/v1/masterclass/home-page/?login_type=pre_login&tracks.courses.page_size=100"
pnpm dlx lighthouse $U --only-categories=performance --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh-mobile.json
pnpm dlx lighthouse $U --preset=desktop --only-categories=performance --chrome-flags="--headless=new" --output=json --output-path=/tmp/lh-desktop.json
```

Run the same Lighthouse pair on `master` first so every number has a before.

Built-in browser, prod SSR build, hard reload, then one slow scroll to the bottom:

```js
new PerformanceObserver((l) => {
  const e = l.getEntries().at(-1);
  console.log('LCP', Math.round(e.startTime), e.element?.tagName, e.url);
}).observe({ type: 'largest-contentful-paint', buffered: true });
let cls = 0;
new PerformanceObserver((l) => {
  for (const e of l.getEntries())
    if (!e.hadRecentInput) {
      cls += e.value;
      console.log(
        'shift',
        e.value.toFixed(4),
        e.sources?.map((s) => s.node?.tagName + '.' + String(s.node?.className).slice(0, 40)),
      );
    }
  console.log('CLS', cls.toFixed(4));
}).observe({ type: 'layout-shift', buffered: true });
const r = performance.getEntriesByType('resource'),
  kb = (a) => Math.round(a.reduce((s, x) => s + x.transferSize, 0) / 1024) + 'KB';
console.log(
  'img',
  r.filter((x) => x.initiatorType === 'img').length,
  kb(r.filter((x) => x.initiatorType === 'img')),
  'js',
  kb(r.filter((x) => x.name.endsWith('.js'))),
  'heavy',
  r.filter((x) => /three|gsap|swiper/.test(x.name)).map((x) => x.name.split('/').pop()),
);
```

The resource line runs twice: before scrolling (`heavy` must be `[]`) and after reaching the ring and the
CAIRA stack. Also check `/us/accounting/masterclass` after PR1 (unchanged) and `/ae/accounting/home` after PR4.

## Risks

- **Signed-in SSR has no rails** (as on `/masterclass`): `isAuthenticated()` is true on the server from the cookie, the `post_login` branch returns `undefined`, the browser fetches after hydration. Accepted; stated.
- **Shared error state:** a failed load on home shows the error on `/masterclass` until `reload()`. Desired.
- **DOM after scrolling:** 68 cards × ~20 nodes; F7 knob. Hero grid 64 `<img>` (D10).
- **Baseline entries** (2 CSS files) need CODEOWNERS review; `check-structure` fails without them.
- **Prod `I18N` is off and home is hard-coded English** (as today). Transloco keys are a separate ticket.
- **Intentional differences from v3:** D10 grid loading, the hero's "Download App" CTA replaced by AI Labs + CAIRA CTAs (v3 design), `uae-caira` app-download look (PR4), pricing without a price block (D6).
- **S3 `home-v3/` assets** are shared with v3; `webinar-banner.webp` returns 403, so the ticket's fallback art must be re-uploaded before F5.

## Reports

### PR1 — 2026-10-06 (uncommitted, branch `refactor/MIL-XXX-promote-masterclass-home-read`)

**Built as planned**, no deviations:

- `core/models/masterclass-home.model.ts` (moved; header rewritten), `core/utils/with-previous-value.ts`
  (moved; 14 imports rewritten to `@core/utils/with-previous-value`), `core/services/masterclass-home-facade/
masterclass-home-facade.ts` (new root `@Service()`; the endpoint and page-size constants from the deleted
  `constants/masterclass.ts` live here, non-exported), `shared/components/cards/masterclass-course-card/`
  (moved; `courseLink` computed from `Utils`; new story with four variants), `testing/mocks/services.mock.ts`
  (`MockUtils` gains `country`/`profession` signals for the story), `pages/masterclass/masterclass.{ts,html}`
  (injects the facade as `home`; hero, nav and `openTrailer` unchanged).
- Gates (local macOS, Node 24, **not CI**): `pnpm lint` 0 errors / 110 legacy warnings, structure check
  passed; `tsc -p tsconfig.app.json` clean; `pnpm build:prod` initial total 1.05 MB raw / **242.56 kB**
  transfer (242.53 before), only the two known CSS budget warnings (`ai-labs.css`, `briefing-session.css`).
- Browser (dev server on 4101, UAT API): `/us/accounting/masterclass` renders 3 rails (21 / 34 / 13 cards),
  every card href is `/us/accounting/masterclass/<uuid>/<slug>`, the Trailer button opens the video dialog,
  no error alert, no browser `home-page/` request (transfer cache). After a client-side round trip
  home → masterclass there is still no `home-page/` request: the root facade kept its value. Console shows
  only pre-existing items (the empty `popular` hero feed 404, dev-only NG02955 LCP hints on vertical cards).
- `verify.mjs` full run (local macOS, Node 24.15, **not CI**): **7/7 GREEN** (lint, build, build:prod,
  build-storybook, format, bundle report, SSR smoke). Bundle report: initial 12 files, 935.9 KB raw /
  243.7 KB gzip, identical to the last run before this change; the +173% warning is the stale 2026-09-24
  baseline (it predates counting `styles-*.css`). SSR smoke: no drift; the same 9 partner routes are "not
  in baseline" as before. Both baselines are the user's to re-record.
- Diff: 21 tracked files, +63 / −165 before the new facade (121 lines), story (72) and this file; git
  detects the three renames.
