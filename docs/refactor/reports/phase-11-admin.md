# Phase 11 — `admin/*` (non-partner)

## 1. Summary

3 files changed. There are no new files, no moves, and no spec changes.

- **3 live dialog opens → `import()` when opened.** Each static import is now `import type`:
  - `admin-users.editRoles` opens `EditAdminRolesDialog`.
  - `seo-dashboard.confirmDelete` opens `UtilsDialog`. It already returned a `Promise<boolean>`; now it is `async`.
  - `user-report.openCourseDetail` opens `UserCourseDetailDialog`. The "no course data" toast still returns before the
    import. `openAllCourses` calls it with `void`.
- **Audited, no change:**
  - **Heavy libraries:** none are imported in the non-partner admin tree, so there are no `@defer` candidates.
  - **`injectAsync`:** no candidates.
    - The CSV exports (`leads-facade`, `user-report-facade`) live in facades that own resources rendered on page
      load, which §4.5 excludes, and they use no heavy library.
    - `jszip` is already dynamic in `shared/utils/blob-download`.
    - `seo-csv` is a small util with no heavy imports. PLAN §4 calls it "not worth it".
  - **`seo-dashboard`'s create-page dialog** opens a `TemplateRef`, not a component, so there is nothing to split.
  - **Skipped as dead:** the unrouted `admin/users` and `admin/user-onboarding` list pages. Their routes are
    commented out in `admin.routes.ts`, and Phase 10 admin skipped them the same way. They each still import their
    dialogs statically, which is harmless because nothing loads them.

## 2. Verification

These results are from the `verifier` subagent's full run of `verify.mjs`, on its first attempt.

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

The baseline dir was unchanged after the run. The `reviewer` returned **PASS** with no violations.

**Bundle:**

- **Initial:** unchanged at 88.0 KB gz (−1.3% vs baseline). Admin is all lazy.
- **Lazy:** 312 → 314 chunks. The two admin-local dialogs now have their own chunks:
  - `EditAdminRolesDialog` → `chunk-RCOFZ4KS`
  - `UserCourseDetailDialog` → `chunk-22DRWLUB`
- **`UtilsDialog`:** it already had its own chunk.

## 3. Decisions needed / skipped / suspicious

- **None needed.**
- No `@Injectable` was kept, no CSS changed, and no heavy-library service is left eager.
- The dead `admin/users` and `admin/user-onboarding` list pages are still listed as dead code. They were not deleted.

## 4. Visual QA list

Each item below should open as before. The first open may take a short moment while the dialog loads.

- `/admin/admin-users`: "Edit roles" on a row opens the role picker, and saving it still applies.
- `/admin/seo`: "Delete" on a page opens the confirm dialog. Cancel keeps the row, and Delete removes it.
- `/admin/reports/user-report`: click a metric cell to open the course drill-down. An empty cell shows the
  "No course data" toast. "All courses" opens the merged list.

## 5. Commit message

```
perf(admin): lazy-load the admin roles, SEO delete and course-detail dialogs

admin-users, seo-dashboard and user-report load their dialog component with
import() when opened; only the data types stay static. The two admin-local
dialogs now land in their own lazy chunks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
