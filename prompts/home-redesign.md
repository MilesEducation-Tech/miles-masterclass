# Home page redesign: v3 design on this repo's structure and the `home-page/` API

Status: **approved 2026-10-06 (Claude Code plan mode). PR1–PR4 committed; PR5 (webinar ticket) implemented,
UNCOMMITTED. The series is complete once PR5 lands; F1–F9 and the backend asks remain.** This file is the plan as approved, kept as the repo's implementation
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

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Promote the home-page read.** `features/home` may not import `@features/offerings/*` (eslint-plugin-boundaries, `eslint.config.mjs:135`). Model + `parseHomePage` → `core/models/masterclass-home.model.ts`; the read + its constants → root `@Service()` `core/services/masterclass-home-facade/masterclass-home-facade.ts`; the card → `shared/components/cards/masterclass-course-card/`.                                                                                                                                                                                         | AGENTS.md §3: "Move a model up only when a second feature needs it." Home is that second reader. Root is justified the way `FeatureFacade` is: two routes share one read, and the parsed page is reused on home → masterclass navigation without a refetch.                                                                                                                                                                  |
| D2  | **`shared/utils/with-previous-value.ts` moves to `core/utils/`** (same PR, 14 import-line edits across features and admin). `openTrailer` stays a 2-line page method (`Utils.openVideoDialog` is shared; core cannot import it).                                                                                                                                                                                                                                                                                                                                                       | Core cannot import shared, and the facade needs `withPreviousValue`. The util is generic and non-UI, used by 2+ features and admin, so `core/utils` is its correct home by the placement rule.                                                                                                                                                                                                                               |
| D3  | **Card links become absolute.** `[routerLink]="[c.id, c.slug]"` is relative and would resolve to `/home/<id>/<slug>`. The card computes `['/', country, profession, 'masterclass', id, slug]` from `Utils`.                                                                                                                                                                                                                                                                                                                                                                            | Root-cause fix in the one shared place.                                                                                                                                                                                                                                                                                                                                                                                      |
| D4  | **Rails: all horizontal cards, no filters, no load-more.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | v3 home renders every rail horizontal. `home-page/` returns every course (`page_size=100`), and the filter button needs `v2/filters/`. Same as `/masterclass` today.                                                                                                                                                                                                                                                         |
| D5  | **Hero grid reuses the 64 pre-compressed S3 thumbnails and the generated `hero-grid-columns.ts`.** No runtime call. The regen script (`scripts/compress-hero-grid.mjs`, prod `v2/tracks`) is **not** ported.                                                                                                                                                                                                                                                                                                                                                                           | Zero API cost, SSR-rendered, already uploaded (all 64 answer 200, ~30 KB each).                                                                                                                                                                                                                                                                                                                                              |
| D6  | **Pricing ships with the price block hidden; the webinar section is absent until data exists.** Both are presentational (`input()`), each with a Storybook story fed by a mock so the design is reviewable now. The page binds no data and carries an `// API flag:` comment.                                                                                                                                                                                                                                                                                                          | Today's `#plan` section (plan-benefits) has no price either, so no regression. Alternative, if preferred: keep `app-plan-benefits` as `#plan` until the plan endpoint is decided.                                                                                                                                                                                                                                            |
| D7  | **Ring and CAIRA stack: current components, new section order only.** v3 visuals (convex ring + proof points; cross-fade pin + mobile dots) are follow-ups F1/F2, keeping this repo's endpoints.                                                                                                                                                                                                                                                                                                                                                                                       | ~500 diff lines each.                                                                                                                                                                                                                                                                                                                                                                                                        |
| D8  | **App download redesign happens in place in `shared/components/app-download`.** `features/uae-caira` renders it too and inherits the new look (intentional, listed).                                                                                                                                                                                                                                                                                                                                                                                                                   | Two consumers, same section.                                                                                                                                                                                                                                                                                                                                                                                                 |
| D9  | **Simple keyframes go to `@theme` in `src/styles/styles.css`** (`--animate-home-pricing-glow`, `--animate-download-arrow-in`, `--animate-download-ring-draw`); component CSS only where Tailwind cannot express the rule: `home-hero-grid.css` (`cos(11.7deg)` calc, container units, loop keyframe) and `home-webinar-ticket.css` (four-layer `mask-composite: intersect`).                                                                                                                                                                                                           | AGENTS §4.6: animations live in `@theme`; each new component CSS needs a `structure-baseline.json` entry with a reason (CODEOWNERS review).                                                                                                                                                                                                                                                                                  |
| D10 | **Hero grid cards are plain `<img>`, not `NgOptimizedImage`.** `width="480" height="270" decoding="async"`; in the three columns a phone shows, the four on-screen cards are eager and the two fully inside the clip are `fetchpriority="high"` (one of them is the mobile LCP element; at `low` it queued behind 2 MB of scripts); everything else lazy and `low`; `CARDS_PER_COLUMN = 8` (64 `<img>`, 40 s loop) with the constant to revert to 16. The geometry uses `vw`, not container units: a classic scrollbar appearing mid-stream moved every column (desktop CLS 0.05 → 0). | The directive pins `fetchpriority` and `decoding`, so the decorative thumbnails could not be tiered; with no `IMAGE_LOADER` it adds no srcset. `max-md:hidden` is `display:none`, and an eager `<img>` in a hidden column still downloads. **Intentional differences from v3.**                                                                                                                                              |
| D11 | **Rails: every rail is `@defer (on viewport)` with a placeholder that mirrors the rail's geometry; the `@empty` skeleton has the same geometry and is in the server HTML.** _Revised in PR2:_ the home page fetches the tracks in the browser (`MasterclassHomeFacade.fetchOnServer` is off by default; the masterclass page opts in), so the server HTML carries the skeleton either way and a directly rendered first rail bought nothing. No `hydrate on viewport` on rails.                                                                                                        | `Carousel` keeps Swiper inside its own plain `@defer (on idle)` (`carousel.html:27`), so no card is ever in the SSR HTML and a hydrated rail would carry only an `<h2>`. The first rail is in view on desktop and renders the moment the response lands; the rest wait for the scroll. A `w-full aspect-video` placeholder is ~730 px tall at 1300 px wide against a ~300 px rail: a layout shift on every rail before this. |
| D12 | **One shared resource, `tracks.courses.page_size=100`.** Knob (not default): `track.courses.slice(0, HOME_RAIL_MAX_CARDS)` per rail cuts DOM, not bytes.                                                                                                                                                                                                                                                                                                                                                                                                                               | A home-specific page size is a second cache key: home → masterclass would refetch 216 KB instead of reusing the root facade's value. DOM cost is controlled by the viewport defer.                                                                                                                                                                                                                                           |
| D13 | **One ticket = one PR**, five PRs in series, each ≤ ~400 lines (PR3 over by the generated data file). Branch names use `MIL-XXX` until tickets are issued.                                                                                                                                                                                                                                                                                                                                                                                                                             | CLAUDE.md.                                                                                                                                                                                                                                                                                                                                                                                                                   |

