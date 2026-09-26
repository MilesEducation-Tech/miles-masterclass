# Phase 10 — Headless UI · `admin/*` (non-partner)

Date: 2026-09-26 · Branch: `refactor/structure-10` · Runs after Phase 9 admin (`e3542a3`). Scope set by you: **all
live hand-rolled widgets**, not only the tracker's sidebar popover.

## 1. Summary

**Five widgets moved to ng-primitives. Two real accessibility bugs fixed along the way.** Source is +345 / −182 and
specs are +356, with 11 new tests.

| Step | Component                                   | Before                                                                                                                                                            | After                                                                                                                                                                                                                                                                                                                                  |
| ---- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1   | `layout/admin-sidebar` account menu         | `@if` popover, a full-screen invisible close button, `role="menu"` by hand, a `document:keydown.escape` host listener                                             | **`ngpMenu`/`ngpMenuItem`**. Arrow keys, Escape, outside click and focus return come from the primitive. It is **attached inside the account card** (`ngpMenuTriggerContainer`), not `<body>`, because its colours are `.admin-theme` variables. The trigger and items are native buttons with app-button's resolved ghost/sm classes. |
| S2   | `layout/admin-layout` mobile drawer         | `role="dialog" aria-modal="true"` with **no focus trap and no Escape**                                                                                            | **`ngpFocusTrap`**. Escape closes it, and every close returns focus to the opener (the `layout/header` parity fix).                                                                                                                                                                                                                    |
| S3   | `seo/pages/seo-editor` section tabs         | `role="tablist"`/`tab`/`tabpanel` wired by hand, with no arrow keys                                                                                               | **`ngpTabset`/`ngpTabList`/`ngpTabButton`/`ngpTabPanel`**. The panels still render by `@if`, and the tabs keep their `[class]` ternaries, so the visuals are unchanged.                                                                                                                                                                |
| S3   | `seo-editor` field tips (×6)                | Hover-only spans: `role="tooltip"` on the _trigger_, not focusable, and the tip text sat inside each `<label>`, so it **leaked into the input's accessible name** | **`ngpTooltipTrigger` + `ngpTooltip`**. They are focusable (`tabindex="0"`, labelled "More info"), show on hover **and focus**, and are linked with `aria-describedby`.                                                                                                                                                                |
| S4   | `seo/pages/seo-dashboard` create-page modal | Inline `@if`, `role="dialog"`, with no trap, no Escape and no focus return                                                                                        | An `ng-template` opened by **`NgpDialogManager`** (with the page's `ViewContainerRef`) inside **`<app-dialog-shell>`**. It is not dismissible while a create is in flight. **The panel carries `admin-theme`**, because the manager attaches to `<body>`.                                                                              |
| S5   | `leads-table`, `audit-log` row disclosures  | `<app-button [attr.aria-expanded]>`: **`aria-expanded` landed on the component host, not the focusable button**, and there was no `aria-controls`                 | **One `<tbody ngpCollapsible>` per row pair** (several tbodies are valid HTML), a native `<button ngpCollapsibleTrigger>`, and the details row as `ngpCollapsibleContent` (still `@if`-rendered). Row dividers moved from `divide-y` to per-tbody borders.                                                                             |
| S6   | Checkboxes                                  | —                                                                                                                                                                 | **No change.** Every hit was `<app-aria-input type="checkbox">`, which Phase 10 `shared/ui` already put on `ngpCheckbox`.                                                                                                                                                                                                              |

**Specs:** 11 new tests.

- Three new spec files, for the sidebar, the layout and `leads-table`.
- New template-level tests in the `seo-editor` and `seo-dashboard` specs.

They cover the menu staying inside the component, trap containment, focus restore on Escape and on the toggle, the
tab `aria-controls` ↔ panel link, a tooltip on keyboard focus with `aria-describedby`, the create dialog keeping the
theme and closing on Escape, and the disclosure's `aria-controls` panel.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                                |
| --------------- | --------------------------------------------------------------------- |
| lint            | pass                                                                  |
| unit tests      | pass: 178 files, **652 passed** + 1 skipped (was 641)                 |
| build (local)   | pass                                                                  |
| build (prod)    | pass                                                                  |
| storybook build | pass                                                                  |
| format check    | pass                                                                  |
| bundle report   | pass: initial 88.8 KB gz (+0.1 vs the previous row, −0.4 vs baseline) |
| ssr smoke       | pass: 4 of 4 routes, `/admin/login` 200                               |

- **`reviewer`: PASS.** Its one nit, a leftover unreferenced `id="modal-title"` on the create dialog heading, is
  **removed**. That was a template-only attribute; the dashboard spec (6/6) and the format check were re-run after
  it.
- **Initial +0.1 KB gz:** everything touched is admin-only and lazy. It is inside the noise of the preload-list
  artefact noted in earlier Phase 10 reports; not traced.
- **Browser: not run.** Admin needs your Supabase sign-in, and the dev-server config uses `npx`.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.** This row closes **the last Phase 10 cell**, so Phase 10 is complete across the tracker.
- **Intentional behaviour differences (all a11y gains):**
  - the SEO field tips show on keyboard focus;
  - the create-page dialog and the mobile drawer close on Escape and trap focus;
  - the create dialog's backdrop now dims with the shell's `bg-black/60` instead of `bg-slate-900/80` + blur,
    matching every other dialog.
- **The `audit-log` disclosure has no dedicated spec.** The page queries Supabase itself. Its markup change is
  identical to `leads-table`'s, which is tested, and it is first on the visual-QA list.
- **Skipped, logged:** the tablists in the unrouted `users` and `seat-tracker` pages. They are dead code, so moving
  them is pointless until someone decides to route or delete those pages.
- No `@Injectable`, no new CSS, and no heavy-library service.

## 4. Visual QA list (admin sign-in, 375 / 768 / 1440 px)

1. **Audit log:** expand and collapse a row; the details row and the dividers look as before.
2. **Leads:** the same, plus "Save notes" inside an open row.
3. **Sidebar account menu:**
   - it opens _above_ the card at the card's width, with the admin colours;
   - arrow keys move between items;
   - Escape and an outside click close it;
   - Log out works;
   - try it with the sidebar collapsed too.
4. **Mobile (375 px) drawer:**
   - the hamburger opens it and focus moves in;
   - Tab stays inside;
   - Escape and the backdrop close it, and focus returns to the hamburger.
5. **SEO editor:**
   - the four tabs switch panels, and Left/Right move between tabs;
   - each ⓘ tip shows on hover and on Tab focus.
6. **SEO dashboard → New Page:**
   - the dialog is centred at 28 rem, and the inputs keep the admin colours;
   - Escape closes it, but not while "Creating…";
   - focus returns to "New Page".

## 5. Commit messages (three commits)

**1.** `admin-sidebar.*`, `admin-layout.*` (+ their specs)

```
refactor(admin): move the admin sidebar menu and mobile drawer onto ng-primitives

- account menu -> ngpMenu/ngpMenuItem, attached inside the card so the
  .admin-theme colours still apply; drops the hand-rolled overlay and the
  document Escape listener
- mobile drawer -> ngpFocusTrap, Escape closes, focus returns to the opener
- +5 spec tests

Phase 10 (headless UI), admin/*.
```

**2.** `seo-editor.*`, `seo-dashboard.*` (+ their specs)

```
refactor(seo): move the SEO editor tabs, field tips and create dialog onto ng-primitives

- section tabs -> ngpTabset/ngpTabList/ngpTabButton/ngpTabPanel
- 6 hover-only field tips -> focusable ngpTooltip, linked by
  aria-describedby (their text no longer pollutes the inputs' names)
- create-page modal -> NgpDialogManager + app-dialog-shell, panel keeps
  admin-theme
- +4 spec tests

Phase 10 (headless UI), admin/*.
```

**3.** `leads-table.*` (+ new spec), `audit-log.html`/`.ts`, plus STATE.md and this report

```
refactor(admin): move the leads and audit-log row disclosures onto ngpCollapsible

- one <tbody ngpCollapsible> per row pair with a native trigger button;
  aria-expanded/aria-controls now sit on the focusable element, not on
  app-button's host
- +2 spec tests

Phase 10 (headless UI), admin/*.
```
