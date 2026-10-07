# Home redesign — Jira tickets and PR guide

Companion to `prompts/home-redesign.md` (the approved plan and the per-PR reports). This file is what you
paste into Jira and what you follow to ship the branches. Written 2026-10-07; updated the same day after the
tickets were issued, the branches renamed and the combined F1 + F2 commit split.

**State of the branches:** nine commits stacked on `master`, one per branch, in this order. Everything up to
F4 was pushed to `origin` under the old `MIL-XXX` names (§2 cleans that up); no PR exists yet.

| #   | Ticket  | Branch                                          | Commit          | Size                                                              |
| --- | ------- | ----------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| 1   | MIL-27  | `refactor/MIL-27-promote-masterclass-home-read` | `b9b9258`       | 25 files, +615 / −165 (three renames, 14 one-line import moves)   |
| 2   | MIL-29  | `feat/MIL-29-home-sections`                     | `179c6d7`       | 6 files, +315 / −263                                              |
| 3   | MIL-30  | `feat/MIL-30-home-hero-grid`                    | `2eadb8a`       | 14 files, +474 / −158 (74 lines are the generated thumbnail list) |
| 4   | MIL-31  | `feat/MIL-31-home-pricing-app-download`         | `71dd05a`       | 15 files, +473 / −236                                             |
| 5   | MIL-32  | `feat/MIL-32-home-webinar-ticket`               | `a524fc8`       | 12 files, +322 / −18                                              |
| 6   | MIL-33  | `perf/MIL-33-carousel-init-flood`               | `5199264`       | 5 files, +141 / −62                                               |
| 7   | MIL-34  | `perf/MIL-34-self-host-fonts`                   | `0ca8d40`       | 8 files, +218 / −14                                               |
| 8   | MIL-35  | `feat/MIL-35-ai-labs-ring-v3`                   | staged (§3.1)   | 6 files, +344 / −99                                               |
| 9   | pending | `feat/MIL-XXX-caira-stack-v3`                   | unstaged (§3.1) | 6 files, +306 / −117, plus the docs commit                        |

---

## 1. Tickets — paste into Jira

Template: `docs/engineering/jira-ticket-template.md`. Summary = PR title = squash-commit title. Every
acceptance list ends with the gates line the template asks for; the environment for the recorded results is
**local macOS, Node 24.15, not CI**.

### 1.0 Parent (Story / epic)

**Summary:** `feat(home): redesign the home page on the masterclass home-page API`
**Issue type:** Story (parent) · **Component / scope:** home, shared, core
**Links:** `prompts/home-redesign.md` · Figma "Home Page" `2175:21139` · Postman `web-api/v1/masterclass/home-page/` · children below

**Context.** The v3 repo carries the approved home redesign (2026-09-25). This repo still shipped the old
home (video hero, browser-only v2 track rails, offerings laptop, plan benefits). Guests land on it first, so
its load performance is the product's first impression.

**Current behaviour.** `features/home` renders the old sections from `FeatureFacade` v2 reads that only run in
the browser; the masterclass page already reads `home-page/` (`pages/masterclass/masterclass.ts`).

**Expected behaviour.** The v3 sections in order — hero, track rails, (webinar), AI Labs ring, CAIRA stack,
pricing, app download, FAQ — with the rails on `web-api/v1/masterclass/home-page/`, no v3 API adopted,
pricing and the webinar ticket designed with their API flagged, and page performance as the first acceptance
criterion.

**Scope.** In: children 1–9. Out: the backend asks (§1.10), the baseline re-records (§1.11), F3 / F5 / F7 / F9
in the prompt.

**Acceptance criteria.**

- [ ] Sections render in order on `/us/accounting/home`; `/us/accounting/masterclass` unchanged.
- [ ] Initial bundle within +1.3 kB of the pre-series 242.53 kB transfer (it is 243.88 kB after all children);
      three.js, gsap and Swiper stay out of the initial set.
- [ ] Desktop Lighthouse CLS ≤ 0.05 and the home page's own layout shifts at 0.001 (measured); mobile LCP
      element is a 30 KB hero-grid card.
- [ ] Visual parity at 375 / 768 / 1440 with every intentional difference listed in the child PRs.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

**How to verify.** `pnpm start` → http://localhost:4101/us/accounting/home at 375 / 768 / 1440; the SSR server
(`pnpm build && pnpm serve:ssr:miles-masterclass-v3` → http://localhost:4000/us/accounting/home) for the
server HTML checks in the prompt's "Verification" section.

**Risks / open questions.** See §1.10: production answers 404 for `home-page/` today, and every `v2/` read
answers 404 on this repo's API host. **Estimate:** L — split into the children below.

---

### 1.1 Child — PR1

**Summary:** `refactor(core): promote the masterclass home-page read for the home page`
**Issue type:** Tech debt · **Component / scope:** core, shared, offerings
**Branch:** `refactor/MIL-<n>-promote-masterclass-home-read` · **Links:** parent · `prompts/home-redesign.md` (D1–D3, PR1 report)

**Context.** Home will render the same tracks as the masterclass page, and `features/home` may not import
`features/offerings` (ESLint boundaries). The read, its model and the card have to move up.

**Current behaviour.** The `home-page/` `httpResource`, `parseHomePage` and `MasterclassCourseCard` live inside
`features/offerings/masterclass`; the card's `[routerLink]="[c.id, c.slug]"` is relative and would resolve
under `/home`.

**Expected behaviour.** A root `MasterclassHomeFacade` in `core/services/` owns the read (one fetch shared by
both routes, reused across navigation); the model is in `core/models/`; `withPreviousValue` is in
`core/utils/`; the card is in `shared/components/cards/` with absolute links and a story. No visual change.

**Scope.** In: the moves above, the masterclass page rebound to the facade, the card story, `MockUtils`
locale signals. Out: any home page change (PR2).

**Acceptance criteria.**

- [ ] `/us/accounting/masterclass` renders the same rails; the trailer dialog opens; card hrefs are
      `/us/accounting/masterclass/<uuid>/<slug>`.
- [ ] A client-side round trip masterclass → home → masterclass makes no second `home-page/` request.
- [ ] `pnpm lint` passes the boundary rules; no feature imports another feature.
- [ ] `pnpm lint`, `pnpm build:prod` green (recorded: 0 errors / 110 legacy warnings; 242.56 kB initial).

**How to verify.** `pnpm start` → http://localhost:4101/us/accounting/masterclass: 3 rails (21 / 34 / 13 cards on
UAT), click a card (absolute URL), click Trailer, navigate home and back with the Network panel open.