## API flags (for the backend / Jira)

| Section             | Data it needs                                                                                                     | v3 source                                                                     | Here, now                                                                                                                                          | Ask                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Track rails         | tracks + courses (uuid, slug, title, thumbnails, fields_of_study, total_cpe_credits, trailer_url, caira flags)    | `v2/tracks` + `v2/tracks/:id/courses`                                         | **`web-api/v1/masterclass/home-page/?login_type=…&tracks.courses.page_size=100`** (parsed, SSR for `pre_login`)                                    | **a lighter card projection.** Measured 2026-10-06 on UAT: the body is 216 KB raw / 54 KB gzip and rides in the SSR transfer state; the keys the cards read are 75 KB raw / 13 KB gzip. The unread `description` alone is 102 KB (47%), then `first_chapter`, `has_additional_resources`, `subject`, `total_duration`, `delivery_method`, the video URLs and `is_bookmarked`/`bookmark_id`. A `?fields=` or card projection would cut the home HTML by ~40 KB gzip. The call itself is 0.30–0.74 s. |
| Course thumbnails   | the card art (`thumbnails.horizontal`)                                                                            | same                                                                          | the API's originals, 240–716 KB each (Lighthouse desktop, 2026-10-06: the four visible first-rail cards = 1.2 MB)                                  | **resized variants or CDN resizing** (v3 pre-compressed its hero copies to ~30 KB for this reason); `NgOptimizedImage` has no loader here, so there is no client-side lever                                                                                                                                                                                                                                                                                                                         |
| Hero grid           | 64 thumbnails                                                                                                     | build-time snapshot of prod `v2/tracks` → S3                                  | S3 files + list reused (D5)                                                                                                                        | optional: a `web-api` list endpoint so the snapshot script can move here, or CDN-resized thumbnails                                                                                                                                                                                                                                                                                                                                                                                                 |
| Live webinar ticket | highlighted webinar: id, title, short overview, square/horizontal thumbnail, next session start/end, registration | `v2/webinar/home_section/?section=highlight&page_size=1`                      | **not wired** (section absent)                                                                                                                     | **`web-api/v1/webinar/…` highlight endpoint.** Wiring also needs `features/offerings/dialogs/webinar-registration-dialog` promoted to `shared/dialogs/` (own refactor PR).                                                                                                                                                                                                                                                                                                                          |
| Pricing             | recommended plan: amount, currency, suffix, base_amount, discount_percent, commitment_months, optional yearly alt | `v2/plans/` (branch) / `promotion/subscription/?is_recommended=true` (master) | **not wired** (price block hidden). `PAYMENT_ROUTES.getSubscriptionPlans` = `promotion/subscription/` exists in `core/models/payment.model.ts:118` | **confirm the web source of truth for plan prices**                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| AI Labs ring        | ai_lab courses                                                                                                    | `v2/library/?course_type=ai_lab`                                              | unchanged: `shared/components/surround-carousel` reads `v2/tracks/7/courses/?course_type=ai_lab` (browser only, deferred)                          | flag: `web-api` twin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CAIRA stack         | badge ladder                                                                                                      | `v2/caira-badges/`                                                            | unchanged: `shared/components/caira-level-stack` reads it during SSR, as today                                                                     | flag: `web-api` twin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `coming_soon`       | —                                                                                                                 | —                                                                             | sent by `home-page/`, not parsed                                                                                                                   | not rendered (v3 removed Coming Soon)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

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

