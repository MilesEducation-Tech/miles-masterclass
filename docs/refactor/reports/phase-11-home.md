# Phase 11 — `features/home`

## 1. Summary

3 files changed and 1 new file, no moves.

- **`home-hero` → `AppDownloadDialog` lazy-loads** on the desktop path (§4.4).
  - Phones still go straight to their store, synchronously, inside the tap's user gesture.
  - To make that possible, the two store URLs moved out of the dialog file into a new
    **`core/constants/app-store.ts`**. Their users are `shared/dialogs/app-download-dialog` and `features/home`, so
    core is the lowest common level (§3). The dialog now imports them from core.
- **The home "CPE On the Go" app-download section is deferred** (§4.4 always-defer "app-download sections"):
  - `@defer (on viewport; prefetch on idle; hydrate on viewport)`.
  - `hydrate on viewport` keeps the section **in the SSR HTML**. The built server chunk contains "CPE On the Go",
    so SEO is unaffected and a server-rendered load shifts nothing.
  - The placeholder only shows on client-side navigation to home. It is sized from heights measured in a browser:
    `h-[773px] md:h-[715px] lg:h-[493px]` (375 / 768 / 1440 px).
  - This is the **first `hydrate on …` trigger** in the app.
- **Left as is, and judged compliant by the reviewer:**
  - The 3 existing `@defer` blocks (track carousels, surround carousel, coming-soon).
  - `caira-level-stack`: it already `import()`s gsap, and it is a ScrollTrigger-pinned section whose placeholder
    cannot be sized without breaking the pin maths.
  - `offerings`: no heavy library.

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

The baseline dir was clean after the run, and there were no "not deferred" or hydration warnings.

**Browser check** (dev server, 1440 px):

- The section renders on scroll.
- The hero's desktop path opens the app-download dialog.
- The console's 404s are all UAT API endpoints (`tracks/`, `webinar/filter/`, `v2/dashboard/`, `v2/caira-badges/`),
  so they are unrelated.
- The dev server loads `@defer` deps eagerly under HMR (NG0751), so the chunking was checked on the prod build.

**Bundle:**

- Bundle report initial is 88.0 KB gz (−1.3% vs baseline, unchanged).
- The prod "Initial total" is **243.39 kB, +1.05 kB**. Most likely this is Angular's incremental-hydration trigger
  runtime, now pulled into `main` by the app's first `hydrate on` block. That is inferred, not traced chunk by
  chunk.
- `AppDownload` and `AppDownloadDialog` left the home page chunk (`chunk-WG5GUC6G`, which now holds only the
  `import()` calls).

## 3. Decisions needed / skipped / suspicious

- **None needed.**
- **The SSR smoke does not cover the home page**: `/` 302-redirects, and no localized home route is probed. The
  server-HTML check above was done on the built server chunk. A home route in the smoke set would be the user's
  change to make, since the harness is not mine to edit.
- For the `features/offerings` row: `services/app-download-prompt.ts` still statically imports `AppDownloadDialog`.
- No `@Injectable`, no CSS files, no heavy-library service left eager.

## 4. Visual QA list

- Home at 375, 768 and 1440 px, loaded directly (SSR): the "CPE On the Go" section is present with no jump.
  Then navigate to home from another page (client-side): a blank block holds the space until it scrolls in.
- Desktop hero "Download App" opens the QR dialog. On an iPhone or Android device (or with the UA emulated), it goes
  straight to the store.

## 5. Commit message

```
perf(home): lazy-load the app-download dialog and defer the app-download section

- home-hero loads AppDownloadDialog with import() on the desktop path; the
  store URLs move to core/constants/app-store so phones still open the store
  synchronously inside the tap gesture
- home wraps <app-app-download /> in @defer (on viewport; prefetch on idle;
  hydrate on viewport): still server-rendered, lazily hydrated, with a
  placeholder sized from measured heights for client-side navigation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
