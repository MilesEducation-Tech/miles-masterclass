# Phase 11 — `features/library`

## 1. Summary

4 files changed, no new files, no moves.

- **Two dialogs lazy-load on open** (§4.4):
  - `course` page → `CourseFiltersDrawer`. `openMobileFilters` is now async; its only caller is a template `(click)`.
  - `badge` page → `CertificateDownloadDialog`. The private `downloadCertificate` is now async; its early return comes before the import, and its only caller fires and forgets. The data type is `import type`.
- **Instructor promo player deferred** (§4.4, video.js players):
  - `instructor-details` wraps `<app-video-js>` in `@defer (on viewport; prefetch on idle)`.
  - The `@placeholder` is a black box filling the parent's existing `aspect-video` wrapper, which is always rendered, so there is no layout shift.
  - The `@error` shows a one-line message.
  - It sits below the hero and "About", so it is not above the fold.
  - `VideoSource` is now `import type` from `@core/models`, so the `VideoJs` import line carries only the deferred component.
- **Survey:** no heavy library, no service eligible for `injectAsync`, and no other heavy child or static dialog
  open in the feature.

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

The baseline dir was clean after the run, and neither build logged a "not deferred" warning.

**Bundle:**

- Initial is unchanged: 88.0 KB gz (−1.3% vs baseline). "Initial total" is 242.40 kB (was 242.25, noise).
  The library is lazy, so this row only reshapes lazy chunks.
- The `VideoJs` component's own code now lives only in `chunk-63DH2HA7`, not in the instructor-details chunk
  (`chunk-KJ2VWQDG`, 12.1 KB). Checked with the strings `Loading video` and `vjs-cpe-mode`.
  The page chunk still names the `<app-video-js>` tag in its template, which is expected.
- The drawer and certificate dialog code left the course and badge page chunks.

## 3. Decisions needed / skipped / suspicious

- **None needed.** No `@Injectable`, no CSS files, no heavy-library service left eager.
- As before, a failed chunk load on a dialog open is silent. The deferred player has `@error`.

## 4. Visual QA list

- `/…/library/instructor/:id` with a promo video: a black box first, then the player once it scrolls into view.
  No jump. It plays.
- The course library on mobile width: "Filters" opens the right drawer, and applying and clearing still work.
- The badge library: "Download certificate" opens the dialog, and the unavailable-course toast still shows.

## 5. Commit message

```
perf(library): lazy-load the filters drawer, certificate dialog and promo player

- course: CourseFiltersDrawer loads with import() when the mobile filters open
- badge: CertificateDownloadDialog loads with import() on download
- instructor-details: the promo <app-video-js> is @defer (on viewport;
  prefetch on idle) inside its existing aspect-video box, with @error

Initial bundle unchanged (the library is lazy); the video component leaves the
instructor page chunk.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
