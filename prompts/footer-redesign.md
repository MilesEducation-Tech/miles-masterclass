# Footer: fix the layout, then a bold glass-and-glow finish (+ AI Labs header underline)

## Context

`src/app/layout/footer/` looks broken at every width. I measured it on the running 4101 dev server at
`/us/accounting/home`:

| Width    | What's wrong (root cause)                                                                                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **all**  | Every column is `md:mx-auto`, so it is centred inside an unequal grid cell. No column's left edge lines up with another or with the copyright row (1440: x = 118 / 337 / 609 / 918).                                                                                                                                              |
| **768**  | `grid-cols-2` plus `colSpan: 2` puts the columns at x = 106 / 430 / 78 / 95, a zig-zag. `container` has **0 side padding** from md up, so the footer touches the screen edges, and the home page's fixed 56px side rail (`shared/components/section-nav`, `md:flex`) sits on top of the first column. This happens at 768–1391px. |
| **375**  | "Download App" is squeezed into a 164px half-column ("Google Play" wraps), and the QR code is shown on a phone that can't scan it. The legal links stack into 5 rows. The footer is **1,804px** tall.                                                                                                                             |
| **1440** | "Our Location" and "Social" are two separate centred blocks with a full-width `<hr>`, which wastes about 300px. A hard `<br />` in the NASBA statement leaves an orphan "its / website:" line.                                                                                                                                    |
| code     | The cause is `footerSections` + `colSpan` + `gridColsMap` + `gridColumnsClass` (a generic grid generator). Also: `getIcon(): any`, an unused `navigateTo(…any)`, a hard-coded `year: 2026`, and the off-token `bg-[#39434f]`.                                                                                                     |

You asked to **fix it first, then make it futuristic**. Together the change is about 550 lines, over the ~400-line
PR limit, so it splits along the line you drew:

- **Ticket A:** the layout fix.
- **Ticket B:** the "Bold" finish you picked, with a compact grid on phones.

Ticket B builds on ticket A. Each one ends with a report and a commit message, then stops.

You also handed over a header prompt: a hand-drawn underline under the AI Labs link. It becomes **ticket C**,
a separate branch from `master`, and runs after the footer work. Compared with the prompt, the real code differs
in four ways:

1. The model is at `src/app/core/models/nav.model.ts`.
2. AI Labs is `{ label: 'nav.aiLabs', type: 'button', route: 'ai-labs', style: 'demo', badge: 'nav.beta' }` in
   both navs. Under the prompt's own rule, a button ignores the flag. You chose to **make it a link**.
3. The link branches don't render `badge` today.
4. `pnpm start` serves on **4101**, and `/us/cpa/home` redirects to `/us/accounting/home`.

A futuristic pass on the whole header comes later in the session. It is not in this plan.

## Jira tickets

**A** · Summary `fix(layout): align the footer at every breakpoint` · Bug · layout ·
Branch `fix/MIL-XXX-footer-layout` · Links `prompts/footer-redesign.md` · Estimate M

- Acceptance:
  - At 375, 768, 1024, 1280 and 1440, every column in a row starts at the same x.
  - Nothing sits under the home page's side rail.
  - There is no horizontal scroll.
  - The footer at 375 is at least 35% shorter than 1,804px.
  - The copyright row is never hidden by the floating subscribe card.
  - `pnpm lint` and `pnpm build:prod` are green (local macOS).

**B** · Summary `feat(layout): give the footer a glass-and-glow finish` · Story · layout ·
Branch `feat/MIL-XXX-footer-finish` (cut from A) · Estimate S

- Acceptance:
  - The accent hairline and its light sweep show along the top edge.
  - A soft radial glow sits behind the top of the footer.
  - The app downloads sit on a glass card, and the social links are gradient-ring chips.
  - A faded "Miles Masterclass" wordmark sits in the bottom padding.
  - With reduce-motion on, the sweep is gone.
  - Arabic (RTL) mirrors the layout correctly.
  - Gates are green.

