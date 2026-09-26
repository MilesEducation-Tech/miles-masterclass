# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B4 (final)

Date: 2026-09-26 · Branch: `refactor/structure-10` · Seventh and last batch. **The hand-rolled `Dialog` service is
deleted.** Every dialog in the app now opens through `NgpDialogManager` and renders in `<app-dialog-shell>`. The
`core/services` Phase 10 row is ✅.

## 1. Summary

- **`UtilsDialog`** is now wrapped in the shell and uses `injectDialogRef<UtilsDialogData, UtilsDialogResult>()`.
  - It is the one dialog that serves many callers with different sizes, so the old per-call presentation config moved
    into its data. `UtilsDialogData` gains optional `width`, `maxWidth`, `ariaLabel` and `disableClose`. This follows
    the `CalendlyDialogData.ariaLabel` precedent from B1a.
  - The shell label is `data.ariaLabel ?? data.title ?? 'Dialog'`. Before, the inner panel was `aria-labelledby` the
    title. The inner `role`, `aria-modal`, `aria-labelledby` and `aria-describedby` are removed, because the shell
    owns them now.
  - `containerClass` is now optional. Five callers never passed it, which the old `data: unknown` hid.
  - `data` is available at construction, so the "plain getter because data is assigned later" workaround became a
    field.
  - New exported type: `UtilsDialogResult`.
  - The spec now uses `stubDialogShell` + `provideMockDialogRef` and gains a real close-result assertion. The 4
    stories now use `provideStoryDialogRef`.
- **18 call sites in 14 files** were rewritten by script, the same brace-matching approach as B3:
  - Presentation keys moved into `data`. A variable was spread when needed, e.g. `{ ...SIGNUP_DIALOG_DATA, width, maxWidth, ariaLabel }`.
  - Dropped only defaults and fixed values: `enterAnimationDuration`/`exitAnimationDuration: '300ms'` (the shell's
    fixed timing), `width: 'auto'` and `disableClose: false`.
  - `disableClose: true` is kept on `masterclass-chapter` and `invoice`.
  - Renamed `.afterClosed$` → `.afterClosed`. After this batch no old-service ref remains in these files.
  - None of these call sites passed an injector. `UtilsDialog` needs no route-scoped providers.
- **Deleted:**
  - `core/services/dialog/dialog.ts` (325 LOC) and `dialog.spec.ts`
  - `src/styles/dialog.css` and its 3 `angular.json` style entries (build, storybook, build-storybook)
  - `MockDialogRef` from `testing/mocks/dialog.mock.ts`, which had no users left
- **Last consumers:**
  - `video-poster` now listens only to `NgpDialogManager.afterOpened`, so `merge` is gone.
  - `chapter-facade`'s unused `inject(Dialog)` is removed.
- **Specs:** `webinar-facade`, `final-assessment-exam` and `tracker-dialog-orchestrator` now mock only
  `NgpDialogManager`. Their assertions are unchanged, and `final-assessment-exam` now asserts `UtilsDialog` on it.
- **Stale comments fixed:** `tracker-dialog-orchestrator` class doc, `micro-learning-course-facade` injector doc, and
  `engagement-dialog` `closeAll` note.
- **Size:** `src` + `angular.json` changed by **+248 / −699 ignoring whitespace**. The raw count is +553 / −1004,
  mostly the re-indented `utils-dialog.html`.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result |
| --------------- | ------ |
| lint            | pass   |
| unit tests      | pass   |
| build (local)   | pass   |
| build (prod)    | pass   |
| storybook build | pass   |
| format check    | pass   |
| bundle report   | pass   |
| ssr smoke       | pass   |

- **Tests:** 168 files, 599 passed + 1 skipped. B3 had 169 files; the difference is the deleted `dialog.spec.ts`.
- **Bundle:** initial is 88.5 KB gzip, **−0.7 KB (−0.8%)** against the baseline. The hand-rolled service and the
  global dialog CSS are gone from `main`.
- **SSR smoke:** all 4 routes OK.
- **`reviewer`: PASS.** It checked:
  - every call site's size, label and close policy against `HEAD`
  - that the rename touched only old refs
  - that no reference to the deleted files remains
  - that no spec was weakened

  Its one note was whitespace churn in STATE.md from the formatter hook.

- **Browser:** not run for this batch. The shell is the one verified in B0–B2a. What changed here is how
  `UtilsDialog` gets its data and size; the spec covers the data path, and the list in §4 covers the rest.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.** Nothing new is kept as `@Injectable`, and no CSS file was added.
- **Small behaviour change:** focus now returns to the opener, same as every earlier batch.
- **Small behaviour change:** a `UtilsDialog` with no `ariaLabel` is now labelled by its title instead of "Dialog".
- **`WebinarRegistrationDialog` is still orphaned.** Nothing opens it, and deleting it needs your approval. To let
  the service go, it was only moved onto `injectDialogRef` and the shell (label "Reserve your seat"). Deleting it and
  its dependency tree is still queued.
- **`core/services/dialog/` now holds only `feature-dialog-tokens.ts`.** That is fine where it is. Moving it would be
  a Part A-style move, so it is not done here.
- **`utils-dialog.css` is empty.** Deleting it is Phase 12 work (Tailwind) and was not mixed in here.

## 4. Visual QA list

For each dialog, check four things:

- the width is unchanged
- Escape and the backdrop close it, except where marked
- focus returns to the button that opened it
- the confirm/cancel result still acts

Dialogs to check:

1. **Plan page (signed out):** subscribe → "Sign up to access content" (500 px).
2. **Course feedback, with an incomplete profile:** the profile prompt (500 px).
3. **Masterclass chapter:** the gate dialog (32rem). **Not dismissible.**
4. **Invoice:** its confirmation (32rem). **Not dismissible.**
5. **CPE / Preview mode switch** on masterclass and micro-learning (full width).
6. **Final assessment:**
   - Exit confirmation.
   - Submit with unanswered questions: clicking a question in the list jumps to it.
   - Start-exam rules (from `Utils`).
7. **Profile:** leave the page with unsaved answers.
8. **Webinar:** register while signed out (28rem).
9. **AI Labs:** the confirm prompts.
10. **CPE tracker:** download while restricted → Upgrade.
11. **Additional Resources links** dialog (from `Utils`).
12. **Admin, needs sign-in:**
    - SEO dashboard confirm.
    - Onboarding v2: user details and payment-recorded (560 px).
13. **Video poster:** a playing preview pauses when any dialog opens.

## 5. Commit message

```
refactor(core): move UtilsDialog onto ng-primitives and delete the Dialog service

- UtilsDialog renders in <app-dialog-shell> via injectDialogRef; its
  per-caller width/maxWidth/ariaLabel/disableClose now travel in
  UtilsDialogData, and it is labelled by its title by default
- 18 call sites open it via NgpDialogManager; afterClosed$ -> afterClosed
- delete core/services/dialog/dialog.ts, its spec and styles/dialog.css
  (+ angular.json entries); video-poster listens to one manager
- orphaned WebinarRegistrationDialog typed onto injectDialogRef; unused
  MockDialogRef and chapter-facade's dead Dialog inject removed

Batch B4 (final) of the Dialog service migration (Phase 10, core/services).
```
