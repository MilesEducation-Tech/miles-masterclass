# Phase 11 — `features/tracker` (caira + cpe)

## 1. Summary

3 files changed (plus 1 spec), no new files, no moves.

- **`TrackerDialogOrchestrator`: 3 dialogs lazy-load** (§4.4): `CertificateDownloadDialog`, `UtilsDialog` and
  `CpeComplianceDialog`.
  - Each method still returns the dialog's `afterClosed` stream, now as
    `from(import(…).then(open)).pipe(switchMap(ref => ref.afterClosed))`.
  - **The open sits in the promise, not the stream**, so the dialog opens whether or not the caller subscribes.
    That keeps the fire-and-forget caller (`certificate-download.ts:171`) working as before.
  - Its spec now awaits the open.
- **`CertificateDownload` → `injectAsync`** (§4.5, required candidate "certificate-download / zip generation"):
  - `cpe-tracker` injects it with `{ prefetch: onIdle }`, since downloads are the page's main action.
  - Only an `import type` remains in production code.
  - The three triggers (row download, NASBA, all certificates) go through one private `withCertificates(run)`,
    which **toasts on load failure**.
  - The service is `@Service()` with default options and runs only from event handlers, so it is eligible.
    Its constructor's debounced streams run when the chunk resolves.
- **Survey — already compliant, no change:**
  - jszip is `import()`ed in `shared/utils/blob-download`.
  - `caira-level-hero` already lazy-opens its dialog.
  - No heavy children, no `@defer` needed.
  - `certificate-access-policy` and `badge-actions` import nothing heavy, so they stay on plain `inject()`.

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

- Initial is unchanged: 88.0 KB gz (−1.3% vs baseline). "Initial total" is 242.43 kB (was 242.40).
- Lazy: 303 chunks, 4119.6 KB gz.
- **§4.5 "Verify" check:**
  - The `CertificateDownload` service is in its own chunk (`chunk-26J72V5E`, 3.3 KB, found by `download_bulk_certificate`),
    separate from the `cpe-tracker` page chunk (`chunk-LAHKCFIP`, 18.2 KB).
  - `app-cpe-compliance-dialog` is in its own chunk (`chunk-FJJTEQOL`, 4.8 KB).
  - jszip was already its own chunk.

## 3. Decisions needed / skipped / suspicious

- **Deviation, decision requested: no loading/disabled state while the lazy service resolves.** §4.5 says to
  "disable the trigger and show a loading state while it resolves". Only the failure toast is done.
  - Why: the triggers are outputs of two presentational children (`portfolio-summary`, `tracker-table`), so a
    disabled state needs new inputs and bindings in both.
  - Why it is low risk: the chunk is prefetched on idle, and the service already de-duplicates rapid clicks
    (`debounceTime` + `exhaustMap`).
  - Your call: **accept as is**, or add a `busy` input to both children in a follow-up.
- No `@Injectable` kept or added, no CSS files, no heavy-library service left eager.

## 4. Visual QA list

On `/…/cpe-tracker`, signed in:

- Row "Download" opens the certificate dialog.
- A restricted row shows the "Download Restricted" dialog, and "Upgrade" still works.
- "Download NASBA template" and "Download all certificates" download as before.
- "View compliance" opens the compliance dialog.

## 5. Commit message

```
perf(tracker): lazy-load the tracker dialogs and the certificate download service

- TrackerDialogOrchestrator loads CertificateDownloadDialog, UtilsDialog and
  CpeComplianceDialog with import(); each still opens on call, not on
  subscribe, and returns the same afterClosed stream
- cpe-tracker gets CertificateDownload through injectAsync (prefetch on idle),
  with a toast if the chunk fails to load

Initial bundle unchanged; the service and each dialog are now their own chunks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
