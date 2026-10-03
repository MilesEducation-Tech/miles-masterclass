# Language L4: right-to-left done properly, then Arabic on UAT

Status: approved 2026-10-01; **L4a + L4b + L4c implemented and verified (2026-10-03), uncommitted.** Follows L3 (`prompts/language-l3-logical-utilities.md`, committed as
MIL-18/19).

## Goal

After L3, spacing and positioning mirror under `<html dir="rtl">`, but some parts of the UI are wrong in Arabic:

- Content that must stay left-to-right isn't pinned.
- Some behaviour is still physical (keyboard arrows, a flyout check, toggle knobs, a drawer, gradients, icons).
- The home hero loses its headline.

L4 fixes those, gives Arabic text a real font, and switches `ar` on for UAT. **English, French, German and
Spanish must stay byte-for-byte identical**, proven the same way as L3.

## What was read

Two inventories: direction-sensitive code, and platform behaviour.

**Platform facts:**

- **Direction is detected automatically, from `<html dir>`, by:**
  - Swiper 14: it reads `direction` once at mount;
  - ng-primitives 0.131: through CDK `Directionality` (roving focus, menu, tabs) and `getComputedStyle` (slider,
    date picker);
  - floating-ui: `bottom-end` / `top-start` placements mirror.

  So none of them needs a provider or a config change.

- **Toast is physical.** Both the ng-primitives toast and the app's `toast.css` set `right` / `left`.
- **video.js's progress math is LTR-only** (`offsetX / width`, `style.left` tooltips), and its CSS has no RTL rules.
- **`HtmlToPdf` clones the captured node into a new host on `<body>`.** An ancestor's `dir` is lost, but the
  clone does inherit `rtl` from `<html>`.
- **No loaded font has Arabic glyphs** (Inter, Inter Tight, Source Serif 4, JetBrains Mono). Arabic falls back to
  whatever the OS has, so it renders inconsistently.
- **Angular's `ar` locale prints Latin digits.** `ar-AE` exists too.

**Bugs found (file references are in the inventory notes at the end):**

| Area                                            | What goes wrong in Arabic                                                                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home hero (desktop)                             | The copy sits in a disc at physical `left-0 translate-x-[-55%]`. Its `ps-[60%]` now pushes the headline into the off-screen part, and the video at `end-0` slides under the disc. |
| `nav-menu-item` `flipped()`                     | Measures right overflow while the flyout now opens to the left, so it flips the wrong way.                                                                                        |
| Slider, surround carousel, ai-labs fan          | `ArrowLeft` / `ArrowRight` are physical; prev/next icons point the wrong way.                                                                                                     |
| `milesverse/subject` row scroll                 | Buttons render as "> <", and scroll physically.                                                                                                                                   |
| 4 toggle switches                               | The knob starts at the right and is pushed further right, past the track.                                                                                                         |
| Right-side drawer dialog (cart, filters, about) | Sits on the left but slides in from the right.                                                                                                                                    |
| 10 gradients anchored to `start`/`end`          | They fade toward the wrong side: section-nav scrim, video-list edges, two course heroes plus their skeletons, a progress fill, a record sleeve, webinar hairlines.                |
| 43 direction-implying icons                     | Back/next/forward arrows and chevrons point the wrong way.                                                                                                                        |
| Route view-transition                           | Always slides left.                                                                                                                                                               |
| Mobile slider dots                              | Kept physical `left-6` while the copy moved to `start-6`.                                                                                                                         |
| Inputs                                          | Phone shows "91+", the OTP fills right-to-left, and emails and URLs are right-aligned.                                                                                            |
| `ngxMarquee` (ai-labs)                          | The track reverses and leaves a gap.                                                                                                                                              |

## Locked decisions

1. **Stays left-to-right in every language:**
   - **Media players:** video.js and the custom audio player, the same as YouTube/Netflix timelines.
   - **PDF capture:** one line, `offscreenHost.dir = 'ltr'` in `HtmlToPdf`, covers the invoice and the partner
     report.
   - **The invoice page.**
   - **Typed values:** email, phone, URL, number, password, the OTP, postal code, the coupon code, and the
     dial-code picker including its options, which are portaled.
   - **The ai-labs marquee track.**
2. **Admin is always English, left-to-right.** `LanguageContext` resolves `en` when the app loads under `/admin`,
   and the admin layout root gets `dir="ltr"` plus the CDK `Dir` directive, for an admin who arrives by in-app
   navigation.
