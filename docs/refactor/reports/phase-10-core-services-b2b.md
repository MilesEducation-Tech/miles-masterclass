# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B2b

Date: 2026-09-26 · Branch: `refactor/structure-10` · Fifth batch. With this, **every dialog under `features/` is on
ng-primitives**. The row stays 🟡 until B3 (admin) and B4 (`UtilsDialog` + deleting the service).

## 1. Summary

The last nine feature dialogs moved onto the shell.

| Dialog                     | In the shell                                                                          | Openers                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `AssessmentResultDialog`   | `maxWidth="500px"`, "Final assessment result", `[dismissible]="false"`                | `final-assessment-exam`                                                              |
| `HtmlContentDialog`        | `maxWidth="100%"`, label is `data.title`                                              | `micro-learning-course`, `video-chapter` (transcript), `course-resources` (glossary) |
| `SelectCpeMode`            | `maxWidth="100%"`, "Choose a CPE mode", `[dismissible]="false"`                       | `masterclass-facade`                                                                 |
| `MicroLearningAboutPanel`  | **drawer** (`position="right"`), "About this course"                                  | `micro-learning-course`                                                              |
| `MicroLearningFilterSheet` | label derived from `data.title`, which reproduces "Filter by field of study" exactly  | `micro-learning-course`                                                              |
| `MicroLearningQuizDialog`  | `maxWidth="100%"`, "Chapter quiz" (inline template; doc comment rewritten)            | `micro-learning-course-facade`                                                       |
| `CourseFiltersDrawer`      | **drawer**, "Course filters"                                                          | library `course` page                                                                |
| `CairaBadgeInfoDialog`     | "CAIRA badge details"                                                                 | `caira-level-hero`                                                                   |
| `CpeComplianceDialog`      | `maxWidth="100%"`, `panelClass="bg-transparent shadow-none"` (kept), "CPE compliance" | tracker orchestrator                                                                 |

- **Own dialog attributes removed.** Each dialog's root lost its own `role="dialog"`, `aria-labelledby`,
  `aria-describedby` and `aria-modal`, which the shell now owns. A few heading `id`s that those attributes pointed at
  remain as harmless markup.
- **Setters replaced.** The `set data` setters on `CairaBadgeInfoDialog` and `CpeComplianceDialog` now initialise the
  private signal from the injected ref. The caira comment "`Dialog.open` is a no-op on the server" was rewritten; the
  accurate reason is that the only opener is a click.
- **`course-about` now closes only the ng-primitives manager.** The reviewer verified every host of it: `CourseInfo`,
  `WebinarDetailsDialog`, `AiLabAgentDialog` and `MicroLearningAboutPanel` are all migrated, and the two page hosts
  aren't dialogs.
- **Still on the old service in these files:** the `UtilsDialog` opens in `final-assessment-exam`,
  `masterclass-facade`, `micro-learning-course-facade` and the tracker orchestrator keep `afterClosed$`, correctly.
- **Specs and stories.** `html-content-dialog`, `select-cpe-mode`, `cpe-compliance-dialog` and `final-assessment-exam`
  specs moved to DI; the exam spec mocks both managers. The `assessment-result`, `html-content` and `select-cpe-mode`
  stories moved to `provideStoryDialogRef()`. The spec rewrite is now a reusable script for B3.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**, with 169 files / 599 passed +
1 skipped.

`reviewer`: **PASS**, zero violations. It confirmed:

- the per-ref `afterClosed` renames;
- no `this.dialog.open(` remains for these 9 dialogs;
- no old-service host remains for `course-about`;
- the 4 changed specs pass (11 tests);
- lint is clean.

**Browser:** the library's course-filters drawer **could not be exercised in this environment. That is not caused by
this change.**

- The course library's `v2/library-filters/` request returns **404** here.
- `course-facade.ts:45` reads that resource's `.value()` without a `.hasValue()` guard, so it throws
  `ResourceValueError` on every change detection. The page is broken locally before any dialog opens, and the old
  drawer would have failed the same way.
- The drawer layout itself (`position="right"`, full height) was already verified in the browser in B2a with the cart
  drawer, through the same shell.
- The micro-learning dialogs also need course data, which is empty locally.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Found, not fixed (logged for `features/library`'s Phase 9 session, still ⬜):** `course-facade.ts:45`,
  `libraryFilters = computed(() => this.libraryFiltersResource.value()?.data)`. This violates PROMPT.md §4.2 ("guard
  every `.value()` read with `.hasValue()`"). When that endpoint fails, **the whole course library page throws on every
  change detection.** It is worth checking against production: if `library-filters` ever errors there, the page breaks.
- **Intentional:** new accessible names where none existed:
  - "Final assessment result"
  - "Choose a CPE mode"
  - "CPE compliance"
  - HTML dialogs now take their title as the label.
    `SelectCpeMode`'s `aria-describedby="modal-description"` was dropped along with its role; its text is still visible.
- **Size:** the diff is +673 / −741 across 34 files, but **+211 / −279 ignoring whitespace**.
- **Remaining on the old service:**
  - **B3:** 13 admin dialogs.
  - **B4:** `UtilsDialog`, with 18 calls across features, admin and shared.

## 4. Visual QA list

1. **Final assessment → submit → the result dialog.** Escape and backdrop must not close it; its buttons must work.
2. **Masterclass → choose a CPE mode.** It is not dismissible, and picking a mode proceeds.
3. **Transcript and glossary** (`HtmlContentDialog`) from a masterclass chapter and the course resources.
4. **Micro-learning:**
   - the "About" drawer from the right, whose instructor link closes it and navigates;
   - the field-of-study filter sheet;
   - the chapter quiz.
5. **Course library (mobile width) → Filters drawer.** This needs a working `library-filters` endpoint; see §3.
6. **CPE tracker:**
   - the compliance dialog, with its transparent panel intact;
   - the CAIRA badge details dialog, with its tabs.

## 5. Commit message

```
refactor(offerings): move the remaining feature dialogs onto the ng-primitives shell

- AssessmentResult, HtmlContent, SelectCpeMode, MicroLearningAboutPanel
  (drawer), MicroLearningFilterSheet, MicroLearningQuiz, CourseFiltersDrawer
  (drawer), CairaBadgeInfo and CpeCompliance render in <app-dialog-shell>
  and read their data via injectDialogRef()
- course-about's instructor link closes only the ng-primitives manager now
  that every dialog hosting it has migrated
- specs and stories move to provideMockDialogRef/stubDialogShell and
  provideStoryDialogRef

Batch B2b of the Dialog service migration (Phase 10, core/services).
```