**C** · Summary `feat(layout): draw a hand-drawn underline under the AI Labs link` · Story · layout ·
Branch `feat/MIL-XXX-ai-labs-underline` (from `master`) · Estimate S

- Acceptance:
  - AI Labs is a real `<a href>` nav link in both GUEST_NAV and LOGGED_IN_NAV.
  - It keeps its Beta badge.
  - A wavy accent underline sits under the label text only, on desktop (≥1024) and in the mobile drawer.
  - The underline draws in once.
  - With reduce-motion on, the underline shows statically.
  - The hover and active styles are unchanged.
  - `build:prod` has no NG8002 error.

Use `MIL-XXX` until you create the tickets, then rename with `git branch -m`.

## Phase A: layout fix (keep today's typography and colours)

**`src/app/layout/footer/footer.html`**: rewrite the structure.

- **Outer wrapper:** `<footer class="pt-16 pb-44 md:pb-32">`.
  - The bottom padding stays as it is today. It keeps the copyright row clear of the fixed subscribe card from
    `footer-overlay`.
- **Inner wrapper:** `container mx-auto flex flex-col gap-12 sm:px-6 md:px-10 lg:px-16`.
  - These gutters fix the edge-hugging. `lg:px-16` (64px) clears the 56px home side rail at every width.
- **Top grid:** `grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-x-10`.
  - No `mx-auto` on any cell, so every column starts on the grid line.
- **Brand cell:** `col-span-2 md:col-span-3 lg:col-span-1`.
  - It holds the logo link, socials and locations. "Our Location" and "Social" fold into it, which removes the
    `<hr>` and both centred blocks.
  - **Logo link:** `ng-icon [svg]="logo"`, `routerLink="/"`, labelled with the existing `header.home` key.
  - **Download block:** the store buttons sit side by side with `whitespace-nowrap`. The QR code is
    `max-md:hidden`, following the same rule `shared/components/app-download` already applies.
  - **At md:** the brand cell is one row, with logo, socials and locations on the left and downloads on the right.
  - **At lg:** it is a stacked left column.
- **Link groups:** `@for` over `linkSections()`.
  - Explore and Policies sit side by side on phones.
  - Partnerships (`wide: true`) takes `max-md:col-span-2`, and its `<ul>` becomes
    `max-md:grid max-md:grid-cols-2 max-md:gap-x-6`, which is the compact grid you picked.
- **NASBA block:**
  - Logo on the left, text on the right from md up (`md:flex-row md:items-start`, `text-start`).
  - Remove the `<br />`. The statement wording stays English and verbatim, as its comment requires.
- **Bottom bar:**
  - `flex flex-col gap-4 md:flex-row md:items-center md:justify-between`.
  - The legal links use `flex flex-wrap gap-x-6 gap-y-2`, so they wrap instead of stacking.
  - The language switcher and Cookie settings stay as they are.
- Use logical utilities (`ps`/`pe`, `start`/`end`, `text-start`) so the Arabic page mirrors.

**`src/app/layout/footer/footer.ts`**

- Delete `footerSections`, `gridColsMap` and `gridColumnsClass`. Add
  `linkSections = computed<FooterSection[]>(…)`: Explore, Policies, and Partnerships with `wide: true`.
- Icons: put the svg string straight into `icon` (`icon: svglLinkedin`, and so on), then delete the `icons` map
  and `getIcon(): any`. Template: `[svg]="link.icon!"`.
- Delete the unused `navigateTo` and the `Router` inject.
- Add `qrCodeUrl` as a readonly field, `protected readonly logo` from `@core/constants/icon`, and
  `copyrightYear = new Date().getFullYear()`, which replaces the hard-coded 2026.

**`src/app/core/models/footer.model.ts`**: `FooterSection` becomes `{ title; links; wide? }`, which drops the
dead `type`, `qrCodeUrl` and `colSpan`. The footer is its only user.

**`eslint.config.mjs`**: remove `src/app/layout/footer/footer.ts` from `LEGACY_ANY_FILES`, because its last
`any` is gone (§9 ratchet). `footer.stories.ts` stays on the list.