3. **Mirrored in Arabic:**
   - keyboard arrows, the flyout flip, toggle knobs, the drawer slide;
   - gradients tied to a start/end anchor;
   - "back / next / forward" arrows and chevrons (`rtl:-scale-x-100`, with the disclosure chevrons'
     `rotate-90` handled);
   - the route transition, the home hero disc, the slider dots, the toast side.
4. **Not mirrored:**
   - external-link, share, send, log-in/out, quote and media-control icons;
   - diagonal and angled decorative gradients;
   - decorative illustrations (laptop, floating assets, badge spots);
   - the plan-table crown;
   - the centring idioms.
5. **The Arabic font is Noto Sans Arabic, loaded only for Arabic.**
   - The `provideLanguage()` initializer adds its Google Fonts `<link>` to `<head>` during SSR when the language
     is `ar`, and `ar` pages get it appended to the font stack.
   - Every other language's HTML is unchanged and downloads nothing extra.
   - IBM Plex Sans Arabic is the alternative if design prefers it; it is a one-line change.
6. **Arabic keeps Latin digits:** Angular's `ar` already does. Arabic-Indic digits would be a product call.
7. **Component CSS that is the app's own layout** (ai-labs, milesverse, caira-level-stack, toast) moves to logical
   properties (`margin-inline-start`…), the CSS twin of L3. Third-party overrides (the video.js reel card) stay.

## PRs (each under ~400 lines; each keeps English identical)

| PR  | Ticket                                                               | Branch                            | Contents                                                                                                                                                                |
| --- | -------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L4a | `fix(shared): keep left-to-right content left-to-right under Arabic` | `fix/MIL-<n>-rtl-ltr-islands`     | Decisions 1–2: PDF host, players, invoice, typed inputs (one central CSS rule plus OTP, coupon and dial-code `dir`), marquee, admin English + LTR                       |
| L4b | `fix(shared): mirror direction-dependent shared UI under Arabic`     | `fix/MIL-<n>-rtl-mirror-shared`   | `shared/` and `layout/` parts of decision 3, the toast, the route transition, the Arabic font (decision 5)                                                              |
| L4c | `fix: mirror the feature pages under Arabic and enable it on UAT`    | `fix/MIL-<n>-rtl-mirror-features` | The `features/` parts of decision 3 (home hero, icons, gradients, the ai-labs fan, final-assessment toggle), decision 7, and `ar` added to `environment.development.ts` |

## Verification

1. **English is identical.** Same 27 computed-style captures as L3 (8 pages × 375/768/1440 + dropdown, search
   dialog, drawer) before and after each PR: **zero differences**. SEO probe identical. Production server HTML for
   a non-Arabic visitor is byte-identical to `master` apart from build hashes, with no font link added.
2. **Arabic works.** On the local config, at 375 and 1440 px, with screenshots in the PR:
   - home hero, header + dropdown, mobile drawer, masterclass slider, plan page with toggles, cart drawer, FAQ
     table, footer, login;
   - the login phone/email/OTP fields;
   - ArrowLeft/ArrowRight on the slider (moves toward the upcoming slide);
   - the nav flyout near the left edge (flips correctly);
   - a video player, which stays LTR and seeks correctly.
3. **Checks:** `pnpm lint`, `pnpm ng test --watch=false` (new specs for the `flipped()` RTL branch, keyboard
   swapping, the admin language rule and the PDF host `dir`), `pnpm build:prod`, `pnpm build:dev`,
   `pnpm build-storybook`, `pnpm check:structure`.
4. **Performance:** the initial bundle and CSS deltas are reported. The Arabic font costs nothing outside Arabic
   pages.

## Risks

- **The surround-carousel WebGL engine** (drag/wheel/nudge) stays physical. Its arrow buttons and keys are
  mirrored, but a drag still spins with the finger, which is correct anyway.
- **The ng-primitives slider's pointer math is LTR-only** (`clientX - rect.left`). `shared/ui/slider` is only used
  in stories today; noted, not fixed.
- **The Arabic copy itself is still my draft** (L2) and needs native review before production enables `ar`.
- **Pages behind login** (players, final assessment, milesverse) are checked where the dev server allows. What
  can't be reached is listed in the PR rather than claimed.

