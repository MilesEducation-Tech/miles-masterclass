# Phase 11 — `layout`

## 1. Summary

4 files changed, no new files, no moves. The tracker cell read "— (above fold)", which is correct for `@defer` on
the header and footer. The layout still had two kinds of §4.4 work, and this session did both:

- **4 dialog opens → `import()` at open** (§4.4):
  - `CalendlyDialog` from `header.openScheduler()`, `footer.openScheduler()` and
    `footer-overlay.onScheduleDiscoveryCall()`.
  - `GlobalSearchDialog` from `footer-overlay.openSearch()`.
  - The methods became `async`, and every caller fires and forgets (`header` action map, `footer`, and the overlay's
    ⌘K handler and template).
  - `CalendlyDialogData` is `import type`.
- **`footer-overlay` → `@defer (on idle)` in `main-layout`** (§4.4 lists `footer-overlay` as always-defer).
  - The overlay is `position: fixed` (a bottom bar and a right-side cluster). It takes no flow space and is not LCP,
    so the placeholder is an empty hidden `<span>` and the swap shifts nothing.
- **Not deferred:** the header (above the fold) and the footer (SEO content that must be in the SSR HTML).
  See the decision in §3.

**Correction to this session's plan:** I assumed `MainLayout` was in the initial bundle. It is not. `DynamicLayout`
is the route component in `features.routes.ts`, which is lazy. The layout chunk still loads on **every** feature
page before the page renders, so what was removed from it is on every page's critical path, just not in "initial"
as the bundle report counts it.

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

The baseline dir was clean after the run, and there were no "not deferred" warnings.

**Bundle:**

- Initial is unchanged: 88.0 KB gz (−1.3% vs baseline). "Initial total" is 242.34 kB (was 242.43).
- Lazy: 306 chunks, 4122.7 KB gz.
- `app-footer-overlay`, `app-calendly-dialog` and `app-global-search-dialog` are now each in their own lazy chunks,
  out of the layout chunk every page loads.

## 3. Decisions needed / skipped / suspicious

- **Behaviour note:** the ⌘/Ctrl+K search shortcut lives in `footer-overlay`, so it now works from browser-idle
  after load rather than from first render. The same goes for the overlay's scroll listener and its lazy cart load.
  This is intended by §4.4, but it is a visible timing change on a very fast keypress.
- **Open option, not needed now: `@defer (hydrate on viewport)` for the footer.** Incremental hydration is on, so
  the footer could keep its SSR HTML and hydrate lazily. It needs a sized placeholder for client-side navigation,
  and the footer's height varies by breakpoint. Left for you to decide. Nothing in the spec requires it.
- No `@Injectable`, no CSS files, no heavy-library service left eager.

## 4. Visual QA list

- Header "Book Demo" and footer "Schedule" open the Calendly dialog.
- The floating overlay appears as before, at 375, 768 and 1440 px: continue-learning, subscribe, and corporate
  "discovery call" (Calendly).
- The overlay search icon, and ⌘/Ctrl+K once the page settles, open global search.

## 5. Commit message

```
perf(layout): lazy-load the layout dialogs and defer the footer overlay

- header, footer and footer-overlay load CalendlyDialog / GlobalSearchDialog
  with import() when opened
- main-layout renders <app-footer-overlay /> in @defer (on idle); it is a
  fixed-position bar, so the empty placeholder shifts nothing

The overlay and both dialogs leave the layout chunk every page loads.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