**Risks / assumptions.** The facade is root (precedent `FeatureFacade`), so a failed load shows the error state
on both pages until `reload()`. **Estimate:** M.

---

### 1.2 Child — PR2

**Summary:** `feat(home): rebuild the sections on the masterclass home-page tracks`
**Issue type:** Story · **Component / scope:** home, core
**Branch:** `feat/MIL-<n>-home-sections` · **Links:** parent · PR1 (depends on) · prompt D4, D11, D12, PR2 report

**Context.** First of the home PRs: the v3 section order and the rails on the shared facade, with the old hero
kept for one more PR so TTFB and LCP effects can be measured separately.

**Current behaviour.** Old sections, v2 rails fetched in the browser only, offerings laptop with 9 MB of video,
plan benefits, coming soon.

**Expected behaviour.** Hero (old) → rails from `MasterclassHomeFacade` with the horizontal course card, every
rail `@defer (on viewport)` behind a geometry-matching placeholder → AI Labs ring → CAIRA stack
(`hydrate on viewport`) → plan (plan-benefits until PR4) → app download → FAQ (`hydrate on viewport`). The
facade's server fetch is opt-in (`fetchOnServer`): the masterclass page opts in, home fetches in the browser
behind a server-rendered skeleton.

**Scope.** In: `home.{ts,html}`, the facade flag and `isSettled`, the masterclass page opting in. Out: the hero
(PR3), pricing (PR4), webinar (PR5), any shared deletion.

**Acceptance criteria.**

- [ ] Rails show the same tracks as `/masterclass`; placeholders match the rail height at 375 / 768 / 1440.
- [ ] Server HTML of `/us/accounting/home` carries the rails skeleton, the CAIRA stack, app download and 42
      FAQ items, no `<swiper-container>` or `<canvas>`; ≈ 49 KB gzip.
- [ ] No gsap or three.js request before their sections are scrolled to.
- [ ] Lighthouse desktop total bytes ≤ 10 MB (was 13.1), CLS ≤ 0.02 (was 0.037); recorded numbers in the prompt.
- [ ] `pnpm lint`, `pnpm build:prod` green (recorded 242.69 kB initial).

**How to verify.** http://localhost:4101/us/accounting/home: section order, first rail renders after one
`home-page/` request, rails 2–3 appear on scroll; `curl` the SSR HTML per the prompt.

**Risks / open questions.** Signed-in visitors get the rails after hydration (the server never fetches
`post_login`). **Production answers 404 for `home-page/`** — the rails show their error state there until the
backend serves the route (§1.10). **Estimate:** M.

---

### 1.3 Child — PR3

**Summary:** `feat(home): redesign the hero with the CAIRA copy and the course grid`
**Issue type:** Story · **Component / scope:** home, shared
**Branch:** `feat/MIL-<n>-home-hero-grid` · **Links:** parent · PR2 (depends on) · Figma `2175:21140` · prompt D5, D10, PR3 report

**Context.** The LCP of the old home was the hero's two video posters (390 + 251 KB) and a 3–5 MB video.

**Current behaviour.** Video hero with "Download App" CTA; mobile Lighthouse LCP 18–19 s simulated.

**Expected behaviour.** CAIRA logo (`priority`), the single `<h1>` "The AI Credential / Built for Accountants",
meta row, two crawlable CTAs (`ai-labs`, `caira`) over a tilted four-column grid of 64 pre-compressed course
thumbnails on a 40 s CSS loop, rendered on the server with no API call. Grid images are plain `<img>` with
tiered loading (four eager per visible column, the two fully in view at high priority, the rest lazy and low)
and `vw` geometry so a scrollbar appearing mid-stream cannot move it.

**Scope.** In: `home-hero`, new `home-hero-grid` (+ CSS with a `structure-baseline.json` entry), `home-assets`,
a `priority` input on the course card used for the first rail's first three cards, Carousel `skeletonClass`.
Out: the snapshot script that regenerates the thumbnail list (F3).

**Acceptance criteria.**

- [ ] Server HTML: one `<h1>` with the new copy, a `<link rel="preload" as="image">` for the logo, 64 grid
      `<img>` (13 eager, 8 `fetchpriority="high"`), CTAs as `<a href>`, no video or poster.
- [ ] No horizontal overflow at 375 / 768 / 1440; the strip loops; `prefers-reduced-motion` stops it.
- [ ] Lighthouse desktop total ≤ 4.5 MB (was 8.1), media 0; CLS from the grid 0 (scrollbar test).
- [ ] `pnpm lint` (structure check accepts the one new stylesheet entry), `pnpm build:prod` green (242.79 kB).

**How to verify.** http://localhost:4101/us/accounting/home at the three widths; `curl` greps in the prompt;
Lighthouse desktop + mobile against the SSR server.

**Risks / assumptions.** Intentional differences from v3: all-tiered grid loading, 8 cards per column, the
hero's "Download App" CTA replaced by the design's two CTAs. The desktop LCP is now a first-rail course
thumbnail the API serves at up to 716 KB (§1.10). **Estimate:** M (over 400 lines only by the generated list).

---

### 1.4 Child — PR4

**Summary:** `feat(home): add the pricing section and redesign the app download`
**Issue type:** Story · **Component / scope:** home, shared
**Branch:** `feat/MIL-<n>-home-pricing-app-download` · **Links:** parent · PR3 (depends on) · Figma `2175:26155`, `2175:26203` · prompt D6, D8, D9, PR4 report

**Context.** Two more v3 sections; the plan-price source is not confirmed, so the pricing card ships without
figures, and the app-download section is shared with the UAE CAIRA page.

**Current behaviour.** `#plan` is the old plan-benefits copy with no price; app download is the old design.

**Expected behaviour.** `home-pricing` (presentational; nullable `price` input, unbound on the page; crawlable
"Subscribe Now" and "Talk to us"; story in three states fed by `testing/mocks/home.mock.ts`) behind
`hydrate on viewport`; `shared/components/app-download` redesigned in place (points, desktop QR, store badges,
animated download mark); three `@theme` animation tokens; `uae-caira` wraps the section in its gutter.

**Scope.** In: the above, `models/home-sections.model.ts`, placeholders re-measured. Out: fetching prices (F5).

**Acceptance criteria.**

- [ ] The figure block is hidden on the page and present in Storybook (`Home/HomePricing`).
- [ ] Both sections render at 375 / 768 / 1440 with no overflow; animations run; `/ae/accounting/home` shows
      the new app-download inside its gutter.
