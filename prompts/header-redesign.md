# Header: new nav order and labels, then a glass-and-glow finish

## Goal

1. Apply the nav order and labels you pasted (2026-10-09) to the guest and member headers.
2. Give the header the same futuristic finish as the footer (`prompts/footer-redesign.md`, ticket B): a glass pill,
   an accent hairline, a light that sweeps the hairline once each time the bar turns into the pill, glass
   dropdowns, and a glowing active state.

These are two tickets, D then E. The content change (D) and the visual change (E) are kept apart, as CLAUDE.md
requires. Each one ends with a report and a commit message, then stops.

## What I read

- `layout/header/header.ts|html` (with ticket C applied) and `nav.config.ts`.
- `core/models/nav.model.ts`.
- `shared/components/nav-menu-item` and `user-avatar-menu`. The header is the only user of either.
- The `nav`/`footer` blocks of `src/i18n/{en,ar,de,es,fr}.json`.
- The global `.header` rule in `styles.css`. `header.html` is its only user.
- `animation.css`.

## Decisions (yours, 2026-10-09)

- **Labels:** order **and** the new wording.
- **Motion:** **sweep on scroll**. Static glow, plus one light sweep each time the bar becomes the pill. Nothing
  loops.

## Assumptions (read these first)

1. **The route stays `ai-labs`.** Your paste says `ai-lab`, but that route doesn't exist here, so it would 404.
   The import also stays `@core/models/nav.model`.
2. **Labels are changed by editing translation values, not by adding parallel keys.**
   - `nav.masterClass` → "Masterclasses", `nav.podcast` → "Podcasts", `nav.aiLabs` → "AI Lab".
   - The footer's Explore list uses `nav.masterClass` and `nav.podcast`, so it will read "Masterclasses" and
     "Podcasts" too. That keeps the header and footer consistent. Say so if the footer should keep the old wording;
     then D adds `nav.masterclasses` and `nav.podcasts` instead.
3. **"Plan" and "Plans" both exist in your paste.**
   - Members' Resources › "Plan" keeps `nav.plan`, which the footer also uses.
   - The guest top-level "Plans" gets a new `nav.plans`.
   - In ar/de/es/fr, `nav.plan` is already plural (الخطط / Tarife / Planes / Formules), so `nav.plans` copies
     those values.
4. **The guest "Home" link gets a new `nav.home`.** Its values are copied from each language's existing
   `footer.home`.
5. **Non-English drafts for review.** "AI Lab" stays English in every language: it's a brand name, just as
   "Miles AI Labs" is today. "Masterclasses" and "Podcasts" need new non-English strings, which I draft:
   - de: Masterclasses / Podcasts
   - es: Masterclasses / Pódcasts
   - fr: Masterclasses / Podcasts
   - ar: ماستر كلاسات / بودكاستات

   They need a native check before the language switcher reaches production. Today only English ships.

6. **Your commented-out entries are kept**: Simulation in the member nav, CPE Solutions in the guest nav. Their
   labels become keys where a key exists. Simulation has no key, so it stays a literal.
7. **The CPE Solutions menu leaves the guest nav**, as your paste does. `nav.cpeSolutions` and
   `nav.individualLearners` become unused, but they stay in the i18n files because the commented block still
   refers to them.

## Jira tickets

**D** · Summary `feat(layout): reorder the header nav for guests and members` · Story · layout ·
Branch `feat/MIL-XXX-header-nav-order` (cut from ticket C's branch once you've committed C) · Links
`prompts/header-redesign.md` · Estimate S

- Acceptance:
  - **Signed out:** Home · AI Lab [Beta] · Webinar · Plans · Resources ⌄ (Enterprise Solutions; Learning Modes ›
    Masterclasses, Reels, Podcasts; Library › Course Library, Instructor Library) · Sign Up.
  - **Signed in:** Masterclasses · AI Lab [Beta] · Webinar · Reels · Podcasts · Resources ⌄ (CAIRA Badges, CPE
    Tracker, Plan, Library ›) · avatar.
  - The same order applies in the mobile drawer.
  - AI Lab keeps the ticket C underline.
  - Every link goes to a real route.
  - The nav fits in one row at 1024 and 1440.
  - Gates are green.

**E** · Summary `feat(layout): give the header a glass-and-glow finish` · Story · layout ·
Branch `feat/MIL-XXX-header-finish` (cut from D) · Estimate M

- Acceptance:
  - The scrolled pill is glass, with a gradient ring and an accent hairline.
  - The hairline's light sweeps once each time the bar becomes the pill, never on a loop, and not at all under
    reduce-motion.
  - An active link shows a glowing dot. AI Lab instead keeps its underline.
  - The dropdowns, the avatar menu and the mobile drawer are glass panels.
  - Sign Up and the avatar get accent glow treatments.
  - The global `.header` rule is gone.
  - The dropdowns are not clipped.
  - No layout shift when the active link changes.
  - Gates are green.