### Measured after PR2 (local macOS, Node 24.15, optimized `local,production` builds against UAT, Lighthouse 12 headless, interleaved runs)

|                                  | old home                                                                   | new home (PR2)                                                                              |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| SSR HTML `/us/accounting/home`   | 380 KB raw / 52.0 KB gzip, `ng-state` 38 KB                                | 360 KB raw / 49.2 KB gzip, `ng-state` 38 KB                                                 |
| TTFB, 6 alternating curls        | 0.33–0.59 s (median 0.37)                                                  | 0.29–0.38 s (median 0.30)                                                                   |
| Lighthouse mobile, medians of 3  | perf 62 · FCP 3.6 s · LCP 19.1 s · SI 6.3 s · TBT 51 ms · CLS 0.043        | perf 58 · FCP 4.8 s (3.6 / 4.8 / 7.7) · LCP 18.1 s · SI 8.6 s · TBT 23 ms · CLS 0.011–0.029 |
| observed (unthrottled) FCP / LCP | 412–424 ms / 1.04–1.06 s                                                   | 445–539 ms / 1.06–1.19 s                                                                    |
| Lighthouse desktop               | perf 71 · FCP 1.4 s · LCP 3.7 s · CLS 0.037 · total 13.1 MB (media 9.3 MB) | perf 74 · FCP 1.3 s · LCP 3.2 s · CLS 0.015 · total 10.0 MB (media 5.0 MB: the hero video)  |
| images at desktop load           | 895 KB / 11                                                                | 2138 KB / 13 — four first-rail thumbnails are 1.2 MB (see the API flag)                     |