- [ ] `app-download.ts` no longer in `LEGACY_ANY_FILES` (warnings 110 → 109).
- [ ] `pnpm lint`, `pnpm build:prod`, `pnpm build-storybook` green (243.18 kB initial).

**How to verify.** http://localhost:4101/us/accounting/home `#plan` and `#app-download`; `pnpm storybook` →
Home / HomePricing; http://localhost:4101/ae/accounting/home.

**Risks / assumptions.** A pricing section without a price mirrors today's behaviour; the alternative (keep
plan-benefits until the endpoint exists) is noted in the prompt. **Estimate:** M.

---

### 1.5 Child — PR5

**Summary:** `feat(home): add the live webinar ticket`
**Issue type:** Story · **Component / scope:** home
**Branch:** `feat/MIL-<n>-home-webinar-ticket` · **Links:** parent · PR4 (depends on) · Figma `2175:21750` · prompt D6, PR5 report

**Context.** The design's ticket needs a highlight-webinar endpoint this app does not have (v3 read
`v2/webinar/home_section`, not adopted).

**Current behaviour.** No webinar section on home.

**Expected behaviour.** `home-webinar-ticket` (presentational: required `webinar` input, `register` / `knowMore`
outputs, CSS ticket paper with a `structure-baseline.json` entry, story in three states) and `HomeWebinar` in
the models; the page holds `webinar = signal(null)` with the API flag, so the section and its sidenav entry
are absent until a row exists; both actions open the webinar page until the registration dialog is promoted
(F5).

**Scope.** In: the above. Out: the endpoint, the dialog promotion, the `webinar-banner.webp` upload (§1.11).

**Acceptance criteria.**

- [ ] Server HTML has no `#webinar` and seven sidenav labels — no visitor-visible change.
- [ ] Storybook `Home/HomeWebinarTicket` renders at 1440 and 375 with the perforated paper, date/time rows and
      both buttons.
- [ ] `pnpm lint` (one new stylesheet entry), `pnpm build:prod`, `pnpm build-storybook` green (243.25 kB).

**How to verify.** `pnpm storybook` → Home / HomeWebinarTicket (Highlighted, NoSession, NoArtwork);
`curl -s localhost:4101/us/accounting/home | grep -c 'id="webinar"'` → 0.

**Risks / assumptions.** The NoArtwork fallback asset is 403 on the bucket today. **Estimate:** S–M.

---

### 1.6 Child — F8

**Summary:** `perf(shared): render carousel slides only once Swiper is registered`
**Issue type:** Tech debt · **Component / scope:** shared, home
**Branch:** `perf/MIL-<n>-carousel-init-flood` · **Links:** parent · PR5 (stacked on) · prompt F8 report

**Context.** Every rail page loaded far more thumbnails than it showed, and the home rails shifted.

**Current behaviour.** `Carousel` rendered every slide at idle, then imported `swiper/element`; while the
element was unknown the slides stacked vertically and every lazy thumbnail near the viewport loaded (nine
first-rail thumbnails, 3.9 MB, for 1.1 visible slides on a phone). Its root was `inline` since the baseline.

**Expected behaviour.** The Swiper import starts when a rail renders; slides render once Swiper is registered;
the skeleton stays in flow until `initialize()`; one shared skeleton template; the root is a block. Home's
placeholders use padding instead of a margin the flex host never collapsed, and the two page wrappers use flex
`gap` instead of `space-y` (whose last-child margin shifted the first rail 80 px while the HTML streamed).

**Scope.** In: `carousel.{ts,html}`, `home.html`. Out: the eight consumers' own templates (unchanged).

**Acceptance criteria.**

- [ ] Home mobile: first-rail thumbnails at load ≤ 3 (was 9), image bytes ≤ 1.2 MB (was 4.4).
- [ ] Desktop Lighthouse CLS ≤ 0.005 (was 0.024); rail height unchanged on every consumer.
- [ ] `pnpm lint`, `pnpm build:prod` green (243.30 kB).

**How to verify.** Lighthouse mobile + desktop on the SSR build before/after; the eight `app-carousel`
templates (masterclass, podcast, micro-learning, home, partners, ai-labs peek, uae-caira, course-related).

**Risks / assumptions.** The `peek` variant and podcast hover cards change only when Swiper initialises, which
this moves earlier, not later; not exercised in-pane. **Estimate:** S.

---

### 1.7 Child — F4

**Summary:** `perf(core): self-host the web fonts`
**Issue type:** Tech debt · **Component / scope:** core
**Branch:** `perf/MIL-<n>-self-host-fonts` · **Links:** parent · F8 (stacked on) · prompt F4 report

**Context.** Every page loaded a render-blocking stylesheet from `fonts.googleapis.com` and files from
`fonts.gstatic.com`; the swap moved the header on every load.