Use `MIL-XXX` until you create the tickets, then rename with `git branch -m`.

## Phase D: nav order and labels

**`src/app/layout/header/nav.config.ts`**: your structure, with keys in place of the literal labels:

```ts
LOGGED_IN_NAV = [
  { label: 'nav.masterClass', subLabel: 'nav.masterClassSub', type: 'link', route: 'masterclass' },
  { label: 'nav.aiLabs', type: 'link', route: 'ai-labs', badge: 'nav.beta', highlight: true },
  // { label: 'CAIRA', type: 'link', route: 'caira' },
  { label: 'nav.webinar', subLabel: 'nav.webinarSub', type: 'link', route: 'webinar' },
  { label: 'nav.reels', subLabel: 'nav.reelsSub', type: 'link', route: 'micro-learning' },
  { label: 'nav.podcast', subLabel: 'nav.podcastSub', type: 'link', route: 'podcast' },
  // { label: 'Simulation', subLabel: '(AI Role-play)', type: 'link', route: 'simulation' },
  { label: 'nav.resources', type: 'menu', children: [ cairaBadges, cpeTracker, plan, { library › LIBRARY_CHILDREN } ] },
];
GUEST_NAV = [
  { label: 'nav.home', type: 'link', route: 'home' },
  { label: 'nav.aiLabs', type: 'link', route: 'ai-labs', badge: 'nav.beta', highlight: true },
  { label: 'nav.webinar', subLabel: 'nav.webinarSub', type: 'link', route: 'webinar' },
  { label: 'nav.plans', type: 'link', route: 'payment/plan' },
  // CPE Solutions menu (commented, as in your paste) and CAIRA
  { label: 'nav.resources', type: 'menu', children: [
      { label: 'nav.enterpriseSolutions', type: 'link', route: 'cpe-for-corporate' },
      { label: 'nav.learningModes', type: 'menu', children: [ masterClass, reels, podcast ] },
      { label: 'nav.library', type: 'menu', children: LIBRARY_CHILDREN },
  ] },
  { label: 'nav.signUp', type: 'button', actionKind: 'signup', style: 'signup' },
];
```

**`src/i18n/{en,ar,de,es,fr}.json`**, in the `nav` block:

- Change `aiLabs`, `masterClass` and `podcast` (en: "AI Lab", "Masterclasses", "Podcasts"; the other languages as
  in Assumption 5).
- Add `home` (copied from `footer.home`) and `plans` (en "Plans"; the others copied from `nav.plan`).

No component changes. `nav-menu-item` already renders nested menus, and the second level (Resources › Learning
Modes ›) is the same depth as members' Resources › Library today.

## Phase E: glass-and-glow finish

All values come from existing tokens. Two new `@theme` entries and one global rule deleted.

**`src/styles/styles.css`**

- **Add `--shadow-glass` to `@theme`:**
  `0 10px 40px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.1), 0 0 24px rgb(var(--accent-rgb) / 0.08)`.
  - It replaces the identical `shadow-[0_10px_40px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)]` panel
    shadow in `header.html`, `nav-menu-item.html` and `user-avatar-menu.html`. Three files make it a token
    (§4.6).
- **Add `--animate-header-sweep: progress-indeterminate 1.2s ease-out both;`.**
  - It reuses the existing `progress-indeterminate` keyframes, which translate a one-third-width highlight from
    −100% to 300% (a full crossing). It runs once, so there are no new keyframes.
- **Delete the global `.header` rule.** `header.html` is its only user, and utilities replace it.

**`src/app/layout/header/header.html`**

- **Scrolled pill:** this replaces `isScrolled() && 'header'`.
  - The pill: `rounded-full bg-background/60 backdrop-blur-xl shadow-[0_8px_32px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(255_255_255/0.08)]`.
  - A **gradient ring** drawn as a `before:` pseudo-element: `before:absolute before:inset-0 before:rounded-[inherit] before:p-px before:bg-linear-to-br before:from-white/40 before:via-white/5 before:to-white/40 before:[mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)] before:pointer-events-none`.
  - The ring is a mask rather than a padded wrapper because the pill is translucent, so a wrapper's gradient would
    show through it.
  - **No `overflow-hidden` on the pill.** The desktop dropdowns are its absolutely positioned children and would
    be clipped.
- **Hairline and sweep:** inside `@if (isScrolled())`, so they exist only while the bar is a pill.
  - The hairline: `absolute inset-x-10 -bottom-px h-px overflow-hidden bg-linear-to-r from-transparent via-accent/70 to-transparent shadow-[0_0_12px_1px_rgb(var(--accent-rgb)/0.5)]`.
  - The sweep: `<span class="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white to-transparent animate-header-sweep motion-reduce:hidden">`.
  - The `@if` creates the span each time the bar becomes the pill, so the CSS animation runs once per transition.
    No timers, and nothing renders during SSR.
