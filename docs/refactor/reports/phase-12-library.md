# Phase 12 — `features/library`

## 1. Summary

**Of 8 stylesheets, 7 are deleted and 1 is kept. One empty inline `styles` was dropped.** This is the smallest
Phase 12 row: the library templates were already Tailwind-only.

**Deleted:** the 7 empty (0-byte) stylesheets, along with their `styleUrl`:

- `badge-library-hero`, `badge` (page)
- `course-filters`, `course-filters-drawer`, `course` (page)
- `instructor`, `instructor-details` (pages)

`library.ts` also lost its empty `styles: ```.

**Kept, with a §4.6 reason:** `badge-spot-animation.css` (55 lines).

- It holds 3 `@keyframes` (`slide-fade-up/left/right`) and the 3 `.animate-slide-fade-*` classes that use them.
- Angular scopes keyframe names per component, so a global `animate-[slide-fade-up_…]` utility would point at a name
  that does not exist.

**Left as they are, on purpose:**

- `badge-spot-animation.html` keeps its 3 static `style="animation-delay: …"` attributes.
  - The component's `animation` shorthand is unlayered, so it would override a layered `[animation-delay:…]` utility
    and the stagger would be lost.
  - The `[style.*]` bindings on the stars and badges are per-item computed positions. They are native bindings, not
    `NgStyle`.
- 5 raw colours in the same template have no exact token match (`#26272C`, `#3399FF`, `#2BBADD` ×2,
  `rgb(51 153 255 / 0.7)`). The nearest, `--accent` (`#2A85FF`), is a visibly different blue. Each is a one-off in
  this row, so no new token was added.
- `rounded-[100%]` ×4 stays: it draws an ellipse, while `rounded-full` would draw a stadium.

**No change needed:** there is no `NgClass`, `NgStyle` or `@apply` in the feature.

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
| ssr smoke       | pass: 4 of 4 routes                       |

- `reviewer`: **PASS**.
- **Bundle:** the initial bundle is unchanged at 88.4 KB gz (−0.9% vs baseline). There are 324 lazy chunks. Empty
  stylesheets emit nothing, so no size change was expected.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** `badge-spot-animation.css` (keyframes).
- **Process note:** an early `--quick` run from the wrong directory wrote a stray
  `src/app/features/library/docs/refactor/.cache/`. The reviewer caught it, and it was deleted before close.

## 4. Visual QA list

Nothing is expected to change visually, because only empty stylesheets were removed. For a spot check:

- **Badge library hero** (`badge-spot-animation`): the staggered slide-fade of the stars, the badges and the pedestal.
- **Course library** filters and filter drawer; **instructor** list and detail pages.

## 5. Commit message

```
style(library): drop the empty library stylesheets

- delete 7 empty component stylesheets and their styleUrl, plus
  library.ts's empty inline styles
- badge-spot-animation.css stays: its keyframes are component-scoped

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
