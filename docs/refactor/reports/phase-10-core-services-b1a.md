# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B1a

Date: 2026-09-25 · Branch: `refactor/structure-10` · Batch 2 of the migration. B1 was split into B1a (leaf dialogs)
and B1b (the linked set). The row stays 🟡.

## 1. Summary

Seven `shared/dialogs` moved onto the B0 pattern: wrapped in `<app-dialog-shell>`, with `dialogRef!` / `data!` turned
into `injectDialogRef()` and its `data`. Their **15 call sites** now use `NgpDialogManager.open(X, { data })`. None of
these dialogs is opened from inside another dialog, which is why they could go first.

| Dialog                                                                                             | Presentation moved into the dialog                       | Notes                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CalendlyDialog` (7 call sites: header, footer, footer-overlay, webinar-meet-cta, 3 partner pages) | `width="min(95vw, 760px)"`                               | Sites passed three different labels, so **`ariaLabel` was added to `CalendlyDialogData`**, with a fallback of "Schedule a call".                                                                                         |
| `BlockStatusDialog` (2 admin sites)                                                                | `maxWidth="480px"`                                       | Label computed from `isBlock()`: "Block user" / "Unblock user". Its own `role="dialog" aria-modal` was removed.                                                                                                          |
| `ApplyPartnerCodeDialog` (2 admin sites)                                                           | `maxWidth="480px"`, "Apply partner code"                 | Its own role/aria-modal was removed.                                                                                                                                                                                     |
| `AiLabAgentDialog`                                                                                 | `maxWidth="100%"`, label from `data.name`                | —                                                                                                                                                                                                                        |
| `AiLabTermsDialog`                                                                                 | `maxWidth="100%"`, "Miles AI Labs participant agreement" | Its `aria-labelledby` was replaced with the shell's `ariaLabel`. `ngpDialogTitle` can't be used from a dialog's own template: projected content resolves DI from where it is declared, not from the shell's `ngpDialog`. |
| `VersionUpdateDialog`                                                                              | `width="min(92vw, 420px)"`, `[dismissible]="false"`      | The unused `version-update-dialog` panel class was dropped; it had no CSS.                                                                                                                                               |
| `FilterDialog` (carousel)                                                                          | `maxWidth="100%"`, "Filters"                             | It had no label before, only the service default "Dialog".                                                                                                                                                               |

- **The old service was dropped** from the 7 caller files that no longer use it: header, footer, footer-overlay,
  carousel, update-checker, users and users-v2. It stays where `UtilsDialog` or `RecordPaymentDialog` still need it.
- **Test support:**
  - `testing/mocks/dialog-ref.mock.ts` gains **`DialogShellStub` + `stubDialogShell()`**. A dialog's component spec
    tests the dialog; the frame is already covered against the real manager by `dialog-shell.spec.ts`.
  - `testing/mocks/dialog.mock.ts` gains **`provideStoryDialogRef()`**, which has no vitest dependency, for stories.
- **Specs and stories updated:** `ai-lab-agent-dialog.spec`, `filter-dialog.spec`, `filter-dialog.stories` and
  `update-checker.spec`. The update-checker spec stubs `DOCUMENT`, so it now mocks `NgpDialogManager` as it used to
  mock `Dialog`.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**, with 169 files / 599 passed +
1 skipped. An earlier run was red on `format` for one file I had edited with `sed` after Prettier ran; that is fixed.

`reviewer`: **FAIL → fixed.** The one violation was a stale "property-injected by the Dialog service" comment in
`apply-partner-code-dialog.ts`. I found and fixed a second one in `ai-lab-agent-dialog.ts` as well. Both were
comment-only; the gates above ran after the fix.

- The reviewer independently confirmed that every call-site edit touched the right ref. `RecordPaymentDialog`, which
  is still on the old service in the same two admin files, is untouched.
- It confirmed no `this.dialog.open(` remains for these 7 dialogs, and that all switched call sites are SSR-safe:
  click handlers, plus `update-checker`, which runs behind `isPlatformBrowser`.

**Mistakes I made and caught:**

- A script renamed the wrong `ref.afterClosed$` in the two onboarding pages. The first occurrence belonged to the
  still-old `RecordPaymentDialog`. Typecheck caught it, and I corrected it by line.
- The dialog specs broke on the real shell with a mocked ref, which led to the stub.

**Browser check** (`ng serve`, `/us/accounting/cpe-for-corporate` → "Schedule Discovery Call"):

- **Calendly:** it opens modal with the label "Schedule a demo" passed through its data, width `min(95vw, 760px)`, and the Calendly content loaded. Focus moved inside, Escape closed it, and **focus returned to the button**.
- **Not browser-checked:**
  - the admin dialogs (they need an admin login);
  - the version-update dialog (it needs a new deploy);
  - the AI-lab dialogs (the assessment flag is off);
  - the carousel filter (the listing APIs are empty locally).
    Their specs, and the unchanged shell they share, cover them.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Size:** the diff is **+697 / −665 across 34 files**, larger than the ~400-line guideline, for the same reason as B0: whole templates re-indented
  under the shell. Ignoring whitespace it is much smaller. Every change in it is mechanical and of one kind.
- **Pattern notes for B1b onwards (recorded in STATE.md):**
  - Rename `afterClosed$` per ref, never per file.
  - Use `stubDialogShell()` in dialog specs.
  - Stories use `provideStoryDialogRef()`.
- **Remaining on the old service:** 31 dialogs and about 70 call sites.

## 4. Visual QA list

1. **"Schedule a demo" / discovery-call / "Book a 15-minute call"** from the header, footer, footer overlay, the
   corporate, BKN and Illinois pages, and webinar pages. Check the Calendly frame's size and that Close works.
2. **Admin: Users and Onboarding** → Block/Unblock user and Apply partner code dialogs (480 px).
3. **AI Labs:** an agent tile's details dialog and the participant agreement, with the entry animation now at a uniform 300 ms.
4. **A carousel with filters → the Filters dialog.**
5. **The version-update dialog** after the next deploy. It must not be closable by Escape or backdrop.

## 5. Commit message

```
refactor(shared): move seven leaf dialogs onto the ng-primitives shell

- CalendlyDialog, BlockStatusDialog, ApplyPartnerCodeDialog,
  AiLabAgentDialog, AiLabTermsDialog, VersionUpdateDialog and FilterDialog
  render in <app-dialog-shell> and read their data via injectDialogRef()
- their 15 call sites open via NgpDialogManager; size and labels move into
  each dialog (CalendlyDialogData gains ariaLabel for its per-site labels)
- testing: DialogShellStub/stubDialogShell() for dialog specs,
  provideStoryDialogRef() for stories

Batch B1a of the Dialog service migration (Phase 10, core/services).
```
