# Language L3: logical start/end utilities, so layouts can mirror for Arabic

Status: approved 2026-10-01; **L3a + L3b implemented and verified, uncommitted.** Follows L2 (`prompts/language-l2-transloco.md`).

## Goal

Replace left/right-specific Tailwind utilities with their logical equivalents (start/end). The two compute to
**identical** values in left-to-right pages, so English, French, German and Spanish do not change by a single
pixel. Under `dir="rtl"` (Arabic, L1) the logical ones mirror. This is a pure refactor; no new behaviour. L4 then
deals with what utilities can't (direction-implying icons, carousels, transforms) and switches Arabic on for UAT.

## What was read and measured

- **553 physical-direction utilities in 162 files** (templates, `cn()` class strings in TS, host classes):
  `left-*` 132, `text-right` 101, `text-left` 95, `right-*` 72, `ml-*` 58, `border-l*` 26, `pr-*` 25, `pl-*` 18,
  `mr-*` 17, `rounded-tr/l/r*` 6, `border-r*` 3.
- **By area:**

  | Area                 | Uses | Files |
  | -------------------- | ---- | ----- |
  | `shared/components`  | 127  | 37    |
  | `shared/dialogs`     | 67   | 14    |
  | `features/offerings` | 62   | 21    |
  | `admin/*`            | ~140 | —     |
  | `features/payment`   | 29   | 12    |
  | `layout`             | 21   | 6     |
  | `features/partners`  | 21   | 8     |
  | `shared/ui`          | 17   | 10    |
  | other features       | ~70  | —     |

  Plus 12 component `.css` files with physical properties, mostly third-party overrides.

- **Tailwind 4.3.3 emits every logical utility BEFORE its physical twin:** `start/end` before `left/right`,
  `ms/me` before `ml/mr`, `ps/pe` before `pl/pr`, `rounded-s` before `rounded-l`, `border-s` before `border-l`.
- **tailwind-merge 3.7 does not treat a physical class and its logical twin as a conflict** (`ml-2 ms-4` keeps
  both), except for text alignment (`text-left text-start` → `text-start`).

Together those two facts fix the order: **shared code first, features after.**

- A shared component's base becomes `ms-4` while a feature still overrides with `ml-2`. `cn()` keeps both and the
  physical class comes later in the CSS, so the feature's override still wins, exactly as today.
- The reverse order (a feature converted before the shared base) would silently lose overrides.

## Locked decisions

1. **The mapping:**
   - `ml/mr` → `ms/me`
   - `pl/pr` → `ps/pe`
   - `left/right` → `start/end`
   - `text-left/right` → `text-start/end`
   - `border-l/r` (width and colour forms) → `border-s/e`
   - `rounded-l/r` → `rounded-s/e`
   - `rounded-tl/tr/bl/br` → `rounded-ss/se/es/ee`
   - Negative forms (`-ml-2` → `-ms-2`), variants (`md:`, `hover:`, `rtl:`…) and the `!` modifier are preserved.
2. **Centring stays physical.** `left-1/2` paired with `-translate-x-1/2` (and its `right-` mirror) is a centring
   idiom: as `start-1/2` it would shift the element sideways under RTL. The codemod leaves any class list that
   contains a horizontal translate untouched for review. Symmetric pairs (`left-0 right-0`) convert together.
3. **Excluded, and why:**
   - **`admin/**`:** internal and English-only. L4 pins admin to English and LTR.
   - **Everything html2canvas captures into a PDF:** the invoice and payment-status templates. Documents stay
     LTR, and html2canvas-pro is the one renderer here whose support for logical properties is unproven.
   - **Third-party overrides in component CSS** (video.js, Swiper, CMS HTML). Those libraries handle their own
     direction; Swiper gets `dir` in L4.
   - **Transforms and gradients** (`translate-x-*`, `bg-linear-to-r`): a slide-in direction or decorative angle
     is a design decision, so it goes to L4.
4. **The codemod is a one-off script and is not committed** (same as the shared/ui migration codemod).
   - It only rewrites tokens shaped like real Tailwind values (a number, fraction, `px`, `auto`, `full`, an
     arbitrary `[…]`, a theme colour for borders), so prose such as "right-to-left" in comments and identifiers
     are never touched.
   - Its full diff is reviewed by hand before anything is run.

## PRs

| PR  | Ticket                                                                    | Branch                                  | Scope                                                                        |
| --- | ------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| L3a | `refactor(shared): use logical start/end utilities so layouts can mirror` | `refactor/MIL-<n>-rtl-logical-shared`   | `shared/**`, `layout/**`, `app.html`. About 245 uses, ~200 changed lines     |
| L3b | `refactor: use logical start/end utilities in the feature pages`          | `refactor/MIL-<n>-rtl-logical-features` | `features/**` except the PDF templates. About 230 uses. **Merges after L3a** |

L3b spans several features. If you'd rather keep one scope per PR, it splits into `refactor(offerings)` (62) and
one more for the rest.

## Visual parity: how "zero change" is proven, not assumed

