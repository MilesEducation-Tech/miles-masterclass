# Phase 12 — `layout`

## 1. Summary

**All 8 stylesheets are deleted, and `layout/` now has no component CSS.** Four were empty. The other four (42 lines)
became host classes and template utilities.

**Empty, deleted with their `styleUrl`:** `blog-layout`, `footer`, `main-layout` and `plain-layout`.

**Converted:**

- **`footer-overlay`:** `:host { display: contents }` became host class `contents`, merged with the existing `z-50`.
- **`subscribe-card` and `continue-learning-card`:**
  - `:host { display: block; width: 100% }` became host class `block w-full`.
  - The 135° accent↔primary gradient became `bg-linear-135/srgb from-accent to-primary` (reversed for
    `continue-learning-card`).
    - `/srgb` keeps the original interpolation, because Tailwind v4 otherwise interpolates in oklab.
    - The compiled CSS confirms `--tw-gradient-position: 135deg in srgb`.
  - Their `subscribe-card` / `continue-learning-card` class names were dropped, since only the deleted CSS used them.
- **`global-search-dialog`:**
  - `:host` became host class `block`.
  - `min-width: min(720px, 95vw)` became `min-w-[min(720px,95vw)]`.
  - `.result-row.is-focused` became `[class.bg-card-hover]="isFocused(item)"`. It is the same colour as the row's
    existing `hover:bg-card-hover`, so the move from unlayered CSS to `@layer utilities` has no visible effect.
  - The `:focus-visible` ring became `focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2`.
  - The WebKit cancel-button rule became `[&::-webkit-search-cancel-button]:hidden` and `:appearance-none` on the
    search input. Its comment moved into the template.
  - The `global-search-dialog`, `result-row` and `is-focused` class names were dropped. No spec or style used them.

**Colours left as they are, on purpose.** Neither matches a token exactly:

- The `header.html` scroll and dropdown shadows are one-off `rgba` shadows.
- The `footer.html` `bg-[#39434f]` is 1–2 units off `--card`, as the `shared/dialogs` report already noted.

**No change needed:** there is no `NgClass`, `NgStyle`, `@apply` or inline `styles` in the folder.

## 2. Verification

These are the `verifier` subagent's results from the full `verify.mjs` run, which passed first time. It ran without a
guard refusal this time, because it was told to issue the bare command.

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
- `reviewer`: **PASS**. It compared each file against its `HEAD` original, including a cascade check on the focused
  row.
- **Prod CSS:** every new utility is present: `bg-linear-135/srgb`, `min-w-[min(720px,95vw)]`,
  `focus-visible:-outline-offset-2`, the `-webkit-search-cancel-button` variants and `.contents`.
- **Bundle:** the initial bundle is 88.5 KB gz, −0.8% vs baseline, up 0.1 KB. There are 324 lazy chunks. This is the
  same pattern as earlier rows: component CSS moves into the global utility sheet.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** none.
- **Harness note:** when the verifier issues the bare `node scripts/refactor/verify.mjs`, with no `cd`, pipe or `&&`,
  the guard allows it. That is the likely cause of the two earlier refusals (`features/payment`, `features/auth`).

## 4. Visual QA list

Check at 375 / 768 / 1440 px:

- **Footer overlay:**
  - The subscribe card's accent→primary gradient.
  - The continue-learning card's primary→accent gradient.
  - The full-width layout, and the overlay's stacking above page content.
- **Global search dialog:**
  - Its minimum width.
  - The arrow-key focused row highlight.
  - The keyboard focus ring on result rows.
  - No native ✕ in the search input (Safari/Chrome).

## 5. Commit message

```
style(layout): move layout styling to Tailwind utilities

- delete all 8 layout stylesheets: 4 empty, 4 converted
- footer-overlay and the footer cards: :host → host classes; card
  gradients → bg-linear-135/srgb (srgb keeps the original interpolation)
- global-search-dialog: min-width, focused row, focus ring and the WebKit
  cancel-button rule → template utilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
