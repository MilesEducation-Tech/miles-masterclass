# Phase 12 — `shared/components`

## 1. Summary

**31 stylesheets deleted, 7 trimmed, 12 kept. 3 inline `styles` blocks removed and 1 converted.** Plus one fix to the
previous row.

- **Deleted (31 files):**
  - 23 empty `.css` files and their `styleUrl`.
  - 8 more whose rules became host classes or utilities:
    - `caira-feature-grid`, `caira-steps-grid`, `course-related-section` and `webinar-registration-form`: their
      `:host { display: block }` rule became `host: { class: 'block' }`. None of their consumers passes a class.
    - `micro-learning-hero-reel-card`, `video-poster` and `badge-hero-card`: the host metadata or the element already
      carried the same classes. Every `videoClass` consumer passes `object-cover`.
    - `rating-star`: the `[ngpRating][data-*]` rules became `data-readonly:`, `data-disabled:` and
      `data-focus-visible:` variants. It adds `outline-solid`, because in v4 `outline-none` zeroes the outline style
      that `outline-2` reads.
    - `coming-soon`: `.index` became utilities, with arbitrary `-webkit-text-fill-color` and `-webkit-text-stroke`.
- **Trimmed to what Tailwind cannot express:**
  - `slider`: 84 → 1 rule, `.nav-btn`. It styles the `<app-button>` **host**. Utilities can't go in that element's
    `class` attribute, because app-button forwards `class` to its inner `<button>`, which would double the border and
    background.
    - The item and content states are now **complete per-position class lists**. A base `xl:w-[150px]` would outrank
      a state's `w-full`, since variants sort after plain utilities.
    - The `.title` and `.description` names were dropped. Global unlayered classes with those names in `styles.css`
      would otherwise beat the utilities.
  - `slider-skeleton`: 107 → shimmer keyframes, `.shimmer` and 5 delay classes. A layered `animation-delay` utility
    would lose to the unlayered `animation` shorthand.
  - `micro-learning-hero-phone-mockup`: `:host`, `.phone-frame` (a 4-layer shadow) and `.phone-side-btn` → utilities.
    The keyframes stay.
  - `consent-banner` and `plan-scrolling-gallery`: `:host` → host class; the keyframes stay.
- **Inline `styles`:**
  - `section-nav`: the 90-line `@apply` block was removed. It is now complete per-state class sets using `after:`,
    `hover:after:` and `group-hover:` variants. I browser-checked that `hover:after:*` sorts after `after:*`.
  - `section-nav`'s `@apply container` became explicit breakpoint max-widths, because the `container` class name
    would pick up the global `.container` override (`max-sm:w-11/12!`).
  - `section-nav`'s spec-queried names (`inline-nav`, `sidenav`, `sidenav-icon`, `sidenav-label`) stay as hooks.
  - `backward`: `:host` → host class. `masterclass-course-hero-skeleton`: its empty block was dropped.
- **Kept, with the §4.6 reason:**

  | File                            | Reason                                               |
  | ------------------------------- | ---------------------------------------------------- |
  | `record-disk`, `faq-item`       | `@keyframes`                                         |
  | `floating-assets`, `laptop`     | `@keyframes`, plus pseudo-elements in `laptop`       |
  | `horizontal`                    | complex `clip-path: shape()`                         |
  | `surround-carousel`             | `:host([data-webgl])`                                |
  | `carousel`                      | swiper internals                                     |
  | `marquee`                       | react-fast-marquee port: pseudo, keyframes, CSS vars |
  | `caira-level-stack`             | pseudo-element rules                                 |
  | `audio-js`, `video-js` (inline) | video.js overrides and range-thumb pseudo-elements   |

- **Tokens:** only exact matches were converted. `#38424C` → `bg-card` (×2) and `#0E0E0E` → `text-background`. The
  other 17 hexes match no token and are one-offs.

**⚠️ Fix to the previous row, `shared/ui`, already committed as `688b0fe`.**

- That row replaced `button.css` with `host: { class: 'inline-block!' }`. The `!` made the host outrank slider's scoped
  `.nav-btn` (specificity 0,2,0). The old unlayered `:host` had lost to that rule.
- As a result, the slider's prev/next buttons became inline-block instead of flex.
- `button.css` is **restored** with its original rule and a comment explaining why it must stay: the default has to
  beat call-site utilities but lose to callers' scoped rules, and no host class can do both.
- Checked in the browser: the nav buttons are flex again (48 px, white).
- **This file is untracked, so the commit needs `git add`.**

## 2. Verification

The full `verify.mjs` run went green on fix round 1. The first run failed only the format check, on one file I had
edited with `sed`. I formatted it and re-ran.

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (190 files / 698 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass (round 2)                            |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 of 4 routes                       |

- The baseline dir was unchanged. The `reviewer` returned **PASS**.
- `shared/components` specs: 25 files / 65 tests.
- **Browser (dev server):**
  - The slider nav buttons are flex.
  - The sidenav is flex, 56 px wide, with `gray-200` buttons.
  - Every new arbitrary class (21 checked) is present in the generated CSS.

**Bundle:**

- Initial is **88.3 KB gz**, up from 87.3 but still −1.0% vs baseline. Lazy chunks are unchanged at 324.
- The global `styles.css` (50.6 KB gz) is part of the initial bundle, and it now carries the utilities that used to
  sit in (mostly lazy) component stylesheets. Tailwind-first moves bytes this way by design.
- I could not attribute the 1 KB per file: the bundle report gives initial totals only.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- The `shared/ui` report's claim that "`inline-block!` keeps parity" was wrong. It is corrected here; the report itself
  is unchanged.
- No `@Injectable`, no `NgClass`/`NgStyle`.

## 4. Visual QA list

Check at 375 / 768 / 1440 px. These could not be browser-checked because UAT course data doesn't load locally:

- **Home and masterclass hero slider:**
  - slide positions, thumbnail widths and offsets
  - the hero content fade-in (`slideIn`)
  - text shadow and Helvetica
  - the prev/next buttons, which are round white 48 px
- **Slider skeleton** (while the list loads): layout and shimmer with staggered delays.
- **Section nav:**
  - inline and header modes: the underline grows on the active item, and a half grey underline shows on hover
  - sidenav mode on home and masterclass: expands on hover and reveals the labels
- **Other components:**
  - `coming-soon` card: the outlined index number
  - `rating-star`: focus ring on keyboard focus, and the read-only cursor
  - micro-learning hero phone mockup: frame shadow, side buttons
  - `chapter-skeleton` and `coming-soon` colours
  - consent banner and plan gallery

## 5. Commit message

```
style(shared): move shared/components styling to Tailwind utilities

- delete 31 component stylesheets (23 empty; 8 converted to host classes
  or utilities: rating-star data-* variants, coming-soon, video-poster, …)
- slider, slider-skeleton, section-nav, phone-mockup: @apply rules →
  complete per-state class lists; only keyframes, the shimmer delays and
  slider's app-button host rule (.nav-btn) stay as CSS
- #38424C → bg-card, #0E0E0E → text-background
- fix(shared/ui): restore button.css — the inline-block! host class from
  688b0fe outranked slider's .nav-btn and turned its nav buttons inline-block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