1. **A computed-style diff on the dev server.**
   - A script records, for every element on a page, the resolved `margin-left/right`, `padding-left/right`,
     `left/right`, `text-align`, `border-left/right-width`, `border-*-radius` and its bounding box. It runs before
     the codemod, then again after, and the two are diffed.
   - Pages: home, masterclass, webinar, course library, a partner page, FAQ, payment plan, login. Plus the
     global-search and calendly dialogs, the nav dropdowns and the mobile drawer.
   - Viewports: 375, 768 and 1440 px.
   - **Expected difference: none.** Any non-zero row is investigated before the PR goes up.
2. Screenshots at 375 and 1440 px, before and after, for the PR description.
3. **Arabic (local config): screenshots of the same pages under `dir="rtl"`,** to show the mirroring the PR
   exists for, with what still points the wrong way listed for L4.

## Acceptance criteria

- [ ] No physical-direction utility remains in the converted areas, except documented centring idioms.
- [ ] The computed-style diff is empty at 375, 768 and 1440 px on every listed page and dialog (LTR).
- [ ] Production bundle: CSS size reported. Logical utilities are the same size, so it should be flat.
- [ ] `pnpm lint`, `pnpm ng test --watch=false`, `pnpm build:prod`, `pnpm build-storybook`, `pnpm check:structure`
      pass (state the environment).

## Risks

- **A shared component restyled from inside a feature with a physical override:** handled by the order above,
  and caught by the computed-style diff if not.
- **Unlayered component CSS that sets the same side** (AGENTS §4.6 cascade caveat): a logical utility and a
  physical CSS property land in the same cascade group, so the winner is unchanged. The diff confirms it.
- **Specs or stories asserting a class name** (`ml-2`): updated alongside, never deleted.

## Implementation notes (2026-10-01)

- **Codemod result:**
  - L3a (`shared`, `layout`, `app.html`): 220 tokens in 66 files, +192 / −188 lines.
  - L3b (`features`, minus the invoice and payment-status templates): 150 tokens in 58 files, +131 / −133.
  - It also converts `[class.border-l-2]`-style bindings, where the class name is an unquoted attribute name.
  - 28 class strings were kept physical: centring or translate idioms, listed in the dry run.
- **Found by the computed-style diff and fixed: the `th` quirk.**
  - `text-left` → `text-start` is NOT equivalent on an ancestor of a `<th>`. A `th` centres itself unless its
    parent's `text-align` is something other than the initial value, and `start` IS the initial value.
  - Four header cells in the FAQ-content table moved from left to centre.
  - Fix: `text-start` on the `th` itself, in `faq-content`, `utils-dialog` and `ai-lab-terms-dialog`. It is also
    the right behaviour under RTL.
- **Found in review and fixed:** two `start-1/2 -translate-1/2` pairs (`audio-js.ts`, `badge-spot-animation.html`).
  The both-axes translate escaped the `translate-x` check; they are reverted to `left-1/2`, and the codemod's
  check now treats any translate except `translate-y` as centring.
- **Parity: 27 recordings, zero differences after the fixes, about 30,000 elements compared.**
  - Each recording holds the computed side margins, side paddings, `left`/`right`, `text-align`, side border
    widths and colours, and corner radii of every element.
  - The 27: home, masterclass, webinar, course library, the ICPAS partner page, FAQ, plan and login, at 375, 768
    and 1440 px; plus the nav dropdown and search dialog at 1440 and the mobile drawer at 375.
  - The only other non-zero row was a hover artefact: a real mouse click in the "before" run against a scripted
    click in the "after" run. Repeating it with the same click gave zero.
- **CSS:** 40.50 → 40.73 kB transfer (+0.23 kB). Admin still uses physical utilities, so both forms ship until
  admin is converted or pinned.
- **Gates (local macOS, Node 24):** lint 0 errors, tests 203 files / 906 passed + 1 skipped, `build:prod`,
  `build-storybook` and `check:structure` pass.
- **Arabic (local config, 1440 px):** the header mirrors (logo right, nav reversed, sign-up left), the side nav
  moves right, the search button moves bottom-left, and the dropdown opens end-aligned with right-aligned items.

## Handed to L4 (seen under RTL or left physical on purpose)

- **Swiper:** the home hero carousel renders blank under `dir="rtl"`. Swiper needs `dir` / `rtl` configured.
- **Direction-implying icons** (chevrons, arrows, the nav submenu chevron) need `rtl:-scale-x-100`.
- **`nav-menu-item` submenu flip logic** (`flipped() ? end-full : start-full`) measures viewport overflow, so
  under RTL the measurement side flips.
- **Class strings kept physical:**
  - the mixed slider-dots offset (`left-6 … sm:left-1/2 sm:-translate-x-1/2`);
  - `home-hero` (`left-0 translate-x-[-55%]`);
  - the plan-comparison badge.
- **Transforms and gradients:** whether slide-in direction and gradient angle mirror is a design call.
- **Pin admin, the invoice and payment status to `dir="ltr"`.**