## Implementation notes (2026-10-03)

**Sizes:**

- L4a: +209 / −16, 18 files.
- L4b: +259 / −38, 27 files.
- L4c: +125 / −62, 27 files.

**Each stage was checked on its own** in a scratch worktree from HEAD `6fadba4`:

- L4a type-checks alone.
- L4a + L4b type-check and pass the full suite (204 files / 920 passed + 1 skipped).

**Fixed during verification:**

- **The typed-input alignment rule never applied.** HTML gives `tel` / `email` / `url` / `password` / `number`
  inputs left-to-right directionality of their own, so `input…:dir(rtl)` never matches. It now tests the
  parent, `:dir(rtl) > input…`, which still skips inputs inside a `dir="ltr"` island. Verified: phone and
  email inputs are `direction: ltr` and `text-align: right` on an Arabic page.

**Decided while implementing:**

- **Toast:** the app names positions physically (`top-right`), and the primitive places `end` on the right.
  `NotificationService` swaps start/end on an RTL page, so `toast.css` stays as it is.
- **The 3D surround carousel's controls, the milesverse row-scroll buttons and the ai-labs card fan are
  left-to-right islands.** They move physically (WebGL nudge, `scrollBy({left})`, `left:50%` + `--x`), so
  their arrows stay physical.
- **The dial code** uses a new optional `dir` input on `app-combobox`. The host attribute covers the field;
  the input is bound on the portaled list.
- **The admin layout's `dir="ltr"` + CDK `Dir` were not added.** Admin is entered by a direct page load,
  which the `/admin` rule covers. An admin reached by in-app navigation from an Arabic page would still be
  RTL; adding them is the upgrade path if that ever happens.
- **No spec for `HtmlToPdf`'s `offscreenHost.dir`:** the service has no spec, and adding one means mocking
  html2canvas and jsPDF. It is a one-line change.

**English parity:**

- The same 30 views as L3, plus ai-labs, at 375 / 768 / 1440 px, with CSS animations and transitions frozen.
- The recorded properties now also include `transform`, `translate`, `rotate`, `scale`, `background-image`,
  `direction`, `font-family` and `transform-origin`.
- Webinar, library, FAQ, plan and login: identical at every width.
- Every other difference traced to data or state, not code:
  - side-nav colour from scroll-spy;
  - `transform-origin` (box size) and auto-resolved `left` / `right` from images and data that loaded
    differently. UAT returned 404 for tracks, CAIRA badges and dashboard feeds during the "after" run, so the
    home surround carousel rendered nothing.
- **No property L4 sets differed on any element.**

**Arabic (dev server, local config):**

- Desktop home: the hero headline is visible on the right with the video on the left; Noto Sans Arabic is
  loaded and in the stack.
- Header: the dropdown and the Library submenu open leftward on-screen, with a mirrored chevron.
- Login: phone and email are LTR and right-aligned, and the dial-code list is LTR ("+1").
- Mobile: the drawer opens on the left.
- `/admin` with the `lang=ar` cookie: `lang="en"`, LTR.
- Probe elements confirm every `rtl:` override wins in CSS order:
  - switch knob −2 / −22 px;
  - consent switch −20 px;
  - drawer enter mirrored;
  - gradients mirrored (`to left` / `to right`);
  - expanded disclosure chevron `scale -1` + `rotate -90deg`;
  - slider dots centred from `sm`.
- Not live-tested: the slider keys (no slides in the UAT feed at the time; covered by 4 specs), and pages
  behind login (players, final assessment, milesverse; the milesverse CSS conversions are exact logical
  equivalents).

**Production vs UAT:**

- **Production**, Arabic browser: `lang="en"`, no Arabic font link, SEO identical to master.
- **UAT** (`ar` enabled), Arabic browser: `<html lang="ar" dir="rtl" style="--font-sans: …Noto Sans Arabic…">`,
  font link present, Arabic aria-labels.
- **UAT**, French browser: no font link.

**Bundle:** CSS 40.73 → 41.07 kB transfer; initial bundle 241.37 → 241.92 kB.

**Seen, not fixed:**

- Untranslated English copy inside an RTL paragraph puts its trailing period at the line start
  (".Classes by experts"). It disappears as each feature is translated (L5).
- `audio-chapter.html:22` has a typo'd class, `to-backfrom-background/50`. It predates L4.