Reading: the LCP on both is the old hero's posters (390 + 251 KB) and video, which PR3 replaces. The
simulated mobile FCP trails although the observed first paint is within ~100 ms and the pre-paint request
set is identical (checked request by request); Lantern's simulation is sensitive to the UAT API's latency
and varied 3.6–7.7 s across runs. With the server fetch on (the first PR2 cut), HTML was 104 KB gzip and
mobile FCP 4.8–8.8 s; that is why `fetchOnServer` is opt-in.

### Measured after PR3 (same method, PR2 build vs PR3 build, interleaved)

|                                     | PR2 (old hero)                                                                       | PR3 (CAIRA hero + grid)                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSR HTML                            | 49.2 KB gzip                                                                         | 50.1 KB gzip; 1 `<h1>` "The AI Credential / Built for Accountants"; `<link rel="preload" as="image">` for the logo; 64 grid `<img>` (13 eager, 8 `high`, 58 `low`); CTAs as `<a href>`; no video or poster |
| `pnpm build:prod` initial           | 242.69 kB                                                                            | 242.79 kB                                                                                                                                                                                                  |
| Lighthouse mobile, medians of 3     | perf 56 · FCP 7.2 s · LCP 17.9 s · SI 9.9 s · CLS 0.011–0.029                        | perf 57 · FCP 7.8 s (3.3 / 7.8 / 7.8) · LCP 16.9 s · SI 7.9 s · CLS 0.008–0.010                                                                                                                            |
| mobile LCP element, observed phases | hero video poster (ttfb 490, load 99 ms)                                             | a hero-grid card (ttfb 385, delay 30, load 228 ms)                                                                                                                                                         |
| mobile bytes at load                | images 16 / 4.8 MB, media 130 KB                                                     | images 39 / 4.6 MB (grid 24 / 371 KB; the rest is 15 first-rail originals ≈ 4.2 MB), media 0                                                                                                               |
| Lighthouse desktop                  | perf 76 · FCP 0.7 s · LCP 3.0 s · SI 2.7 s · CLS 0.015 · total 8.1 MB (media 3.1 MB) | perf 77 · FCP 0.7 s · LCP 4.1 s · SI 1.6 s · CLS 0.024 · total 4.1 MB (media 0)                                                                                                                            |
| desktop LCP element, phases         | hero video poster (load 612 ms)                                                      | a first-rail course thumbnail of 716 KB (delay 856, load 1389 ms), despite `priority` on the first three cards                                                                                             |
| TTFB                                | equal (0.31–0.41 s both); two PR3 mobile runs hit a UAT spike (TTFB 980 ms)          |

