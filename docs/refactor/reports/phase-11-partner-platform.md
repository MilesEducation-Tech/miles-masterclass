# Phase 11 — `admin/partner-platform(-v2)`

## 1. Summary

This session changed 8 files. It added no files, moved none, and changed no specs. The scope is the same as your
Phase 9 decision for this row: the routed v2 pages and the shared partner layer. The unrouted v1 pages are skipped.

- **18 programmatic dialog opens across 8 v2 pages now load their component with `await import()`.**
  - The import sits right before `dialogs.open`, and each static import became `import type`.
  - Every sync guard still runs first. For example, `network-detail-v2.openEdit` still returns early when there is
    no network.
  - Internal fire-and-forget callers use `void`: `networks-v2.openCreate`/`openEdit` → `openDialog`, and
    `onboarding-v2` → `showPaymentResult`.

  | Page                | Dialogs                                             |
  | ------------------- | --------------------------------------------------- |
  | `networks-v2`       | NetworkForm                                         |
  | `network-detail-v2` | NetworkForm, AllocateSeats, AssignSeat, FirmForm ×2 |
  | `firms-v2`          | AllocateSeats, FirmForm ×2                          |
  | `reports-v2`        | PartnerReportPreview, ReportItems                   |
  | `partner-admins-v2` | CreatePartnerAdmin                                  |
  | `onboarding-v2`     | UtilsDialog ×2, RecordPayment, ApplyPartnerCode     |
  | `users-v2`          | BlockStatus                                         |
  | `codes-v2`          | CreatePartnerCode                                   |

- **Audited, no change needed:**
  - **No `injectAsync` candidates.** `PartnerReportFacade` is `@Service({ autoProvided: false })` and owns
    on-load `httpResource`s, so it is ineligible under §4.5. `jszip` is already dynamic in `blob-download`, and
    `HtmlToPdf` is already `injectAsync` in `partner-report-preview-dialog`.
  - **No heavy imports and no `@defer` candidates.** The `admin/core` partner services open no dialogs.
- **Skipped:** the v1 pages, plus the unrouted `admin/users` and `admin/user-onboarding` list pages. They still
  import some of the same dialogs statically. Nothing routes to them, so they are not bundled and do not stop the
  split.

## 2. Verification

`verifier` subagent, full `verify.mjs`, first run:

| Gate            | Result                                    |
| --------------- | ----------------------------------------- |
| lint            | pass                                      |
| unit tests      | pass (190 files / 698 passed + 1 skipped) |
| build (local)   | pass                                      |
| build (prod)    | pass                                      |
| storybook build | pass                                      |
| format check    | pass                                      |
| bundle report   | pass                                      |
| ssr smoke       | pass: 4 of 4 routes                       |

- The baseline dir was unchanged after the run.
- `reviewer`: **PASS**, no violations.
- Partner specs: 7 files / 28 tests.

**Bundle:**

- Initial is unchanged at 88.0 KB gz (−1.3% vs baseline).
- Lazy chunks went from **314 to 324 (+10)**. That matches the dialogs that left the v2 page chunks for their own.

## 3. Decisions needed / skipped / suspicious

- **None needed.** The open Phase 6 decision (v1 removal / v2 rename) is unaffected.
- **Logged, not fixed (§2.7):** `record-payment-dialog` lives in `admin/user-onboarding/dialogs/`. Its live users
  are `partner-platform-v2/onboarding-v2` and `user-onboarding/user-form`, two admin sub-areas. §3's placement rule
  would put it at their common parent, in `admin/`. This predates this session; it was a static import before. It
  is a Part A-shaped move, best done with the v1 cutover.
- No `@Injectable` was kept, no CSS was touched, and no heavy-library service was left eager.
- **Not browser-checked.** The v2 pages need a real admin sign-in, so the gates and the review are the evidence.

## 4. Visual QA list

Signed in as a partner super admin at `/admin/partner-v2/...`. Each dialog should open as before; the first open may
pause for a moment.

- **Networks:** "New network" and "Edit".
- **Network detail:** edit, allocate seats, assign seat, add firm, edit firm.
- **Firms:** allocate, edit, create. Creating a firm without an admin still redirects to admin provisioning.
- **Codes:** "New partner code".
- **Partner admins:** "New partner admin".
- **Reports:** "Preview" (the PDF report still downloads) and a row's items dialog.
- **Onboarding:** view a user, record payment (the result dialog follows), apply partner code.
- **Users:** block and unblock.

## 5. Commit message

```
perf(admin): lazy-load the partner platform v2 dialogs

18 dialog opens across the networks, network detail, firms, codes, partner
admins, reports, onboarding and users pages load their component with
import() when opened; only the data types stay static. Each dialog now
lands in its own lazy chunk (+10 chunks); initial bundle unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
