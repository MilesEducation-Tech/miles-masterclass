# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B1b

Date: 2026-09-26 · Branch: `refactor/structure-10` · Third batch. With this, **`shared/dialogs` is done except for
`UtilsDialog` (B4)**. The row stays 🟡.

## 1. Summary

The nine connected `shared/dialogs` moved onto the B0 pattern together, because some of them open others. A migrated
child opened from a not-yet-migrated parent would render behind it.

| Dialog                                                                                   | In the shell                                                     | Notes                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CourseInfo` (slider, `utils.openCourseInfoDialog`)                                      | `maxWidth="100%"`, `[dismissible]="false"` (kept)                | Both callers passed `ariaLabel: 'Confirmation dialog'` and `ariaDescribedBy: 'dialog-description'`, pointing at an element that doesn't exist, apparently copied from a confirmation dialog. **It is now labelled by the course title.** |
| `WebinarDetailsDialog` (utils)                                                           | `maxWidth="100%"`, label is the webinar title                    | `environmentInjector` became the `injector` config, so the route-scoped providers still resolve.                                                                                                                                         |
| `ShareDialog` (utils; opened from `CourseInfo`, `WebinarDetailsDialog` and course pages) | `maxWidth="100%"`, "Share"                                       | Its own `role="dialog"` was removed.                                                                                                                                                                                                     |
| `CertificateDownloadDialog` (utils, library `badge`, tracker orchestrator)               | `maxWidth="100%"`, "Download certificate"                        | —                                                                                                                                                                                                                                        |
| `VideoDialog` (utils, `course-resources`)                                                | `maxWidth="100%"`, label is the title, or "Video"                | Inline template. The unused `video-dialog-panel` class was dropped.                                                                                                                                                                      |
| `AiLabDialog` (engagement)                                                               | `maxWidth="95vw"`, `panelClass="rounded-[24px] overflow-hidden"` | The `!` modifiers are gone. They existed only because the old service concatenated classes without tailwind-merge, and the shell merges with `cn()`.                                                                                     |
| `ProfileCompletionDialog` (engagement)                                                   | `maxWidth="95vw"`, `[dismissible]="false"`                       | Its own `role="dialog"` was removed.                                                                                                                                                                                                     |
| `BadgeInfoDialog`, `BadgeClaimUpsellDialog`                                              | labelled from their headings                                     | **Never opened anywhere.** Migrated only so the old service can be deleted in B4. Their `set data` setters now initialise the private signal from the injected ref.                                                                      |

**Coexistence plumbing:**

- `course-about`'s instructor click calls `closeAll()` on **both** managers. It renders inside `CourseInfo` and `WebinarDetailsDialog` (now ng-primitives) and inside `MicroLearningAboutPanel` (still on the old service until B2).
- `engagement-dialog`'s `afterClosed(ref, closed$)` helper now takes the close handle and the stream separately, because `SubscriptionDialog` stays on the old service until B2. `afterClosedOld` wraps it.
- The old service is still used in `utils.ts` (`UtilsDialog`, cart drawer, `SubscriptionDialog`) and in the tracker orchestrator (`CpeComplianceDialog`), both correctly untouched.

Specs and stories moved to `stubDialogShell()`, `provideMockDialogRef()` and `provideStoryDialogRef()`. The
orchestrator spec now mocks `NgpDialogManager` for the certificate path.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**, with 169 files / 599 passed +
1 skipped. The first run was red on `lint`, for two result-type imports in the badge specs that became unused once
their setups moved to DI. I removed them and re-ran.

`reviewer`: **PASS**, zero violations. It confirmed:

- every `afterClosed$` → `afterClosed` change sits on a migrated ref, while the old-service refs in `utils.ts` and the orchestrator keep `afterClosed$`;
- no `this.dialog.open(` remains for these 9 dialogs;
- `engagement-dialog` stays gated behind `isPlatformBrowser`, and every other switched call site is a click handler.

**Real browser: the nested pair, driven through the running app's own `Utils` service.** No page reaches
`CourseInfo` locally, because the course APIs are empty; I opened it with Angular's dev-mode `ng` debug global and a
minimal card.

- `CourseInfo` opens, labelled "Test Course". Its Share button opens `ShareDialog` **on top**: later in the DOM, at
  the same z-index, with focus moved inside.
- **Escape closes only Share.** Focus then goes **back to the Share button inside `CourseInfo`**, and `CourseInfo`
  still ignores Escape because it is non-dismissible, as before.
- `course-about`'s `closeAll` path removes the dialog.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Intentional:** the `CourseInfo` accessible name went from the wrong "Confirmation dialog" to the course title.
  `AiLabDialog` and `VideoDialog` now use the shared 300 ms timing.
- **Pre-existing, logged, not fixed:**
  - **`<app-button [attr.aria-label]>` doesn't reach the real button.** `CourseInfo`'s bookmark and share icon buttons set `aria-label` on the `<app-button>` host, so the inner `<button>` has no accessible name; the browser check found both unlabelled. This probably affects other icon-only `app-button`s too. It belongs to a `shared/ui` button fix: forward the label through the button's existing `ariaLabel` input.
- **Size:** the diff is **+763 / −795 across 32 files**, but **+219 / −251 ignoring whitespace**. The rest is templates re-indented under the shell.
- **Remaining on the old service:** 22 dialogs in `features/*` (B2) and `admin/*` (B3), plus `UtilsDialog` (B4).

## 4. Visual QA list

1. **Course cards: the "i" or more-info button → `CourseInfo`.** Check its hero, Watch Now, bookmark, and Share. Share
   must open **above** it, and closing Share returns you to `CourseInfo`.
2. **Webinar cards → the webinar details dialog.** Book and share.
3. **Certificate download** from the badge library, the CPE tracker and course pages.
4. **Course trailer / resources video** (`VideoDialog`): check the size and the player.
5. **Signed-in engagement prompts:** the AI Labs announcement (rounded 24 px card, no square corners showing) and
   profile completion. Profile completion must not close on Escape or backdrop.

## 5. Commit message

```
refactor(shared): move the linked shared dialogs onto the ng-primitives shell

- CourseInfo, WebinarDetailsDialog and ShareDialog migrate together so
  Share still stacks above its parent; course-about closes both managers
- CertificateDownload, Video, AiLab and ProfileCompletion dialogs, plus the
  never-opened badge dialogs, render in <app-dialog-shell>
- CourseInfo is labelled by its course title instead of the copied
  "Confirmation dialog"; AiLabDialog drops the `!` its panelClass needed
- engagement-dialog's afterClosed helper handles both managers until
  SubscriptionDialog migrates

Batch B1b of the Dialog service migration (Phase 10, core/services).
```
