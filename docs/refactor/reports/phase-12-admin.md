# Phase 12 — `admin/*` (non-partner)

## 1. Summary

**Under decision (b), "keep admin CSS lazy" (your call, 2026-09-26, recorded in STATE.md), this row made only
bundle-neutral changes.** Of 16 stylesheets, 14 are deleted. 2 are trimmed to their real rules, which stay lazy.

**Deleted (14):**

- **2 orphans:** `seo-dashboard.css` and `seo-editor.css` were empty and never loaded by any `styleUrl`.
- **6 `:host` rules became a new host class:**
  - `block` for `edit-admin-roles-dialog`, `admin-login`, `forbidden`, `admin-dashboard` and `admin-layout`.
  - `contents` for `admin-topbar`.
- **6 redundant `:host { display: block }` rules were dropped:** `leads-table`, `leads`, `seat-tracker`, `user-report`,
  `users-table` and `users` already had `host: { class: 'block w-full' }`.

**Trimmed, with the real rules kept lazy:**

- **`admin-sidebar.css`:** `:host { display: contents }` became host class `contents`. `.active-nav-item` stays; it is
  applied through `routerLinkActive`.
- **`seat-tracker-table.css`:** the redundant `:host` was dropped. `.drill-btn` and `.send-input` stay.
- **Why these stay:** converting them would move their rules into the initial global sheet, which decision (b)
  excludes.

**Token:** `bg-[#04081a]` ×3 on the admin login, forgot-password and reset-password pages became a new `auth-backdrop`
token (`--mm-auth-backdrop` in `:root`, `--color-auth-backdrop` in `@theme inline`).

- It is in `:root` rather than `.admin-theme` on purpose. These auth pages don't render inside `.admin-theme`: only
  `forbidden` sets that class itself. Scoping the token there would make it resolve to nothing.

**No change needed:** there is no inline `styles`, `NgClass`/`NgStyle` or `@apply`.

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
| ssr smoke       | pass: 4 of 4, `/admin/login` 200          |

- **Environment:** local, macOS, Node 24.15.
- `reviewer`: **PASS**. It confirmed no duplicate `host` keys and no dropped host bindings.
- **Prod CSS:** it contains `.bg-auth-backdrop`.
- **Bundle:** the initial bundle is 89.3 KB gz, **+0.1% vs baseline**, up 0.1 KB. That is the one new custom property
  and its `@theme` alias. The gate still passes. There are 324 lazy chunks.

## 3. Decisions needed / skipped / suspicious

- **None new.**
  - The bundle decision is answered: (b).
  - The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** `admin-sidebar.css` (`.active-nav-item`) and `seat-tracker-table.css` (`.drill-btn`, `.send-input`).
  Both are kept lazy under decision (b).
- **Logged, not done:** the dialog gradient `from-[#0d1a2d] to-[#1a2332]` appears in about 18 dialogs.
  - They span `shared/dialogs`, `features/payment`, `features/offerings`, `admin/*` and partner-platform.
  - It is the clearest missing token in the app, but a cross-area change. It needs its own pass, not a row.
- **Not tokenised:** `#1e2736` ×2, because both uses are in one file (`seo-editor.html`).

## 4. Visual QA list

Check at 375 / 768 / 1440 px:

- **Admin login, forgot-password and reset-password:** the page background.
- **Admin shell:**
  - The sidebar, including the active nav item's accent.
  - The topbar layout, which is `display: contents`.
  - The dashboard.
- **Edit admin roles dialog, forbidden page, seat tracker table:** these should look unchanged.

## 5. Commit message

```
style(admin): drop redundant admin stylesheets and tokenise the auth backdrop

- delete 14 admin stylesheets: 2 orphans, 6 :host → host class, 6
  redundant :host rules on components already hosting block w-full
- admin-sidebar and seat-tracker-table keep only their real rules, lazy
  (bundle decision b)
- bg-[#04081a] on the admin auth pages → auth-backdrop token

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
