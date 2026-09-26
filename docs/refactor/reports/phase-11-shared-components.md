# Phase 11 — `shared/components`

## 1. Summary

2 source files changed, no new files, no moves.

- **`slider` → `CourseInfo`, `carousel` → `FilterDialog`:** each dialog now loads with `import()` when it opens (§4.4).
  `openCourseInfoDialog` and the private `openDialog` became `async`. Every caller fires and forgets:
  - `openCourseInfoDialog` has 6 callers in the `hover`/`horizontal`/`vertical` templates.
  - `openDialog` is private, called only from `openFilterDialog()`.
- **`carousel` → `swiper/modules`** (`FreeMode`, `Mousewheel`, `Pagination`) now loads with `import()` inside
  `initSwiper()`, in a `Promise.all` with the existing `ensureSwiperElement()`. The destroyed / element-missing bail
  still runs after both resolve. Only `import type`-style `SwiperOptions` stays static.
- **Survey — already compliant, no change:**
  - Every other heavy library in the folder is already dynamic: the `surround-carousel` three.js engine, `caira-level-stack` gsap, `video-js`/`audio-js` video.js, and `swiper/element`.
  - `carousel.html`'s `@defer (on idle)` has sized `@placeholder`/`@loading` skeletons.
  - `laptop` and `floating-assets` import no heavy library.
- **`@defer` at usage sites is the feature rows' job.**

## 2. Verification

`verifier`, full `verify.mjs`, first run:

| Gate            | Result                                   |
| --------------- | ---------------------------------------- |
| lint            | pass                                     |
| unit tests      | pass: 190 files / 698 passed + 1 skipped |
| build (local)   | pass                                     |
| build (prod)    | pass                                     |
| storybook build | pass                                     |
| format check    | pass                                     |
| bundle report   | pass                                     |
| ssr smoke       | pass: 4 of 4 routes                      |

The baseline dir was clean after the run.

**Bundle:**

- Initial is unchanged: 88.0 KB gz (−1.3% vs baseline), with "Initial total" at 242.25 kB (was 242.28). Both
  components only render in lazy routes, so this row only moves lazy code.
- Lazy: 297 chunks, 4115.1 KB gz.
- `app-course-info` (8.8 KB) and `app-filter-dialog` (4.5 KB) are in their own chunks, separate from the
  slider/carousel chunk (`chunk-3U6XVGUE`, 43.7 KB).
- The swiper module code (`freeMode`, `swiper-pagination-bullet`) is no longer in that chunk either.

## 3. Decisions needed / skipped / suspicious

- **None needed.** No `@Injectable`, no CSS files, no heavy-library service left eager.
- **Skipped: deferring the consent-banner preferences panel** (the Phase 10 "Phase 11 option"). `ngp-switch` is
  small and not a §4.4 heavy item. The reviewer agreed.
- **For the `features/offerings` row:** `podcast-hero.html` renders `<app-wave-canvas />` without `@defer`, and
  §4.4 lists `wave-canvas` as always-defer. `wave-canvas.html`'s `<!-- @defer { -->` is an inert comment, dead text.
- As before: a chunk-load failure on open is silent, the same as the other lazy dialogs.

## 4. Visual QA list

- The slider's "info" action opens the course-info dialog (after a short load).
- A carousel with a filter button: the filter dialog opens, and applying it filters.
- Carousels still initialise with snapping, mousewheel and pagination where configured (home, the course library
  sections, related courses).

## 5. Commit message

```
perf(shared): lazy-load the slider/carousel dialogs and swiper modules

CourseInfo (slider) and FilterDialog (carousel) now load with import() when
opened, and carousel pulls swiper/modules in alongside swiper/element inside
initSwiper(), so none of them ride in the component chunk. Initial bundle
unchanged; both components render only in lazy routes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
