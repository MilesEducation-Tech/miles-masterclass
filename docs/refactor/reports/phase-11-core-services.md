# Phase 11 — `core/services` (first session of Phase 11)

## 1. Summary

2 source files changed. No new files, no moves.

- **Incremental hydration is enabled** (first-session item, PROMPT.md §5 Phase 11). `app.config.ts` adds
  `withIncrementalHydration()`, and keeps `withEventReplay()` and the transfer-cache options. No `hydrate on …`
  triggers were added. A plain `@defer` still serves only its placeholder on the server, so the SSR output is
  unchanged. Each feature row adopts `hydrate` triggers in its own session. The `ai-labs.html:226` trade-off
  comment can now be revisited in the offerings/ai-labs row.
- **`PageNotFound` and `Compliance` are lazy** (`loadComponent`, your in-session call). They were the last two
  eager components in `app.routes.ts` (PLAN §7). The routes `page-not-found`, `maintenance` and `compliance` keep
  their paths.
- **The row's own §4.5 work was already done:**
  - `html-to-pdf` (jspdf + html2canvas-pro) is loaded through `injectAsync` by both consumers, with no static import.
  - `supabase` already `import()`s supabase-js, and it serves SEO on the server, so it is not eligible.
  - No other core service imports a heavy library. The reviewer re-swept this independently.
- **`video-js.css` move: attempted and reverted (your call).** A `ViewEncapsulation.None` carrier component
  carrying `@import 'video.js/dist/video-js.css'` made the prod build fail. The vendor CSS then counts as a
  component stylesheet (47.14 kB), and the `anyComponentStyle` budget is 16 kB. The budget was not raised.
  The global import stays, and styles.css plus both players are identical to HEAD.

## 2. Verification

`verifier`, full `verify.mjs`, final run (after the revert):

| Gate            | Result                                                                |
| --------------- | --------------------------------------------------------------------- |
| lint            | pass                                                                  |
| unit tests      | pass: 190 files / 698 passed + 1 skipped                              |
| build (local)   | pass                                                                  |
| build (prod)    | pass                                                                  |
| storybook build | pass                                                                  |
| format check    | pass                                                                  |
| bundle report   | pass, with a warning: initial 97.5 KB gz, +8.3 KB (+9.3%) vs baseline |
| ssr smoke       | pass: 4 of 4 routes                                                   |

The first run was red on `build (prod)` (the budget error above). That is the only fix round. The baseline dir
was clean after both runs.

**The bundle-report warning is not caused by this diff.** A/B prod builds (CLI "Initial total", estimated transfer):

| Tree                                           | Initial total (est. transfer) |
| ---------------------------------------------- | ----------------------------- |
| HEAD (`10b2c23`)                               | 395.56 kB                     |
| this diff without `withIncrementalHydration()` | 393.01 kB                     |
| this diff                                      | 393.04 kB                     |

So incremental hydration costs +0.03 kB, the two lazy routes save −2.55 kB, and the net is −2.52 kB vs HEAD.
The +8.3 KB vs the recorded baseline was already in HEAD. ⚠️ It also disagrees with the "88.8 KB gz, unchanged"
recorded in phase-09-partner-platform, and I could not reconcile the two: the bundle-report script is a harness
file I cannot read. **Worth re-recording the bundle baseline** (your job, §2.3).

Lazy chunks created: `page-not-found` (`chunk-AW2E7RN3.js`) and `compliance` (`chunk-GRFXJBUR.js`), both absent
from the initial file list.

## 3. Decisions needed / skipped / suspicious

- **Decision: how to get `video-js.css` (~47 KB raw) off the global stylesheet, or accept that it stays.**
  The option not taken is a lazy global style bundle: an `angular.json` `styles` entry with `inject: false`,
  and the players adding a `<link>` themselves. It avoids the budget but costs a hand-rolled loader, an unhashed
  file name (a skew/caching risk) and a possible flash of unstyled controls. My recommendation: leave it global.
- No `@Injectable` kept or added. No CSS files added. No heavy-library service left eager in `core/services`.
- Logged, not changed: invoice's `html-to-pdf` `injectAsync` has no prefetch. Whether it gets `onIdle` is the
  `features/payment` row's call.

## 4. Visual QA list

- `/page-not-found`, `/maintenance` and `/compliance` render as before, including direct loads (SSR) and client
  navigation.
- One `@defer`-heavy page (a masterclass course page): placeholders, then content, with no hydration errors in the
  console.

## 5. Commit message

```
perf(core): enable incremental hydration and lazy-load two eager routes

- provideClientHydration gains withIncrementalHydration(); event replay and
  transfer cache are kept, and no hydrate triggers are added yet
- PageNotFound (page-not-found, maintenance) and Compliance move to loadComponent
- moving video-js.css off the global stylesheet was reverted: as a component
  style it breaks the 16 kB anyComponentStyle budget

Initial bundle −2.5 kB vs HEAD (A/B prod builds).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
