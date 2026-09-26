# Phase 12 — `features/offerings`

## 1. Summary

**Of 30 stylesheets, 29 are deleted and 1 is kept. One inline `styles` block was converted.** 40 arbitrary colours were
replaced with tokens: 1 existing token and 7 new ones.

**Deleted as empty or comment-only (19):**

- 17 empty stylesheets.
- `audio-chapter` and `course-feedback`, which held only a comment.

**`:host` → host classes (9, plus 1 inline).** No call site puts classes on these hosts.

| Component                                                                                                                 | Host class                       |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `chapter-quiz`                                                                                                            | `block h-full w-full`            |
| `micro-learning-about-panel`                                                                                              | `block h-full`                   |
| `micro-learning-course`                                                                                                   | `block h-screen overflow-hidden` |
| `html-content-dialog`, `webinar-registration-dialog`, `micro-learning-episode-grid`, `-filter-sheet`, `-hero`, `-top-bar` | `block`                          |
| `micro-learning-reel-nav` (inline `styles`)                                                                               | `block`                          |

**Converted to template utilities:**

- **`micro-learning-course`:** `.hide-scrollbar` became `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`, the
  same pattern as `surround-carousel`.
  - The global `.no-scrollbar` was not reused, because it has no `scrollbar-width` and so doesn't hide the Firefox
    scrollbar.
- **`swiper-strip`:** the equal-height slide rules became `class="flex h-auto *:flex-auto"` on the `<swiper-slide>` its
  own template authors. Its explanatory comment moved into the template.
  - Swiper's slide styles live only in its shadow root (`::slotted`), which light-DOM styles beat regardless of layer.
    The reviewer checked `swiper-element.mjs` and confirmed Swiper injects no light-DOM `swiper-slide` rule.

**Kept, with a §4.6 reason:** `micro-learning-reel-card.css` (213 lines). It holds `::ng-deep` overrides of video.js
internals (third-party DOM), a `:has()` conditional rule and its `:host` flex layout.

**Colours → tokens.** As in the partners and payment rows, a colour used in 2+ files became a token, or was mapped to
an existing token on an exact match.

| Token                             | Hex                   | Uses                                                                             |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `card` (existing)                 | `#38424C`             | 1: `video-chapter` thumbnail placeholder (exact `--card`)                        |
| `player-panel`                    | `#161e25`             | 5: chapter player frame and chapter-list rows (`video-chapter`, `audio-chapter`) |
| `player-thumb`                    | `#4a5560`             | 6: chapter thumbnail placeholders                                                |
| `quiz-line`                       | `#3e4552`             | 17: assessment borders and the neutral button (quiz, exam, report, feedback)     |
| `quiz-line-hover`                 | `#4b5563`             | 2: that button's hover                                                           |
| `quiz-selected`                   | `#2c3442`             | 2: the selected answer option                                                    |
| `quiz-panel` / `quiz-panel-hover` | `#161e26` / `#1c2530` | 3 / 3: report and feedback panels and their row hover                            |

**Colours left as they are, on purpose:**

- **`chapter-quiz` `text-[#161E25]`:** a panel colour used as button text, so a `player-panel` name would mislead.
- **Single-file repeats and one-offs.**
- **`select-cpe-mode`'s `from-[#0d1a2d] to-[#1a2332]`:** the same gradient as payment's `cart-drawer`. It crosses
  features, so it is logged in §3 rather than changed from this row.

**No change needed:** there is no `NgClass`, `NgStyle` or `@apply`.

## 2. Verification

These are the `verifier` subagent's results from the full `verify.mjs` run, which passed first time.

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (190 files / 698 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass                                      |
| bundle report   | pass                                      |
| ssr smoke       | pass                                      |

- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**. It compared each file against its `HEAD` original.
- **Prod CSS:** the verifier quoted every new rule, including `.h-screen{height:100vh}`, the scrollbar pair,
  `:is(.\*\:flex-auto>*){flex:auto}` and each token utility.
- **Bundle:** the initial bundle is **89.2 KB gz, +0.0% vs baseline**, up 0.1 KB on the last row. There are 324 lazy
  chunks.
  - ⚠️ **The margin under baseline is gone**, and the `admin/*` and `admin/partner-platform(-v2)` rows still remain.

## 3. Decisions needed / skipped / suspicious

- **⚠️ Initial-bundle budget (becoming a decision):**
  - Phase 12 has moved lazy component CSS into the global utility sheet row by row, taking the initial bundle from
    87.3 to 89.2 KB gz. It now sits exactly at baseline.
  - The two admin rows will likely push it over, and the bundle-report gate may then fail.
  - The options are (a) accept the CSS delta as Phase 12's expected cost, or (b) keep admin-only CSS out of the
    global sheet. Please decide before `/refactor-phase 12 admin/*`.
- **Kept CSS:** `micro-learning-reel-card.css` (video.js overrides, `:has()` rule, host layout).
- **Logged, not fixed:**
  - **Near-duplicate tokens:** `quiz-panel` (`#161e26`) is 1 unit off `player-panel` (`#161e25`). They could be merged
    with no visible change, but I kept them exact per the parity rule.
  - **Cross-feature duplicate gradient:** `#0d1a2d → #1a2332` appears in both `select-cpe-mode` (offerings) and
    `cart-drawer-dialog` (payment). It could become one token in a later pass.
- The spinner-colour decision from `shared/ui` is still open.

## 4. Visual QA list

Check at 375 / 768 / 1440 px:

- **Masterclass and podcast chapter pages:**
  - The player frame and chapter-list row panels, and the thumbnail placeholders (video and audio chapters).
  - The chapter quiz: it should fill its container, with option borders, the selected option, the button and its hover.
- **Final assessment exam and report, course feedback:** borders, panels, the expanded-row background and row hover.
- **Micro-learning course (reels):**
  - The full-height page with no page scroll.
  - The reel scroller with no visible scrollbar in Chrome, Safari and Firefox.
  - The about panel's full height, the reel nav, the top bar, the hero and the filter sheet.
- **Webinar rails (`swiper-strip`):** cards in a row must be equal height, with no stepping.
- **HTML content and webinar registration dialogs:** layout unchanged.

## 5. Commit message

```
style(offerings): move offerings styling to Tailwind utilities and tokens

- delete 29 of 30 stylesheets: 19 empty/comment-only, 9 :host → host
  classes (+ reel-nav's inline styles), micro-learning-course's
  hide-scrollbar and swiper-strip's equal-height slides → utilities
- micro-learning-reel-card.css stays (video.js overrides)
- bg-[#38424C] → bg-card; add player/quiz tokens for colours repeated
  across files (player-panel, player-thumb, quiz-line, quiz-line-hover,
  quiz-selected, quiz-panel, quiz-panel-hover), replacing 39 values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