## Phase B: Bold finish (on top of A; everything comes from existing tokens and patterns)

**`footer.html`**

- **`<footer>`:** add `relative isolate overflow-hidden bg-linear-to-b from-background to-surface-deep`. Both
  colours are existing tokens.
- **Top hairline:** an `aria-hidden` div,
  `absolute inset-x-0 top-0 h-px overflow-hidden bg-linear-to-r from-transparent via-accent/40 to-transparent`.
  - Inside it, a sweep span: `absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-accent to-transparent animate-footer-sweep motion-reduce:hidden`.
  - It is positioned with physical `left` on purpose: it is decorative, and the same direction is fine in RTL.
- **Glow:** `pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent-rgb)/0.14),transparent_70%)]`.
  - This is the same `--accent-rgb` glow idiom the header and pricing card use.
- **Section labels:**
  - Style: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`. That label style already
    appears 46 times in the app.
  - Before each label, a glowing dot: `size-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent-rgb))]`.
- **Links:**
  - `text-sm text-muted-foreground transition-colors hover:text-accent`, plus a `focus-visible:outline` ring.
  - This replaces the off-token `text-gray-300`.
- **Social chips:**
  - The header's gradient ring: `p-px rounded-full bg-linear-to-br from-white/40 via-transparent to-white/40`.
  - Inner: `grid size-10 place-items-center rounded-full bg-background`.
  - On hover: `hover:shadow-[0_0_20px_rgb(var(--accent-rgb)/0.4)]`.
  - Each gets `[attr.aria-label]="social.label"` and the icon gets `aria-hidden`. Today the link is icon-only with
    nothing but a `title`.
- **Download card:**
  - Glass: `rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm`.
  - Store buttons: `border border-white/10 bg-white/5 hover:border-accent/50 hover:bg-accent/10`. This replaces
    `bg-[#39434f]`.
  - The QR code sits on a white rounded tile.
- **NASBA strip:**
  - It sits between `border-y border-hairline py-8` lines.
  - The sponsor ID is set in `font-mono text-accent`, with the translation key unchanged.
- **Wordmark:** `<p aria-hidden="true">Miles Masterclass</p>` with
  `pointer-events-none absolute inset-x-0 bottom-0 -z-10 translate-y-1/4 select-none whitespace-nowrap text-center text-[9vw] 2xl:text-[8.5rem] font-bold leading-none tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-white/10 to-transparent`.
  - It lives in the existing bottom padding, so it takes no layout space.
  - It is a brand name, so it is not translated.

**`src/styles/animation.css`**: add `@keyframes footer-sweep`, translateX(−100%) → translateX(300%) over the
first 60%, then rest. Add a `why` comment.

**`src/styles/styles.css` `@theme`**: add `--animate-footer-sweep: footer-sweep 6s ease-in-out infinite;` beside
the home-page animation tokens. Keyframes go global because Angular scopes component keyframes (§4.6).

No new component CSS, dependencies, inputs or i18n keys.

## Phase C: AI Labs underline (header; your prompt, adapted)

1. **`src/app/core/models/nav.model.ts`:** add `highlight?: boolean;` after `badge?: string;`, with the doc
   comment from your prompt.
2. **`src/app/layout/header/nav.config.ts`:** in both navs, change AI Labs to
   `{ label: 'nav.aiLabs', type: 'link', route: 'ai-labs', badge: 'nav.beta', highlight: true }`.
   - Drop `style: 'demo'`. No other item uses `demo`, but the `@case ('demo')` branches stay, because
     `NavButtonStyle` still declares it.
   - Navigation doesn't change. `handleAction` already sent `route` through `utils.localePath`, which is what
     the link's `[routerLink]` uses.
3. **`src/styles/animation.css`:** append `@keyframes navUnderlineDraw` exactly as in your prompt.
4. **`src/app/layout/header/header.html`:**
   - **a)** Add the `<ng-template #navUnderline>` SVG after `</header>`, verbatim.
   - **b) Desktop link `<a #rla>`:** wrap `{{ item.label }}` in `<span class="relative">…</span>` with
     `@if (item.highlight) { <ng-container [ngTemplateOutlet]="navUnderline" /> }`.
     - After that span, add `@if (item.badge) { … }`, reusing the pill's badge classes
       (`rounded-full bg-accent/20 text-accent px-1.5 py-px text-[10px] font-bold uppercase tracking-wide leading-4`).
     - The badge sits outside the `relative` span, so the underline matches only the label text.
   - **c) Drawer link `<a #mrla>`:** the same span, underline and badge.
