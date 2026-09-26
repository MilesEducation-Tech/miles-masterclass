# Phase 11 — `shared/dialogs`

## 1. Summary

**No source change: the row was already compliant.** Audited 18 dialog folders against §4.4 and §4.5:

- **No static heavy-library import.**
  - `video-dialog` renders `VideoJs`, which `import()`s video.js and its plugins.
  - `certificate-download-dialog` uses `shared/utils/blob-download`, which `import()`s jszip.
  - `calendly-dialog` injects Calendly's widget script at runtime, only when it opens.
- **No dialog opens another from a static import.** `course-info` and `webinar-details-dialog` open the share
  dialog through `Utils.openShareDialog()`, which has lazy-loaded `ShareDialog` since `fb7cf42`
  (the `shared/services` row).
- **No `@defer` blocks, and no §4.4 always-defer children.**
- **No services** (only `@Component`s), so there are no `injectAsync` candidates.

The static imports of these dialogs belong to their **openers**, which the openers' own rows fix, as
`shared/services` and `shared/components` did.

## 2. Verification

`src/` is identical to `adc83e7`, the tree the `verifier` ran 8/8 green for the `shared/components` close (190 files
/ 698 passed + 1 skipped; initial 88.0 KB gz, −1.3% vs baseline). No new run was needed for a docs-only change.
The `reviewer` audit was a **PASS**.

## 3. Decisions needed / skipped / suspicious

- **None needed.**
- **For the `layout` row:** `CalendlyDialog` is statically imported by `layout/header`, `layout/footer` and
  `layout/footer-overlay`, and `GlobalSearchDialog` by `footer-overlay`. All four are initial-bundle files, so these
  are the next dialogs to move to `import()`.

## 4. Visual QA list

None, since nothing changed.

## 5. Commit message

```
docs(refactor): close Phase 11 for shared/dialogs (already compliant)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
