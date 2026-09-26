# Phase 12 — `admin/partner-platform(-v2)`

## 1. Summary

**Decision (b), "keep admin CSS lazy", applies to this row.** v1 `partner-platform/` has no stylesheets. v2 has 2.

- **`report-users-table.css` deleted.** It held only `:host { display: block }`, which was redundant because the
  component already has `host: { class: 'block w-full' }`.
- **`partner-report-preview-dialog`:** `:host { display: block }` became host class `block`. The remaining ~300 lines
  **stay**, with a hard §4.6 reason:
  - They style the `.report` node that `HtmlToPdf` clones under `<body>` and html2canvas-pro rasterises.
  - html2canvas-pro can't parse `color-mix()`/`oklch`, which Tailwind v4's colour utilities emit. The file's own
    comments document this at lines 8 and 202.
  - Converting it would break the PDF export.

**Colours:** the only arbitrary colours are the app-wide dialog gradient `from-[#0d1a2d] to-[#1a2332]` ×8. That is
already logged in STATE.md Open questions as a cross-area token.

## 2. Verification

These are the `verifier` subagent's results from the full `verify.mjs` run, which passed first time.

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

- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**.
- **Bundle:** the initial bundle is 89.3 KB gz (+0.1% vs baseline), unchanged. There are 324 lazy chunks.

## 3. Decisions needed / skipped / suspicious

- **⏸ New Phase 12 decision: static `style="…"` attributes were missed by every Phase 12 row.**
  - **The gap:** my Phase 12 inventories searched for `NgClass`/`NgStyle`, `.css` files and `styles:`, but not plain
    `style` attributes. The reviewer found them here.
  - **Where they are:**

    | Area                           | Static | Bound |
    | ------------------------------ | ------ | ----- |
    | partner-platform-v2            | 96     | 21    |
    | partner-platform v1 (unrouted) | 30     | 8     |
    | `admin/*` (non-partner)        | 68     | —     |
    | features + shared + layout     | 30     | —     |

  - **What they set:** almost all set `var(--mm-*)` admin colours that already have `@theme` utilities, for example
    `style="color: var(--mm-fg-3)"` → `text-fg-3` and `style="background: var(--mm-danger-bg); color: var(--mm-danger-fg)"`
    → `bg-danger-bg text-danger-foreground`.
  - **What §4.6 says:** these belong in template utilities.
  - **The cost:** converting them adds utility rules to the initial global sheet. That is the same trade-off as
    decision (b), though the rules are small and shared.
  - **The options:**
    - **(a)** One follow-up "inline-style sweep" session across all areas, excluding the unrouted v1.
    - **(b)** Accept the attributes as is, since they are token-based rather than hardcoded.
    - **(c)** Convert only the non-admin 30.
  - Bound `[style.x]` bindings to computed values, such as the `stat-card` accent, are legitimate and stay either way.
- **Kept CSS:** `partner-report-preview-dialog.css` (the html2canvas-pro PDF document).
- **Pre-existing, logged:** `partner-platform/pages/reports/reports.html:36` has `var(--card, #0e2742)`, a hex fallback in
  the unrouted v1.
- The spinner-colour decision from `shared/ui` is still open.

## 4. Visual QA list

- **Partner report preview dialog:** the dialog frame should be unchanged. Also export a PDF once to confirm the
  document still renders.
- **Reports v2:** the users table, which should be unchanged.

## 5. Commit message

```
style(admin): drop the redundant partner-platform stylesheet

- delete report-users-table.css (its :host rule duplicated the host class)
- partner-report-preview-dialog: :host → host class; the PDF document
  styles stay (html2canvas-pro can't parse Tailwind v4's color-mix/oklch)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