- **Desktop links:**
  - The link becomes `relative`, and `px-2` becomes `px-3`.
  - When `rla.isActive && !item.highlight`, it gets an `after:` glowing dot at the bottom centre:
    `after:absolute after:bottom-0 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-current after:shadow-[0_0_6px_currentColor]`.
  - The dot is absolute, so the active link changes nothing's width (no layout shift). AI Lab keeps its underline
    as its marker.
  - Hover adds `hover:bg-white/5`. The existing hover colour and active colours are untouched.
  - The menu triggers get the same hover.
- **Desktop dropdown panel:** `bg-popover/85 backdrop-blur-xl shadow-glass`, plus a top accent hairline
  (`before:` pseudo-element, `via-accent/50`).
- **Sign Up (both places):** `bg-primary` becomes `bg-linear-to-r from-primary to-accent`, with
  `transition-shadow hover:shadow-[0_0_20px_rgb(var(--accent-rgb)/0.5)]`.
- **Mobile drawer:** `bg-popover/90 backdrop-blur-2xl shadow-glass`, plus the same top accent hairline. The active
  row keeps its existing accent border.

**`src/app/shared/components/nav-menu-item/nav-menu-item.html`**

- The lg sub-panel uses `shadow-glass` and `bg-popover/85`.
- Rows get `hover:bg-white/5`.

**`src/app/shared/components/user-avatar-menu/user-avatar-menu.html`**

- The panel uses `shadow-glass` and `bg-popover/85`.
- The avatar sits in the gradient ring the footer's social chips use:
  `p-px rounded-full bg-linear-to-br from-white/40 via-transparent to-white/40`.

No new files, component CSS or dependencies. The inputs, outputs and selectors of both shared components are
unchanged.

## Files

| Phase | File                                                               | Change                                                                 |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| D     | `src/app/layout/header/nav.config.ts`                              | new order and grouping                                                 |
| D     | `src/i18n/{en,ar,de,es,fr}.json`                                   | 3 values changed, 2 keys added                                         |
| E     | `src/app/layout/header/header.html`                                | pill, hairline and sweep, active dot, panels, Sign Up                  |
| E     | `src/app/shared/components/nav-menu-item/nav-menu-item.html`       | glass sub-panel                                                        |
| E     | `src/app/shared/components/user-avatar-menu/user-avatar-menu.html` | glass panel, ringed avatar                                             |
| E     | `src/styles/styles.css`                                            | `--shadow-glass` and `--animate-header-sweep` added, `.header` deleted |
| D, E  | `docs/refactor/STATE.md`                                           | NON-REFACTOR line and step log                                         |

## Checks

`pnpm lint` (includes the structure check), `pnpm format:fix`, `pnpm build:prod`, `pnpm build-storybook`. Report
the real output and say which environment ran it (local macOS).

## How to verify

Verify on a fresh production SSR build on port 4000, which I start and stop. Your 4101 dev server is stale after
the branch switches and fails hydration, so it can't be trusted for this.

1. **D, signed out and signed in** (signed in via a dummy `ACCESS_TOKEN` cookie, removed afterwards):
   - Read the nav items in order on desktop, and in the drawer at 375.
   - Open Resources and walk every submenu.
   - Every `href` resolves (`curl` returns 200).
   - At 1024 and 1440, the nav's `scrollWidth ≤ clientWidth`.
2. **D, footer:** Explore reads "Masterclasses" and "Podcasts" (Assumption 2).
3. **E, sweep:** scroll past 150px and sample the sweep span's position.
   - It crosses once and stays off-screen afterwards.
   - Scroll back up and down: it runs again.
   - The built CSS has `motion-reduce:hidden` under `prefers-reduced-motion`.
4. **E, dropdowns:** open each desktop dropdown and the avatar menu while scrolled.
   - Each panel's `getBoundingClientRect()` is fully visible (not clipped by the pill).
5. **E, active link:** on `/webinar`, the dot sits under Webinar and the nav row's width equals its width on
   `/home`. On `/ai-labs` there's no dot, only the underline.
6. **E, everything else:**
   - Screenshots at 375, 768 and 1440, scrolled and unscrolled.
   - Arabic at 1440 mirrors.
   - No NG0500 and no console errors.

## Risks

- **`mask-composite: exclude` support:** Chrome 120+, Safari 15.4+ and Firefox 53+ have it. On older browsers the
  ring degrades to the plain glass pill, which is acceptable.
- **`backdrop-blur-xl` on a fixed bar** costs some GPU on low-end phones. The current `.header` already blurs
  (`-sm`), so this is a change in strength, not a new cost.
- **Arabic and German drafts** need a native check (Assumption 5).
- **Footer copy changes** as a side effect of Assumption 2.