5. **`src/app/layout/header/header.ts`:** import `isPlatformBrowser, NgTemplateOutlet` from `@angular/common`,
   and add `NgTemplateOutlet` to `imports`. Without it, NG8002 breaks `build:prod`.

Hover and active classes stay untouched. There is no component stylesheet and no new file.

## Files

| Phase   | File                                                                         | Change                                      |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| A, B    | `src/app/layout/footer/footer.html`                                          | rewrite (A), restyle (B)                    |
| A       | `src/app/layout/footer/footer.ts`                                            | −~45 / +~12                                 |
| A       | `src/app/core/models/footer.model.ts`                                        | trim `FooterSection`                        |
| A       | `eslint.config.mjs`                                                          | drop one `LEGACY_ANY_FILES` entry           |
| B       | `src/styles/animation.css`, `src/styles/styles.css`                          | one keyframe and one token                  |
| C       | `src/app/core/models/nav.model.ts`, `src/app/layout/header/nav.config.ts`    | flag; AI Labs becomes a link                |
| C       | `src/app/layout/header/header.html`, `header.ts`, `src/styles/animation.css` | underline template, badge, import, keyframe |
| A, B, C | `docs/refactor/STATE.md`                                                     | NON-REFACTOR line in "Now"                  |

`footer.stories.ts` needs no change, because the component has no inputs.

## Verification (each phase)

1. `pnpm lint` (includes the structure check), `pnpm format:fix`, `pnpm build:prod`, `pnpm build-storybook`.
   Report the real output and say which environment ran it (local macOS).
2. Browser on the running 4101 dev server, at `/us/accounting/home` (side rail and overlay) and
   `/us/accounting/masterclass`. Check widths **375, 768, 1024, 1280 and 1440** with JS:
   - For each grid row, the column `getBoundingClientRect().left` values are equal.
   - The first column's left ≥ 64 at lg and up. This clears the rail.
   - `scrollWidth === innerWidth`, so there is no horizontal scroll (the B wordmark must fit).
   - After scrolling to the bottom, the copyright row's bottom is above the subscribe card's top.
   - Footer height at 375 is reported before and after.
3. Switch to Arabic with the footer switcher and confirm the mirrored layout at 1440 and 375.
4. Confirm SSR still renders the links:
   `curl -s http://localhost:4101/us/accounting/home | grep -c 'Boomer Knowledge Network'` returns ≥ 1.
5. Screenshots at 375, 768 and 1440 go into the report, along with every intentional visual difference
   (AGENTS §4.6).
6. **Phase C only**, on 4101 at `/us/accounting/home`, signed out and signed in:
   - Desktop ≥1024: the underline is under "Miles AI Labs" only, and the Beta badge shows.
   - Once the animation ends,
     `getComputedStyle(document.querySelector('header svg[preserveAspectRatio="none"] path')).strokeDashoffset`
     is `0px`.
   - Clicking it lands on `/us/accounting/ai-labs`.
   - At 375, open the drawer. The underline spans the label text, not the row.
   - `pnpm build:prod` has no NG8002 error.

## Notes

- The home page already has a "Learning on the go" app-download section right above the footer, so on home the
  footer's Download App block repeats it. It stays in for now.
- `docs/refactor/STATE.md` has committed merge-conflict markers in "Now" (`<<<<<<< HEAD`). The NON-REFACTOR line
  goes above them; the conflict is left for the owner.