Reading: the hero no longer costs 3–5 MB of video and posters, SI improves on both presets, and CLS is
down on mobile. The LCP is now whatever large image the API serves in the first rail: on desktop a 716 KB
original (the "Course thumbnails" ask above), on mobile a 30 KB grid card that is fast. The simulated
mobile FCP stays noisy (3.3–7.8 s across runs of either build). Two Carousel behaviours remain and are
filed as F8: before Swiper initialises its slides stack vertically, so ~15 first-rail thumbnails load on a
phone that shows 1.1 of them, and its root is `inline`, so its own idle-time skeleton and the final rail
differ by a line box (the remaining 0.024 desktop shift).

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
F7 `HOME_RAIL_MAX_CARDS` + "View all" if the DOM audit asks. · F8 **done 2026-10-07** (report below): `Carousel` renders its slides only once Swiper is registered and keeps its skeleton until `initialize()`, its root is `block`, and the home wrappers use flex `gap` instead of `space-y` · F9 `scrollbar-gutter: stable` on `html` so no width-scaled layout shifts when the classic scrollbar appears (global; measured on the hero grid before D10's `vw` fix).

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

### PR2 — 2026-10-06 (uncommitted, branch `feat/MIL-XXX-home-sections`, stacked on PR1)

**Built as planned, with two revisions**, both measured (table above):

- `MasterclassHomeFacade.fetchOnServer` (new `signal(false)`): the server fetches `pre_login` only for a
  page that opts in. The masterclass page opts in (its MIL-23 behaviour is unchanged: tracks in the SSR
  HTML, ~262 KB `ng-state`); the home page does not and fetches after hydration. `isSettled` (new) lets the
  home template hold the rails skeleton through server render and the browser fetch.
- D11 revised: all rails `@defer (on viewport)`; the `@if (first)` duplication is gone.
- Files: `pages/home/home.{ts,html}` rewritten (sections hero → rails → ring → CAIRA → plan → app download
  → FAQ; 7 sidenav items; webinar and pricing slots carry their API-flag comments; plan section is the
  previous `app-plan-benefits` until PR4); `core/services/masterclass-home-facade/` (the flag + `isSettled`);
  `pages/masterclass/masterclass.ts` (opts in). The CAIRA stack is `@defer (on viewport; prefetch on idle;
hydrate on viewport)` with a measured placeholder (1115 / 1312 / 1450 px), so gsap is no longer fetched on
  every page load (it was, through the eager stack). Home no longer imports `FeatureFacade`, the legacy
  cards, offerings, coming-soon or partner-content-list; nothing shared was deleted.
- Gates (local macOS, Node 24.15, **not CI**): `pnpm lint` 0 errors / 110 legacy warnings, structure check
  passed; `tsc` clean; `pnpm build:prod` initial 242.69 kB transfer (242.53 before PR1), the two known CSS
  budget warnings.
- `verify.mjs` full run (local macOS, Node 24.15, **not CI**): **7/7 GREEN**; bundle report initial 243.8 KB
  gzip (243.7 before), the known stale-baseline warning; SSR smoke no drift, the known 9 "not in baseline" routes.
- Browser (dev server 4101, pane visible): sections in order, first rail 21 cards with Swiper, two rail
  placeholders until scrolled, 7 sidenav items, absolute card hrefs, no `home-page/` request on the
  server-rendered load before the change, no error alert. Console: only the pre-existing view-transition
  message and the empty `popular` hero feed 404.
- SSR (`/us/accounting/home`): 1 `<h1>`, title / og / canonical unchanged, the rails skeleton, the CAIRA
  stack, app download and 42 FAQ items in the HTML, no `<swiper-container>` or `<canvas>`.
- Not verified here: the in-pane scroll checks (ring, CAIRA hydration, rails 2–3) and the browser
  `PerformanceObserver` run — the browser pane was hidden for most of the session, and a hidden document
  fires no viewport triggers and reports no LCP. Lighthouse covered LCP/CLS instead.
- **Production backend:** `api.milescaira.com` answers 404 for `web-api/v1/masterclass/home-page/`
  (checked 2026-10-06), so a production build shows the rails' error state on both pages. UAT serves it.

### PR3 — 2026-10-07 (uncommitted, branch `feat/MIL-XXX-home-hero-grid`, stacked on PR2)

**Built as planned, with D10 extended** by two measured levers (the high-priority tier for the two
fully visible cards per phone column, and `vw` geometry) and one small addition to the shared card:

- New `components/home-hero-grid/` (`home-hero-grid.{ts,html,css}` + the generated `hero-grid-columns.ts`
  copied from v3; CSS baseline entry added — your CODEOWNERS review), `constants/home-assets.ts`,
  `components/home-hero/home-hero.{ts,html}` rewritten (CAIRA logo with `priority`, the single `<h1>`,
  meta row, two `<a routerLink>` CTAs to `ai-labs` and `caira`; `VideoPoster`, `MilesSlug`, the store
  constants and the app-download dialog are no longer used by the hero). `MasterclassCourseCard` gains a
  `priority` input (default off); home sets it on the first rail's first three cards and passes the
  Carousel a `skeletonClass` with the slide geometry. `core/constants/app-store.ts` comment updated.
- Gates (local macOS, Node 24.15, **not CI**): `pnpm lint` 0 errors / 110 legacy warnings, structure check
  passed; `tsc` clean; `pnpm build:prod` initial 242.79 kB transfer, the two known CSS budget warnings.
- `verify.mjs` full run (local macOS, Node 24.15, **not CI**): **7/7 GREEN**; bundle report initial 243.9 KB
  gzip (+0.1 KB), the known stale-baseline warning; SSR smoke no drift, the known 9 "not in baseline" routes.
- Browser (dev server 4101): hero renders as designed at 375 / 768 / 1440 with no horizontal overflow,
  strip loop 40 s, 12 eager + 6 high-priority grid images, CTAs `/us/accounting/ai-labs` and
  `/us/accounting/caira`; console only the pre-existing view-transition message. `prefers-reduced-motion`
  stops the loop in CSS (ported rule); not exercised in the pane.
- SSR and Lighthouse: the table above.
- Not done here: the in-pane scroll checks (the pane was hidden or zero-width during most runs).

### PR4 — 2026-10-07 (uncommitted, branch `feat/MIL-XXX-home-pricing-app-download`, stacked on PR3)

**Built as planned (D6, D8, D9):**

- New `components/home-pricing/` (presentational; `price: HomePrice | null`, unbound on the page so the
  figure block stays hidden; the copy, the spinning halo, the app icon, "Subscribe Now" → `payment/plan`
  and "Talk to us" → `connect-us` as `<a routerLink>`; the webinar line is plain text until PR5 adds the
  section) with `models/home-sections.model.ts` (`HomePrice`, `HomePriceOption`), a story in three states
  (no price, monthly + yearly, discounted yearly) fed by `testing/mocks/home.mock.ts`.
- `shared/components/app-download` redesigned in place (phone render, QR on desktop only, store badges
  from `core/constants/app-store.ts`, the animated download mark as inline SVG); its `getIcon(): any` is
  gone, so the file left `LEGACY_ANY_FILES` (lint warnings 110 → 109). `uae-caira` wraps it in the page's
  `w-11/12` gutter and otherwise inherits the new look.
- Three `@theme` animation tokens in `styles.css` (`--animate-home-pricing-glow`,
  `--animate-download-arrow-in`, `--animate-download-ring-draw`) with keyframes in `animation.css`; no
  component CSS, so no baseline entry.
- `home.{ts,html}`: the `app-plan-benefits` section, its eight pointers, `goToPlan` and the `Router` are
  gone; `#plan` renders the card behind `hydrate on viewport`; both placeholders re-measured on the PR4
  build (pricing 973 / 742 / 464 px, app download 643 / 620 / 592 px at 375 / 768 / 1440).
- Gates (local macOS, Node 24.15, **not CI**): `verify.mjs` full run **7/7 GREEN** (Storybook built the
  new story; bundle 244.6 KB gzip, the stale-baseline warning; SSR smoke no drift); `pnpm lint` 0 errors /
  109 warnings, structure check passed; `tsc` clean; `pnpm build:prod` initial 243.18 kB transfer (+0.4 kB
  for the three tokens in the initial stylesheet; +0.65 kB over the pre-series 242.53).
- Browser (UAT-pointed optimized build on 4003): pricing card and app download render as designed at
  375 / 768 / 1440 with no horizontal overflow; the figure block is hidden; the halo and ring animations
  run; store links and both router links resolve; `/ae/accounting/home` shows the new section inside its
  gutter.

### PR5 — 2026-10-07 (uncommitted, branch `feat/MIL-XXX-home-webinar-ticket`, stacked on PR4)

**Built as planned (D6):**

- New `components/home-webinar-ticket/` (presentational: `webinar: HomeWebinar` required input, `register`
  and `knowMore` outputs; the CSS ticket paper — four radial masks with `mask-composite: intersect` — in
  `home-webinar-ticket.css` with its baseline entry, your CODEOWNERS review; `LocalTimeZonePipe`, lucide
  calendar/clock; the artwork falls back to the design's banner on error), `HomeWebinar` in
  `models/home-sections.model.ts`, `MOCK_HOME_WEBINAR` in `testing/mocks/home.mock.ts`, a story in three
  states (highlighted, no session, no artwork).
- `home.ts`: `webinar = signal<HomeWebinar | null>(null)` with the API flag; the sidenav becomes a `computed`
  whose "Live Webinar" entry shows only with a row; both ticket actions go to the webinar's page through
  `Utils.navigateToCourse` until the registration dialog is promoted out of `features/offerings` (F5).
  `home.html`: `#webinar` inside `@if (webinar())`, so without data there is no section, no placeholder and
  no shift. The pricing card's webinar line stays text until the section has data.
- Gates (local macOS, Node 24.15, **not CI**): `pnpm lint` 0 errors / 109 legacy warnings, structure check
  passed (new stylesheet entry accepted); `tsc` clean; `pnpm build:prod` initial 243.25 kB transfer, the two
  known CSS budget warnings.
- `verify.mjs` full run (local macOS, Node 24.15, **not CI**): **7/7 GREEN** (Storybook built the new
  story; bundle 244.7 KB gzip, +0.1 KB, the stale-baseline warning; SSR smoke no drift).
- Server HTML on the dev server: no `#webinar`, no ticket, seven sidenav labels — the page is unchanged
  for visitors until the endpoint exists.
- Storybook (`pnpm storybook`, port 6006): the ticket renders at 1440 (461 px, four mask layers, date and
  time rows, both buttons) and 375 (849 px, no overflow); the pricing card's monthly + yearly story shows
  "$79 / month", "Or", "$948 / year", "Prices in USD.".
- **Asset flag:** `home-v3/webinar-banner.webp` is 403 on the bucket; the no-artwork fallback shows a broken
  image until it is uploaded (F5).

### F8 — 2026-10-07 (uncommitted, branch `perf/MIL-XXX-carousel-init-flood`, stacked on PR5)

**Three causes, three fixes**, all measured on UAT-pointed optimized builds (PR4 build vs this one):

- **The pre-Swiper flood.** `Carousel` rendered every `<swiper-slide>` the moment the browser went idle, then
  awaited the `swiper/element` import; in that window `<swiper-container>` is an unknown element, the slides
  lay out as a vertical stack, and every lazy thumbnail near the viewport started loading. Now the import
  starts as soon as the rail renders (`afterNextRender`, browser only), the slides render only once it has
  resolved (`swiperReady`), and the skeleton stays in flow until `initialize()` has run (`swiperInitialized`)
  — a registered container has an empty shadow root until then, so on its own the row collapsed for a
  frame (a 0.036 shift that appeared with the first cut and is gone). One `<ng-template #skeleton>` serves
  the placeholder, loading and pre-registration phases. Home, mobile: first-rail thumbnails 9 / 3.9 MB →
  3 / 0.5 MB; all images 36 / 4.4 MB → 30 / 1.0 MB. Desktop: 4 / 1.2 MB → 3 / 0.5 MB.
- **The `inline` root.** The Carousel's root `div` was `inline` since the original baseline (no reason
  recorded); it is a block now. Rail height is unchanged (the host is a flex column, where the root's
  `mb-10` counted either way), so no consumer moves; the home placeholders carry that 40px as padding.
- **The streaming gap.** The last 0.024 desktop shift was not the Carousel: at ~450ms, before hydration,
  the first rail jumped 80px because v4's `space-y` is a margin on every child but the last, and while the
  HTML streams the hero is briefly the last child. The two home wrappers use flex `gap` now. Desktop CLS
  0.024 → 0.001 (two runs); mobile 0.010 → 0.008 (what remains is the header's font swap).
- Lighthouse mobile LCP/SI stayed noisy (17–26 s across runs of either build) because UAT's TTFB spiked to
  1–5 s during the runs; the LCP element is unchanged (a hero-grid card on mobile, a first-rail thumbnail
  on desktop). Desktop perf 76–77, LCP 3.7–4.1 s, SI 1.4–1.7 s.
- Consumers: eight templates render `app-carousel`; the SSR smoke's masterclass route is unchanged, and the
  component's inputs, outputs and classes are untouched. Not exercised in the pane (hidden): the `peek`
  variant on the AI Labs page and the podcast hover cards — both only change when Swiper initialises,
  which this PR moves earlier, not later.
- Gates (local macOS, Node 24.15, **not CI**): `verify.mjs` full run **7/7 GREEN** (before the final
  `gap` edit; `pnpm lint`, the UAT build and `pnpm build:prod` ran after it), lint 0 errors / 109 legacy
  warnings, structure check passed, `build:prod` initial 243.30 kB.
