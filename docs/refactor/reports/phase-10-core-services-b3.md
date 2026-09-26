# Phase 10 — Headless UI · `core/services` (Dialog → ng-primitives) · batch B3

Date: 2026-09-26 · Branch: `refactor/structure-10` · Sixth batch. **Only `UtilsDialog` is left on the hand-rolled
service**, and B4 migrates it and deletes the service. The row stays 🟡.

## 1. Summary

The 12 admin dialogs moved onto the shell, along with their **23 call sites in 14 page files**. That includes the
route-dead v1 partner-platform pages, so no caller of the old API remains once B4 lands.

| Dialog                               | In the shell                        | Label (reproduces the old per-site text exactly) |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------ |
| `AllocateSeatsDialog`                | `maxWidth="520px"`                  | "Add seats to {firm}"                            |
| `AssignSeatDialog`                   | `maxWidth="480px"`                  | "Assign a pool seat to a firm"                   |
| `CreatePartnerAdminDialog` (no data) | `maxWidth="560px"`                  | "Create partner admin"                           |
| `CreatePartnerCodeDialog`            | `maxWidth="520px"`                  | "Create partner code"                            |
| `EditAdminRolesDialog`               | `maxWidth="480px"`                  | "Edit roles for {email}"                         |
| `FirmFormDialog` (data optional)     | `maxWidth="560px"`                  | "Edit {firm}" or "Create firm"                   |
| `NetworkFirmsDialog` (v1)            | `maxWidth="600px"`                  | "Firms in {network}" or "Standalone companies"   |
| `NetworkFormDialog`                  | `maxWidth="520px"`                  | "Edit network" or "Create network"               |
| `PartnerReportPreviewDialog`         | `width="1040px"`, `maxWidth="95vw"` | "Partner learning report"                        |
| `RecordPaymentDialog`                | `maxWidth="480px"`                  | "Record offline payment"                         |
| `ReportItemsDialog`                  | `maxWidth="720px"`                  | "Report details for {name}"                      |
| `UserCourseDetailDialog`             | `maxWidth="560px"`                  | "{category} for {name}"                          |

- **Call sites:** `environmentInjector` became the dialog's `injector`, so the route-scoped facades still resolve. The
  call sites were rewritten by a script that brace-matches each `open()` config and renames **only that ref's**
  `afterClosed$`. `onboarding-v2`, `user-onboarding` and `seo-dashboard` still open `UtilsDialog` on the old service,
  and those refs are correctly untouched.
- **Own attributes removed:** each dialog's root `role="dialog"`, `aria-modal` and `aria-labelledby` were removed; the
  shell owns them now.
- **Stale comments fixed:** five dialogs' "property-injected by the Dialog service" doc comments were rewritten, and two
  per-field "Set by the Dialog service" comments were removed. Five pages' "Dialogs are built by the root Dialog
  service" comments now describe the `injector` hand-off.
- **Theming is unchanged.** Admin dialogs still render outside `.admin-theme`, because both the old service and
  ng-primitives append to `<body>`. The report-preview comment that relies on this is kept, and is still accurate.
- **`record-payment-dialog.spec`** used `new RecordPaymentDialog()` plus field assignment. It now constructs inside
  `TestBed.runInInjectionContext` with a stub `NgpDialogRef`. Every assertion is unchanged, and 7 of 7 pass.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**, with 169 files / 599 passed +
1 skipped. The follow-up fixes were comment-only, and quick gates plus Prettier were re-run clean after them.

`reviewer`: **PASS.** Its two non-blocking stale-comment nits are fixed, and so is its optional one about the page
comments. It verified:

- every data-derived label reproduces the old text exactly;
- the per-ref `afterClosed` renames are correct in the three mixed files;
- no `this.dialog.open(` remains for these 12 dialogs;
- the `record-payment` spec rewrite weakens no assertion.

**Browser:** not possible for this batch. Every admin page is behind Supabase admin sign-in, and signing in is yours
to do. The admin dialogs use the same shell that was verified in the browser in B0, B1a, B1b and B2a, and the admin
specs cover their logic.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Size:** the diff is +1475 / −1499 across 39 files, but **+278 / −302 ignoring whitespace**. That is the largest
  batch. It is 12 dialogs with a uniform, mechanical change.
- **Remaining for B4:**
  - `UtilsDialog`: 18 calls across `features/`, `admin/` (`onboarding-v2`, `seo-dashboard`) and `shared/services/utils.ts`.
  - Then delete `core/services/dialog/dialog.ts` and its spec, and `src/styles/dialog.css` (it is in `angular.json`).
  - Remove `video-poster`'s dual `afterOpened` listener.
  - Update `MockDialogRef` users in the stories, the `dialog.mock.ts` helper, and `feature-dialog-tokens.ts`. The
    tokens stay, but their doc comment mentions the service.

## 4. Visual QA list (needs an admin sign-in)

1. **Partner platform v2:**
   - Firms: create and edit firm; add seats.
   - Network detail: edit network, allocate seats, assign a pool seat, create and edit a firm.
   - Networks: create network.
   - Codes: create a partner code.
   - Partner admins: create.
   - Reports: the preview (1040 px) and the per-user details.
   - Onboarding: record an offline payment.
2. **Admin users:** edit roles.
3. **User report:** the course-detail drill-down.
4. **User onboarding:** record payment and apply partner code.

For each: check that the size is unchanged, that Escape and backdrop close it, that focus **returns to the button that
opened it** (new behaviour), and that the result still updates the page.

## 5. Commit message

```
refactor(admin): move the admin dialogs onto the ng-primitives shell

- AllocateSeats, AssignSeat, CreatePartnerAdmin, CreatePartnerCode,
  EditAdminRoles, FirmForm, NetworkFirms, NetworkForm, PartnerReportPreview,
  RecordPayment, ReportItems and UserCourseDetail render in
  <app-dialog-shell>; per-site labels are derived from the same data
- 23 call sites open via NgpDialogManager; environmentInjector becomes the
  dialog's injector so route-scoped facades still resolve
- stale "property-injected by the Dialog service" comments rewritten;
  record-payment spec builds the dialog in an injection context

Batch B3 of the Dialog service migration (Phase 10, core/services).
```