**Expected behaviour.** Inter, Inter Tight, JetBrains Mono and Source Serif 4 from the app via the
`@fontsource-variable` packages (OFL, the same files Google serves); `src/styles/fonts.css` declares latin and
latin-ext with `unicode-range`, swap display and the weight ranges Google served; `Inter Fallback` (Arial with
Inter's metrics) second in `--font-sans` / `--font-numeric`; the Google link and preconnects removed.

**Scope.** In: four dependencies, `fonts.css`, `angular.json` styles, token edits, `index.html`. Out: Arabic
(Noto Sans Arabic still loads from Google at runtime), a font preload (hashed names).

**Acceptance criteria.**

- [ ] No request to `fonts.googleapis.com` / `fonts.gstatic.com`; the home page fetches one 47 KB Inter file.
- [ ] Desktop observed first paint ≤ 0.6 s on the SSR build (was 1.1–1.2 s); glyphs and weights unchanged.
- [ ] `pnpm lint`, `pnpm build:prod` (eight hashed `media/*.woff2`), `pnpm build-storybook` green (243.78 kB).

**How to verify.** `document.fonts` on the SSR build; Lighthouse before/after; the AI Labs hero (serif) and a
`font-mono` page.

**Risks / assumptions.** `font-extrabold` still resolves to 700 for Inter, as before; widen the range to opt
in. **Estimate:** S–M.

---

### 1.8 Child — F1

**Summary:** `feat(shared): port the v3 AI Labs ring visuals`
**Issue type:** Story · **Component / scope:** shared, home
**Branch:** `feat/MIL-<n>-ai-labs-ring-v3` · **Links:** parent · F4 (stacked on) · Figma `2175:26040` · prompt F1 report

**Current behaviour.** Concave ring, "Every AI Lab, hands-on." header, no proof points.

**Expected behaviour.** `RingShape` in the three.js engine (concave / convex / flat), `shape` input, the
design's header and three proof-point cards, 4:3 / 16:9 / 2:1 stage; home passes `shape="convex"` behind a
two-part placeholder at the measured heights. The data layer (`v2/tracks/7/courses/`) is unchanged.

**Acceptance criteria.**

- [ ] With course data, the convex ring draws with WebGL at 1440 / 768 (`data-webgl="on"`) and the fallback
      row shows at 375; header and three proof cards render; no overflow.
- [ ] The engine stays a lazy chunk (546 kB raw / 114 kB transfer), absent from the initial set.
- [ ] `pnpm lint`, `pnpm build:prod` green (243.75 kB).

**How to verify.** The endpoint is 404 on this repo's hosts (§1.10), so verify against a mocked response
(headless Chrome script in the F1 report) or after the v2 host decision.

**Risks / open questions.** When the fetch fails the section renders nothing and its placeholder collapses (the
UAT state today). **Estimate:** M.

---

### 1.9 Child — F2

**Summary:** `feat(shared): port the v3 CAIRA stack cross-fade`
**Issue type:** Story · **Component / scope:** shared, home
**Branch:** `feat/MIL-<n>-caira-stack-v3` · **Links:** parent · F1 (stacked on) · Figma `2595:13785` · prompt F2 report

**Current behaviour.** Cards pin one under another with `pinSpacing: false`; "Be an Certified" typo.

**Expected behaviour.** On md+ the grid pins once centred and one scrubbed timeline cross-fades the cards in
place over 1700 px of scroll with a "more below" cue; the server, pre-GSAP and reduced-motion renders are one
card tall; below md a snap carousel with dots; copy fixed. Home's placeholder 539 / 351 / 336 px.

**Acceptance criteria.**

- [ ] Desktop: the pin spacer appears (~2036 px) and cards recede and fade as the page scrolls; phones: three
      dots and a swipeable carousel; no overflow.
- [ ] gsap stays a lazy chunk, fetched only when the section nears the viewport.
- [ ] `pnpm lint`, `pnpm build:prod` green (243.78 kB).

**How to verify.** http://localhost:4101/us/accounting/home, scroll through `#caira-levels` at 1440 and 375.

**Risks / assumptions.** The per-card tilt is not bound (as in v3); the values remain. **Estimate:** S–M.

---

### 1.10 Backend asks (one ticket each, Task, component "backend")

1. **`web-api/v1/masterclass/home-page/` on production.** `api.milescaira.com` answers 404 (UAT serves it).
   Until it exists, the masterclass page (merged, #64) and PR2's home rails show their error state in
   production. Blocks the production deploy of PR2.
2. **The `v2/` base URL.** Every `v2/` path this app calls (ring `v2/tracks/7/courses/`, CAIRA ladder
   `v2/caira-badges/`, the `FeatureFacade` feeds, webinar v2) answers 404 on `(uat-)api.milescaira.com` and
   with rows on the previous host `(uat-)api.milesmasterclass.com/api/`. Decide: a second base URL for v2, or
   `web-api` twins. Affects master today, not only these PRs.
3. **A lighter card projection for `home-page/`.** The cards read 13 KB gzip of the 54 KB body; `description`
   alone is 102 KB raw. A `?fields=` or card projection cuts the masterclass HTML by ~40 KB gzip.
4. **Resized course thumbnails.** Originals are 240–716 KB; the four visible first-rail cards cost 1.2 MB on
   desktop and are the home page's LCP element. Need resized variants or CDN resizing.
5. **Highlight-webinar endpoint on `web-api`** (for PR5's ticket) and **the plan-price source of truth** (for
   PR4's figures).

### 1.11 Yours (no engineering ticket needed, or a chore)

- Re-record `docs/refactor/baseline/bundle.json` (stale since 2026-09-24) and add `/us/accounting/home` to
  `docs/refactor/smoke-routes.json`, then re-record the SSR baseline (nine partner routes are "not in
  baseline" today).
- Upload `static-assests/web-app/home-v3/webinar-banner.webp` to the asset bucket (403 today).
- Review the two `structure-baseline.json` entries (PR3 `home-hero-grid.css`, PR5 `home-webinar-ticket.css`)
  as CODEOWNER.

---

## 2. Branch names and the remote

The branches were renamed to their tickets on 2026-10-07 (MIL-27, MIL-29–35; the table above). Two things
remain before the PRs:

- **The `needs-uat` label does not exist in the repo yet.** Create it once:

  ```bash
  gh label create needs-uat --color D93F0B --description "Needs UAT sign-off before merge"
  ```

- **The old `MIL-XXX` branches are on `origin`** (pushed before the rename; the `branch-name` check fails on
  them). After every renamed branch has been pushed by its §4 block, delete them:

  ```bash
  git push origin --delete refactor/MIL-XXX-promote-masterclass-home-read feat/MIL-XXX-home-sections feat/MIL-XXX-home-hero-grid feat/MIL-XXX-home-pricing-app-download feat/MIL-XXX-home-webinar-ticket perf/MIL-XXX-self-host-fonts feat/MIL-XXX-ai-labs-ring-v3
  ```

  `perf/MIL-33-carousel-init-flood` was already pushed under its new name. The commit messages do not carry
  the ticket; the PR description does (`Ticket: MIL-<n>`), per the template.

---

## 3. PR guide — stacked branches, one PR each, in order

The branches depend on each other (each was cut from the previous), and `master` is squash-merge only, so
follow the playbook's **Flow E** (`docs/engineering/git-playbook.md` §8): every PR's base is `master`, later
PRs open as drafts marked "Depends on #…", and after each squash-merge the next branch is rebased `--onto
master` to drop the already-merged commit. Never set a PR's base to another branch.

### 3.1 Split the last commit (F1 + F2) — staged; two commits are yours

Done on 2026-10-07 with Recipe 5. `feat/MIL-35-ai-labs-ring-v3` points at `0ca8d40` (F4) with the ring's
changes **staged** (6 files, +344 / −99: `surround-carousel/*`, the ring slot and its placeholder in
`home.html`, the F1 report and "Now" entry) and the CAIRA stack's changes **unstaged** (6 files, +306 / −117:
`caira-level-stack/*`, the `#caira-levels` placeholder heights and the `#app-download` gutter in `home.html`,
the F2 report and "Now" entry). The working tree is byte-identical to the old `b901985`, which stays in the
reflog and on `origin/feat/MIL-XXX-ai-labs-ring-v3` until §2 deletes it. This file, the prompt's status line
and the STATE entry are parked in the session scratchpad. Run, in order:

```bash
S=/private/tmp/claude-503/-Users-SACHIN-SINGH-Documents-GitHub-miles-masterclass/9988e81a-96ac-4b70-9bb9-49dcfd34f2c0/scratchpad/split
git commit -m "feat(shared): port the v3 AI Labs ring visuals"
git checkout -b feat/MIL-XXX-caira-stack-v3      # rename to the F2 ticket once it exists
git add -A
git commit -m "feat(shared): port the v3 CAIRA stack cross-fade"
cp "$S/home-redesign-delivery.md" docs/ && cp "$S/home-redesign.md.final" prompts/home-redesign.md && cp "$S/STATE.md.final" docs/refactor/STATE.md
git add -A
git commit -m "docs(home): add the Jira tickets and PR guide for the redesign branches"
```

The docs commit rides on the F2 branch, so that PR carries two commits; the squash keeps the F2 title.

### 3.2 Open the PRs

Section 4 has one ready-to-run block per PR: it pushes the branch under its new name and opens the PR with
the template filled in. Run them in table order, after the §2 label exists. What the blocks encode:

- **Title:** the commit subject, verbatim (`pr-title` wants a Conventional Commit; the squash commit takes
  it).
- **Description:** the template, every section filled; "How to test" = the ticket's "How to verify"; the
  **intentional differences** listed for PR3, PR4 and F4; the `structure-baseline.json` entries called out in
  PR3 and PR5. Screenshots cannot be attached from the CLI, so each body says which captures to add.
- **PR1** opens **Ready for review**. **PR2 onward** open as **drafts** whose first line names the PR they
  depend on (Flow E). Their "Files changed" shows the earlier branches' changes too until the rebase in §3.3.
- **UAT sign-off (Flow B)** for **PR2, PR3 and PR4** (the visible redesign and its SSR output): those carry
  the `needs-uat` label and "⚠️ Needs UAT sign-off — do not merge"; the release owner puts the branch on
  `uat` (`uat.milesmasterclass.us`). F1 and F2 render empty on UAT until the v2 host decision; their bodies
  say so.
- CI checks that must be green: `verify`, `commitlint`, `pr-title`, `branch-name`.

### 3.3 Merge, then unstack the next branch

Repeat for each PR, in order. After PR _k_ is **squash-merged** (the author merges; GitHub deletes the remote
branch), and **before** deleting the merged local branch:

```bash
git fetch origin
git rebase --onto origin/master <merged-local-branch> <next-local-branch>
git push --force-with-lease
```

Using the local branch names means no SHAs to look up. The order: MIL-27 → MIL-29 → MIL-30 → MIL-31 →
MIL-32 → MIL-33 → MIL-34 → MIL-35 → F2. After the rebase the next PR's "Files changed" shows only its own
commit; remove the "Depends on" line, mark **Ready for review**, request the CODEOWNER review
(`@me-sachin-singh`).

If a rebase conflicts, it is in `home.html`, `prompts/home-redesign.md` or `docs/refactor/STATE.md` (the files
several PRs touch): keep the incoming (later) branch's version of the section being rebased and re-run
`pnpm lint`.

### 3.4 Before merging PR2 to production

PR2 is the first PR that changes what visitors see, and production's API answers 404 for `home-page/` today
(§1.10 #1), so merging it deploys a home page whose rails show "We couldn't load the masterclasses" until the
backend ships the route. Either hold PR2 at **approved, not merged** until the endpoint is live in production,
or accept the error state knowingly (the masterclass page already shows it there). PR1 can merge any time.

### 3.5 After each merge

```bash
git checkout master && git pull && git branch -D <merged-branch>
```

Watch production for a few minutes (Flow A step 8). After the last merge: re-record the two baselines
(§1.11) and update the Status line at the top of `prompts/home-redesign.md`.

### 3.6 What reviewers should look at, per PR

| PR  | Look at                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| PR1 | The facade is root and only pages inject it; the absolute link in the card; the 14 import moves are mechanical.                      |
| PR2 | `fetchOnServer` opt-in and why; the rail placeholder geometry; nothing shared deleted.                                               |
| PR3 | The grid's loading tiers and `vw` maths in `home-hero-grid.css` (baseline entry); the single `<h1>`; `priority` on three cards only. |
| PR4 | The pricing card has no data path yet (by decision); the three `@theme` tokens; `uae-caira` wrapper.                                 |
| PR5 | The ticket renders nothing on the page; the mask CSS (baseline entry); outputs navigate until F5.                                    |
| F8  | `swiperReady` / `swiperInitialized` sequencing; the root `block`; the `gap` wrappers.                                                |
| F4  | Weight ranges match what Google served; the `Inter Fallback` metrics; Arabic path untouched.                                         |
| F1  | Engine `SHAPES` and `BAND_LIFT`; the proxy hack intentionally left out; the collapse risk when the fetch fails.                      |
| F2  | The one-card-tall `.cards` on md+; pin spacer length; reduced-motion fallback.                                                       |

---

## 4. Ready-to-run PR blocks

Each block checks out the branch, pushes it under its new name and opens the PR against `master` with the
template filled in (`gh` is signed in as `me-sachin-singh`; the repo is `MilesEducation-Tech/miles-masterclass`).
Run them in order after §2's label exists and §3.1's commits are in. The gates (`pnpm lint`,
`pnpm build:prod`) were run on every branch when it was committed; CI runs them again. After each block,
attach the screenshots its body lists on the PR page.

### 4.1 PR1 — MIL-27 (ready for review)

```bash
git checkout refactor/MIL-27-promote-masterclass-home-read
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
## What

Moves the masterclass `home-page/` read into a root `MasterclassHomeFacade` in core, its model into `core/models`, `withPreviousValue` into `core/utils` and the course card into `shared/components/cards`, so the home page can render the same tracks without importing the offerings feature. The masterclass page is rebound to the facade. No visual change.

## Why

Ticket: MIL-27
The home redesign (MIL-29 onward) renders the masterclass tracks, and a feature may not import another feature. The card's relative `routerLink` would also have resolved under `/home`, so its links are now absolute.

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/masterclass — the same three rails as before; a card links to `/us/accounting/masterclass/<uuid>/<slug>`; Trailer opens the dialog.
2. With the Network panel open, navigate masterclass → home → masterclass: one `home-page/` request in total.
3. `pnpm storybook` → Cards / MasterclassCourseCard renders.

## Screenshots / recordings

No visual change: `/us/accounting/masterclass` is identical at 375 and 1440 before and after (attach both if the reviewer wants proof).

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod` pass locally (macOS, Node 24.15; initial 242.56 kB)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries
- [x] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [x] Reads are `httpResource` in a facade, guarded with `hasValue()`, with loading and error states (§4.2)
- [x] Nothing above the fold is `@defer`red; heavy libraries load lazily (§4.4–§4.5)
- [x] Tailwind utilities and `@theme` tokens; no new component CSS (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; no intentional visual differences
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master \
  --title "refactor(core): promote the masterclass home-page read for the home page" --body-file /tmp/pr-body.md
```

### 4.2 PR2 — MIL-29 (draft, needs UAT)

```bash
git checkout feat/MIL-29-home-sections
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
⚠️ Needs UAT sign-off — do not merge. Depends on the `refactor/MIL-27-promote-masterclass-home-read` PR — merge that first.

## What

Rebuilds the home page in the v3 section order on the shared `home-page/` tracks: one horizontal rail per track behind viewport-deferred, geometry-matched placeholders, then the AI Labs ring, the CAIRA stack, plan, app download and FAQ (`hydrate on viewport`). The facade's server fetch becomes opt-in: the masterclass page opts in, home fetches in the browser behind a server-rendered skeleton. The old hero stays until MIL-30.

## Why

Ticket: MIL-29
First visible step of the redesign. The old home fetched v2 rails in the browser only and shipped 9 MB of hero media; the new rails reuse the masterclass read, and the server HTML stays small (≈ 49 KB gzip).

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/home — sections in order; the first rail renders after one `home-page/` request; rails 2 and 3 render when scrolled to; no gsap or three.js request before their sections.
2. `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then `curl -s localhost:4000/us/accounting/home | grep -c swiper-container` → 0; the rails skeleton, the CAIRA stack and 42 FAQ items are in the HTML.
3. Lighthouse desktop against port 4000: total bytes ≤ 10 MB (was 13.1), CLS ≤ 0.02 (was 0.037). Before/after numbers in `prompts/home-redesign.md`, PR2 report.

Production answers 404 for `home-page/` today, so after deploy the rails show their error state until the backend serves the route (the masterclass page already does). Hold at approved or merge knowingly.

## Screenshots / recordings

Attach 375 and 1440 of `/us/accounting/home`: the rails, the ring placeholder, the CAIRA stack, the FAQ.

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod` pass locally (macOS, Node 24.15; initial 242.69 kB)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries
- [x] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [x] Reads are `httpResource` in a facade, guarded with `hasValue()`, with loading and error states (§4.2)
- [x] Nothing above the fold is `@defer`red; three.js, gsap and Swiper stay lazy (§4.4–§4.5)
- [x] Tailwind utilities and `@theme` tokens; no new component CSS (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; UAT sign-off pending; no intentional visual differences beyond the new section order
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft --label needs-uat \
  --title "feat(home): rebuild the sections on the masterclass home-page tracks" --body-file /tmp/pr-body.md
```

### 4.3 PR3 — MIL-30 (draft, needs UAT)

```bash
git checkout feat/MIL-30-home-hero-grid
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
⚠️ Needs UAT sign-off — do not merge. Depends on the `feat/MIL-29-home-sections` PR — merge that first.

## What

Replaces the video hero with the design's CAIRA hero: the logo (`priority`), the single `<h1>` "The AI Credential / Built for Accountants", the meta row and two crawlable CTAs over a tilted four-column grid of 64 pre-compressed course thumbnails on a 40 s CSS loop, rendered on the server with no API call. The first rail's first three cards get `priority`.

## Why

Ticket: MIL-30
The old hero's two posters and a 3–5 MB video were the LCP. The grid is plain `<img>` with tiered loading (four eager per visible column, the two in view at high priority, the rest lazy and low) and `vw` geometry, so a scrollbar appearing mid-stream cannot move it.

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/home — logo, h1, CTAs to `/us/accounting/ai-labs` and `/us/accounting/caira`; the grid loops; no horizontal overflow at 375 / 768 / 1440; `prefers-reduced-motion` stops it.
2. SSR build on port 4000: `curl -s localhost:4000/us/accounting/home | grep -c '<h1'` → 1; `grep -o 'rel="preload" as="image"'` → the logo; `grep -o 'home-hero-grid/processed_' | wc -l` → 64; `grep -o 'loading="eager"' | wc -l` → 13; no `<video`.
3. Lighthouse desktop: total ≤ 4.5 MB (was 8.1), media 0; CLS from the grid 0 with the classic scrollbar. Numbers in `prompts/home-redesign.md`, PR3 report.

## Screenshots / recordings

Attach 375 and 1440 of the hero. Intentional differences from the v3 repo: tiered grid loading and 8 cards per column (performance; visually identical), and the hero's "Download App" CTA replaced by the design's AI Labs + CAIRA CTAs.

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod` pass locally (macOS, Node 24.15; initial 242.79 kB)
- [x] One new `structure-baseline.json` entry: `home-hero-grid.css` — `cos()` calc, `vw` geometry and the loop keyframe that Tailwind cannot express; no `eslint-disable`, `@ts-ignore` or spec files
- [x] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [x] No new reads; the grid is a static list (§4.2)
- [x] Nothing above the fold is `@defer`red; the hero is in the server HTML (§4.4–§4.5)
- [x] Tailwind utilities; the one component stylesheet is justified above (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; UAT sign-off pending; intentional differences listed above
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft --label needs-uat \
  --title "feat(home): redesign the hero with the CAIRA copy and the course grid" --body-file /tmp/pr-body.md
```

### 4.4 PR4 — MIL-31 (draft, needs UAT)

```bash
git checkout feat/MIL-31-home-pricing-app-download
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
⚠️ Needs UAT sign-off — do not merge. Depends on the `feat/MIL-30-home-hero-grid` PR — merge that first.

## What

Adds the presentational `home-pricing` card (nullable `price` input, unbound on the page; crawlable "Subscribe Now" and "Talk to us"; story in three states) behind `hydrate on viewport`, and redesigns `shared/components/app-download` in place (points, desktop QR, store badges, animated download mark). Three `@theme` animation tokens; `app-download.ts` leaves `LEGACY_ANY_FILES`.

## Why

Ticket: MIL-31
Two more v3 sections. The plan-price source of truth is not confirmed, so the figure block ships hidden (today's plan section has no price either); the app-download section is shared with the UAE CAIRA page, which inherits the new look inside its gutter.

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/home — `#plan` and `#app-download` at 375 / 768 / 1440, no overflow; the glow and download-mark animations run.
2. `pnpm storybook` → Home / HomePricing: WithoutPrice, MonthlyAndYearly, DiscountedYearly show the figure block.
3. http://localhost:4101/ae/accounting/home — the new app-download inside the page's gutter.

## Screenshots / recordings

Attach 375 and 1440 of `#plan` and `#app-download`, plus `/ae/accounting/home`. Intentional differences: no price figures on the page until the endpoint exists (MIL-31 ticket, follow-up F5); the UAE CAIRA page gets the new app-download.

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod`, `pnpm build-storybook` pass locally (macOS, Node 24.15; initial 243.18 kB)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries
- [x] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [x] No new reads; the pricing card is presentational (§4.2)
- [x] Both sections are below the fold and `hydrate on viewport` with sized placeholders (§4.4–§4.5)
- [x] Tailwind utilities and three new `@theme` animation tokens; no component CSS (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; UAT sign-off pending; intentional differences listed above
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft --label needs-uat \
  --title "feat(home): add the pricing section and redesign the app download" --body-file /tmp/pr-body.md
```

### 4.5 PR5 — MIL-32 (draft)

```bash
git checkout feat/MIL-32-home-webinar-ticket
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
Depends on the `feat/MIL-31-home-pricing-app-download` PR — merge that first.

## What

Adds the presentational `home-webinar-ticket` (required `webinar` input, `register` / `knowMore` outputs, CSS ticket paper, story in three states) and the `HomeWebinar` model. The page holds `webinar = signal(null)` with the API flag, so the section and its sidenav entry are absent until a highlight endpoint exists; both actions open the webinar page until the registration dialog is promoted (follow-up F5).

## Why

Ticket: MIL-32
The design's ticket needs a highlight-webinar endpoint on `web-api` that does not exist yet (the v3 repo read `v2/webinar/home_section`, which this app does not adopt). The component is reviewable now in Storybook; visitors see no change.

## How to test

1. `pnpm storybook` → Home / HomeWebinarTicket: Highlighted, NoSession, NoArtwork at 1440 and 375 — perforated paper, date and time rows, both buttons.
2. `pnpm start`, then `curl -s localhost:4101/us/accounting/home | grep -c 'id="webinar"'` → 0; the sidenav has seven entries.

## Screenshots / recordings

Attach the three Storybook states at 375 and 1440. No change on the page itself.

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod`, `pnpm build-storybook` pass locally (macOS, Node 24.15; initial 243.25 kB)
- [x] One new `structure-baseline.json` entry: `home-webinar-ticket.css` — the four-layer `mask-composite: intersect` ticket paper Tailwind cannot express; no `eslint-disable`, `@ts-ignore` or spec files
- [x] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [x] No new reads; the ticket is presentational (§4.2)
- [x] The section is inside `@if (webinar())`, so nothing is deferred or shifted (§4.4–§4.5)
- [x] Tailwind utilities; the one component stylesheet is justified above (§4.6)
- [x] Storybook checked at 375 / 1440 px; no visitor-visible change
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft \
  --title "feat(home): add the live webinar ticket" --body-file /tmp/pr-body.md
```

### 4.6 F8 — MIL-33 (draft)

```bash
git checkout perf/MIL-33-carousel-init-flood
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
Depends on the `feat/MIL-32-home-webinar-ticket` PR — merge that first.

## What

`Carousel` starts the Swiper import when a rail renders, renders its slides only once `swiper/element` is registered, keeps its skeleton in flow until `initialize()`, shares one skeleton template and makes its root a block. Home's placeholders carry the rail's bottom margin as padding, and the two page wrappers use flex `gap` instead of `space-y`.

## Why

Ticket: MIL-33
While `<swiper-container>` was an unknown element the slides stacked vertically and every lazy thumbnail near the viewport loaded: nine first-rail thumbnails (3.9 MB) for 1.1 visible slides on a phone. `space-y`'s margin on all-but-last children shifted the first rail 80 px while the HTML streamed.

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/home at 375 with the Network panel on images: three first-rail thumbnails at load (was nine); rails keep their height while Swiper loads.
2. The eight consumers are unchanged: `/us/accounting/masterclass`, `/podcast`, `/micro-learning`, a partner page, `/ai-labs`, `/ae/accounting/home`, a course page's related rail.
3. Lighthouse desktop on the SSR build: CLS ≤ 0.005 (was 0.024). Numbers in `prompts/home-redesign.md`, F8 report.

## Screenshots / recordings

Attach the mobile Network panel before/after (image count and bytes) and 1440 of one rail.

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod` pass locally (macOS, Node 24.15; initial 243.30 kB)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries
- [x] Code sits at the lowest level that uses it; no feature imports another feature (AGENTS.md §3)
- [x] No reads changed (§4.2)
- [x] Swiper stays lazy; the import now starts when the rail renders, not at idle (§4.4–§4.5)
- [x] Tailwind utilities only (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; rail height unchanged on every consumer
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft \
  --title "perf(shared): render carousel slides only once Swiper is registered" --body-file /tmp/pr-body.md
```

### 4.7 F4 — MIL-34 (draft)

```bash
git checkout perf/MIL-34-self-host-fonts
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
Depends on the `perf/MIL-33-carousel-init-flood` PR — merge that first.

## What

Serves Inter, Inter Tight, JetBrains Mono and Source Serif 4 from the app via the `@fontsource-variable` packages (OFL, the same files Google serves). `src/styles/fonts.css` declares latin and latin-ext with `unicode-range`, swap display and the weight ranges Google served, plus an `Inter Fallback` (Arial with Inter's metrics) second in `--font-sans` / `--font-numeric`. The Google Fonts link and its preconnects are gone from `index.html`.

## Why

Ticket: MIL-34
Every page loaded a render-blocking stylesheet from `fonts.googleapis.com` and files from `fonts.gstatic.com`, and the swap moved the header on every load. Desktop observed first paint on the SSR build went from 1.1–1.2 s to 0.43–0.55 s.

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/home with the Network panel: no request to `fonts.googleapis.com` or `fonts.gstatic.com`; one 47 KB Inter woff2 from the app.
2. `document.fonts` lists the four families as loaded on the pages that use them: the AI Labs hero (serif) and a `font-mono` page.
3. Lighthouse desktop on the SSR build: FCP ≤ 0.6 s. Numbers in `prompts/home-redesign.md`, F4 report.

## Screenshots / recordings

Attach the header and the AI Labs hero at 1440 before/after (glyphs and weights unchanged). Intentional differences: none; Arabic still loads Noto Sans Arabic from Google at runtime; `font-extrabold` still resolves to 700 for Inter, as before.

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod`, `pnpm build-storybook` pass locally (macOS, Node 24.15; initial 243.78 kB, eight hashed woff2 files)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries
- [x] Global stylesheet, registered in `angular.json`; no component code touched (AGENTS.md §3)
- [x] No reads (§4.2)
- [x] Nothing deferred; fonts are `font-display: swap` with a metric-matched fallback (§4.4–§4.5)
- [x] `@theme` font tokens updated; `fonts.css` is `@font-face` only (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; differences listed above
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft \
  --title "perf(core): self-host the web fonts" --body-file /tmp/pr-body.md
```

### 4.8 F1 — MIL-35 (draft)

```bash
git checkout feat/MIL-35-ai-labs-ring-v3
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
Depends on the `perf/MIL-34-self-host-fonts` PR — merge that first.

## What

Ports the design's ring to `shared/components/surround-carousel`: `RingShape` in the three.js engine (concave / convex / flat camera seats, FOV from the card size, `BAND_LIFT`, `NoColorSpace` textures), a `shape` input, the "The World's 1st AI Labs for Accountants" header, three proof-point cards and a 4:3 / 16:9 / 2:1 stage. Home passes `shape="convex"` behind a two-part placeholder at the measured heights. The data layer (`v2/tracks/7/courses/`) is unchanged.

## Why

Ticket: MIL-35
The ring was the concave v2 look with the old header and no proof points. This is the F1 follow-up of the home redesign (`prompts/home-redesign.md`).

## How to test

The ring's endpoint answers 404 on `(uat-)api.milescaira.com` (every `v2/` path does — see `docs/home-redesign-delivery.md` §1.10), so on UAT and production the section renders nothing. Verify with course data:

1. Mock `v2/tracks/7/courses/?course_type=ai_lab` (six cards) or point `BASE_API_URL` at a host that serves it; `pnpm start`, open http://localhost:4101/us/accounting/home `#model-carousel`: at 1440 and 768 the convex ring draws (`data-webgl="on"`), at 375 the fallback row shows; the header and three proof cards render; no horizontal overflow.
2. `pnpm build:prod`: the engine stays a lazy chunk (≈ 546 kB raw / 114 kB transfer), absent from the initial set.

## Screenshots / recordings

Attach 375, 768 and 1440 of the section rendered with mocked data (the F1 report describes the headless run).

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod` pass locally (macOS, Node 24.15; initial 243.75 kB)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries
- [x] Shared component, consumed by home and the AI Labs page (AGENTS.md §3)
- [x] The read is the existing `httpResource`, guarded with `hasValue()` (§4.2)
- [x] Below the fold, `@defer (on viewport)`, sized two-part placeholder; three.js stays in its lazy chunk (§4.4–§4.5)
- [x] Tailwind utilities; no new component CSS (§4.6)
- [x] UI checked at 375 / 768 / 1440 px with mocked data; known risk: the placeholder collapses when the fetch fails (UAT today)
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft \
  --title "feat(shared): port the v3 AI Labs ring visuals" --body-file /tmp/pr-body.md
```

### 4.9 F2 — ticket pending (draft)

Rename the branch first once the ticket exists (`git branch -m feat/MIL-XXX-caira-stack-v3 feat/MIL-<n>-caira-stack-v3`) and put the number on the `Ticket:` line.

```bash
git checkout feat/MIL-XXX-caira-stack-v3
git push -u origin HEAD
cat > /tmp/pr-body.md <<'EOF'
Depends on the `feat/MIL-35-ai-labs-ring-v3` PR — merge that first.

## What

On md+ the CAIRA stack pins once centred and one scrubbed GSAP timeline cross-fades the cards in place over 1700 px of scroll with a "more below" cue; the server, pre-GSAP and reduced-motion renders are one card tall; below md the cards are a snap carousel with dots. Copy fix "Be a Certified". Home's placeholder is re-measured (539 / 351 / 336 px) and the `#app-download` section uses the same `container` gutter as its neighbours. A second commit adds `docs/home-redesign-delivery.md` (the tickets and PR guide for this series).

## Why

Ticket: MIL-___
The cards pinned one under another with `pinSpacing: false`, which the design replaced with the cross-fade. This is the F2 follow-up of the home redesign (`prompts/home-redesign.md`).

## How to test

1. `pnpm start`, open http://localhost:4101/us/accounting/home and scroll through `#caira-levels` at 1440: the grid pins once centred (pin spacer ≈ 2036 px) and the cards recede and fade as the page scrolls; the cue fades as the last card lands. At 375: three dots and a swipeable carousel. No horizontal overflow.
2. With `prefers-reduced-motion`: one card tall, no pin.
3. Network: gsap is fetched only when the section nears the viewport.

On UAT the badge ladder (`v2/caira-badges/`) is 404 on this host, so the fallback copy shows; the behaviour is the same.

## Screenshots / recordings

Attach 375 and 1440 (a short recording of the scroll at 1440 is better).

## Checklist

- [x] `pnpm lint`, `pnpm format`, `pnpm build:prod` pass locally (macOS, Node 24.15; initial 243.78 kB)
- [x] No new `eslint-disable`, `@ts-ignore`, spec/test files, or `structure-baseline.json` entries (`caira-level-stack.css` keeps its existing entry)
- [x] Shared component, consumed by home and the UAE CAIRA page (AGENTS.md §3)
- [x] The read is the existing `httpResource`, guarded with `hasValue()` (§4.2)
- [x] Below the fold, `@defer (hydrate on viewport)`; gsap stays in its lazy chunk (§4.4–§4.5)
- [x] Tailwind utilities; the existing stylesheet keeps the pin/transform rules Tailwind cannot express (§4.6)
- [x] UI checked at 375 / 768 / 1440 px locally; no intentional visual differences
- [x] Branch is `type/TICKET-description` and the PR title is a Conventional Commit
EOF
gh pr create --base master --draft \
  --title "feat(shared): port the v3 CAIRA stack cross-fade" --body-file /tmp/pr-body.md
```
