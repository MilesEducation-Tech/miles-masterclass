# Phase 11 — `shared/services`

## 1. Summary

2 source files changed, no new files, no moves. **6 programmatically opened dialogs now lazy-load** (§4.4):

| Service            | Dialogs → `import()` at their open site                                            | Why it mattered                                              |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Utils`            | `UtilsDialog` (3 sites), `ShareDialog`, `CertificateDownloadDialog`, `VideoDialog` | `Utils` is injected by the header and footer: initial bundle |
| `EngagementDialog` | `AiLabDialog`, `ProfileCompletionDialog`                                           | built by `app.ts`: initial bundle                            |

- Only `import type` remains for the dialogs' data and result types.
- The pattern matches what was already there: `openCourseInfoDialog`'s `await import()` in `Utils`, and the
  `SUBSCRIPTION_DIALOG` `from(promise)` path in `EngagementDialog`.
- These methods became `async`, and every caller fires and forgets (the reviewer checked every `.ts` and `.html` caller):
  - `startFinalAssessment`
  - `openCertificateDownloadDialog`
  - `openPurchaseGateDialog` (private)
  - `openShareDialog`
  - `openVideoDialog`
  - the `openAdditionalResources` `next` handler
- The early-return guards still run before the import.
- `EngagementDialog`'s streams still complete when the dialog closes.
- Already lazy, and untouched: `CourseInfo`, `WebinarDetailsDialog`, `CartDrawerDialog` / `SubscriptionDialog`
  (tokens), and `UpdateChecker`'s `VersionUpdateDialog`.
- No heavy library lives in `shared/services`, so there are no `injectAsync` candidates (§4.5).

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

**Bundle deltas vs the previous commit (`242cc9c`):**

| Measure                                    | Before    | After     | Δ                   |
| ------------------------------------------ | --------- | --------- | ------------------- |
| bundle report, initial gzip (12 files)     | 97.5 KB   | 88.0 KB   | −9.5 KB             |
| bundle report vs recorded baseline         | +9.3%     | −1.3%     | the warning cleared |
| prod build "Initial total" (est. transfer) | 393.04 kB | 242.28 kB | −150.8 kB           |

All six dialogs were confirmed in lazy chunks, absent from the initial file list: `app-utils-dialog`,
`app-share-dialog`, `app-certificate-download-dialog`, `app-video-dialog`, `app-ai-lab-dialog`,
`app-profile-completion-dialog`. `UtilsDialog` and `CertificateDownloadDialog` are still statically imported by
lazy feature pages, so they share lazy chunks with those pages. They left the initial bundle all the same.

The size of the drop (−150 kB estimated transfer) is larger than the six dialogs' own code. The dialogs' import
graphs, such as the video player, the certificate/badge UI and form dependencies, left the initial path with them.
I have not attributed it chunk by chunk.

## 3. Decisions needed / skipped / suspicious

- None needed. No `@Injectable` kept or added, no CSS files, no heavy-library service left eager.
- **Behaviour note:** the first open of each dialog now waits for its chunk (prefetched by nothing). On a slow
  network, that means a short delay after the click. §4.4 does not ask for a prefetch here. If you want one,
  it is a `prefetch` via `core/utils/prefetch-triggers.ts`, which does not exist yet.
- **No failure handling on a chunk-load error**, the same as the existing `CourseInfo` and subscription paths: the
  click does nothing. Logged, not changed.

## 4. Visual QA list

Each should open as before, now after a short chunk load:

- The share dialog (course card share).
- The trailer video dialog (course hero "Watch trailer").
- The certificate download dialog (CPE tracker), plus its purchase-gate variants on a subscription-excluded course.
- The final-assessment rules dialog → "Start Exam".
- The additional-resources dialog.
- The AI Lab announcement and the profile-completion dialog (the engagement timer on the home page, signed in).

## 5. Commit message

```
perf(shared): lazy-load the six dialogs Utils and EngagementDialog open

Utils (header/footer) and EngagementDialog (app root) sit in the initial
bundle, so their static dialog imports did too. UtilsDialog, ShareDialog,
CertificateDownloadDialog, VideoDialog, AiLabDialog and ProfileCompletionDialog
now load with import() when opened; only their types stay static.

Initial estimated transfer 393 kB → 242 kB; bundle report 97.5 → 88.0 KB gz.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
