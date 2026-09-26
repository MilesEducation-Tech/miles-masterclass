# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B0

Date: 2026-09-25 · Branch: `refactor/structure-10` · Batch 1 of 5. The row stays 🟡 until B4.

## 1. Summary

Your decision (STATE.md "Decisions") is to **migrate every dialog directly onto ng-primitives** and then delete the
hand-rolled `Dialog` service. That covers 88 `open()` calls in 49 files and 43 opened dialog classes. B0 lays the
foundation and proves the pattern end to end on two dialogs. The old service and ng-primitives coexist until B4.

| Change                                                   | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New `shared/ui/dialog-shell/`** (`<app-dialog-shell>`) | The frame every dialog renders inside: `ngpDialogOverlay` (backdrop, z-1000) wrapping `ngpDialog` (panel). ng-primitives supplies `role="dialog"`, `aria-modal`, the focus trap, **focus restore to the opener**, Escape (topmost dialog only), backdrop close, the scroll lock on `<html>`, and `aria-hidden` on the rest of the page. Inputs: `ariaLabel`, `width` / `maxWidth` / `height`, `position` (`center` or `right` drawer), `panelClass` (merged with `cn()`), and `dismissible` (`false` is the old `disableClose: true`). The CSS holds only the enter/exit keyframes carried over from `dialog.css`, keyed on `[data-exit]`, which ng-primitives waits on before removing the dialog. |
| `app.config.ts`                                          | `provideDialogConfig({ closeOnNavigation: false })`, your parity decision. ng-primitives' default would close every dialog on navigation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `testing/mocks/dialog-ref.mock.ts` (new)                 | `provideMockDialogRef(data)` for specs of migrated dialogs. It is kept out of `dialog.mock.ts` because stories import that file and this one imports vitest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `video-poster`                                           | Pauses on **either** manager's `afterOpened` while both exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **`AppDownloadDialog`** (`shared/dialogs`)               | Wrapped in the shell (`maxWidth="360px"`, labelled "Get the Miles Masterclass app"). `dialogRef!` became `injectDialogRef()`. Its own inner `role="dialog"`, which nested inside the service's, is removed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **`GlobalSearchDialog`** (`layout/dialogs`)              | Wrapped in the shell (`width="min(95vw, 720px)"`, `maxWidth="95vw"`, labelled "Global search"). `dialogRef!` became `injectDialogRef()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3 call sites                                             | `app-download-prompt`, `home-hero` and `footer-overlay.openSearch` now call `NgpDialogManager.open(X)`, and the size config moved into each dialog. **All 3 are browser-only** (`isPlatformBrowser` or a user event), so the old service's server-side no-op isn't needed. `footer-overlay` keeps the old `Dialog` for `CalendlyDialog` until that dialog migrates.                                                                                                                                                                                                                                                                                                                                 |

**Why these two first:** a migrated dialog opened _from_ an old one would sit behind it. The old service stacks at
z-index 1000 + 2n, and the shell sits at 1000. Both of these are opened only from pages. **Nested pairs must migrate
together:** `CourseInfo` / `WebinarDetailsDialog` → `ShareDialog`, and `SubscriptionDialog` → cart drawer /
partner-code prompt / firm sponsorship.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**. That covers lint, unit tests,
the local and prod builds, the Storybook build, format, the bundle report and SSR smoke. The unit-test gate now runs
behind the network guard from `a0d6d18`.

`DialogShell` spec (5 tests, driving the real `NgpDialogManager`):

- a labelled modal panel with data and size;
- focus moves in and comes back to the opener;
- `afterClosed` delivers the result;
- the backdrop and Escape close it;
- `dismissible=false` ignores both.

`reviewer`: **PASS**, zero violations. It also confirmed that all 3 switched call sites are SSR-safe.

**Real browser** (`ng serve`, real key and mouse events):

- **Global search:** ⌘K opens it modal, labelled "Global search", 720 px wide, with focus in the search input, `<html>`
  scroll-locked and `app-root` set to `aria-hidden`. Escape closes it and both of those are cleaned up.
- **App download:** opened from the home hero on a desktop user agent. It is centred, 360 px wide, and has **exactly
  one** `role="dialog"`. Focus lands on Close, and six Tabs stay inside. A real backdrop click closes it and **focus
  returns to the hero's "Download App" button**; the old service left focus on `<body>`.

**Bundle:** `ng-primitives/dialog` is lazy with its dialogs. Nothing eager imports it except `video-poster`'s
`afterOpened` listener and the `provideDialogConfig` token in `app.config.ts`.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Intentional differences:**
  - Global search now animates at the shared **300 ms** instead of its own 200 / 180 ms.
  - `aria-hidden` on the page, focus restore, and the `<html>` scroll lock are new for these two dialogs, as decided.
- **Size:** the diff is **+497 / −156**, over the ~400-line guideline. Most of it is the two templates re-indented
  under `<app-dialog-shell>` (`git diff -w` is much smaller), plus the shell's own spec and stories. I didn't split it,
  because B0 is the pattern every later batch copies.
- **Still using the old service:** 86 call sites and 41 dialogs, for B1–B4. The `body:has(.custom-dialog-backdrop)`
  scroll rule and `dialog.css` stay until B4, which deletes them with the service.

## 4. Visual QA list

1. **⌘K / Ctrl+K on any page with the footer overlay.** Check the search dialog's size and position; its entry is
   slightly slower (300 ms).
2. **Home hero → "Download App" on desktop, and the mobile prompt on phones** (`app-download-prompt`, once per
   session). Check the card and the dimmed backdrop, and that Close, backdrop click and Escape all close it.
3. **Storybook → UI/DialogShell**: the Centered, Drawer and NotDismissible stories.

## 5. Commit message

```
refactor(shared): add ng-primitives dialog shell and migrate first two dialogs

- shared/ui/dialog-shell: ngpDialogOverlay + ngpDialog frame (role, focus
  trap + restore, Escape/backdrop, scroll lock, exit animation), with
  size/position/dismissible inputs; spec (5) + stories
- provideDialogConfig({ closeOnNavigation: false }) keeps today's behaviour
- AppDownloadDialog and GlobalSearchDialog move to the shell and
  injectDialogRef(); their 3 call sites open via NgpDialogManager
- video-poster pauses on either manager while both exist
- testing: provideMockDialogRef() for migrated dialogs' specs

Batch B0 of the Dialog service migration (Phase 10, core/services).
```
