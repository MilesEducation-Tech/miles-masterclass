# Phase 12 — `inline-styles` (the sweep)

## 1. Summary

**This row closes a gap that every earlier Phase 12 row had.** Their inventories searched for `NgClass`/`NgStyle`,
`.css` files and `styles:`, but never for plain `style="…"` attributes.

- **Scope:** your decision (a) of 2026-09-26: all routed areas, skipping the unrouted v1
  `admin/partner-platform/`.
- **Result:** of 194 static `style` attributes outside HTML comments, **177 became utilities in 50 files. 17 stay,
  each with a reason.**

**S1, scripted (172).** An attribute was converted only if every declaration in it matched an exact whitelist, so each
utility compiles to the identical value.

| Inline declaration                                                              | Utility                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `color: var(--mm-fg-3)` / `--mm-fg-2`                                           | `text-fg-3` / `text-fg-2`                                             |
| `color: var(--mm-{danger,success,info,warn}-fg)`                                | `text-{danger,success,info,warn}-foreground`                          |
| `color: var(--mm-info)` / `var(--primary)` / `var(--muted-foreground)` / `#fff` | `text-info` / `text-primary` / `text-muted-foreground` / `text-white` |
| `background: var(--mm-surface-2 \| -3)`                                         | `bg-surface-2` / `bg-surface-3`                                       |
| `background: var(--mm-{danger,info,warn,success}-bg)`                           | `bg-{…}-bg`                                                           |
| `background: var(--card)` / `var(--primary)` / `var(--sidebar-border)`          | `bg-card` / `bg-primary` / `bg-sidebar-border`                        |
| `border-color: var(--mm-info)`                                                  | `border-info`                                                         |
| `width: 100%` / `var(--ngp-select-width)` / `var(--ngp-combobox-width)`         | `w-full` / `w-(--ngp-select-width)` / `w-(--ngp-combobox-width)`      |
| `font-family: var(--font-numeric, var(--font-sans))`                            | `font-numeric`                                                        |

**Parity checks built into the sweep:**

- **Classes the inline style was overriding.** Where one sat on the same element, tailwind-merge would have dropped it,
  since the inline style always won. None existed. I confirmed tailwind-merge does recognise the custom token names,
  so "none" is a real result.
- **Other cascade risks.** None of the converted elements has:
  - a global unlayered class from `styles.css` (`title`, `description`, `input`…)
  - a class from a kept component stylesheet
  - a `bg-*` gradient that a `background` shorthand used to reset
- **Mixed static and bound styles.** Where both sit on one element (`stat-card`, the sidebar badge), only the static
  one converted. The `[style.background]` binding stays.
- **The PDF document.** The one change in `partner-report-preview-dialog` is the error banner, which sits outside the
  `.report` PDF node.

**S2 and fix round 1, by hand (10):**

- `seat-tracker`: `var(--card, #0e2742)` → `bg-card`.
- `how-to-claim-credly-badge` iframe: `h-[70vh]`.
- `cpe-compliance-dialog` SVG text: `text-[18px] font-bold`.
- `admin-topbar`: `bg-[rgba(14,39,66,0.6)]`, which compiles to `#0e274299`, the identical colour.
- `admin-sidebar` avatar: `bg-linear-135/srgb from-[#1f60bd] to-primary`. Under `.admin-theme`, `--primary` is
  `#2a85ff`.
- `categories-list` off-screen measure box: `fixed top-0 left-[-99999px]`.
- `page-not-found`: `[-webkit-backdrop-filter:url(#glass)]`. The prefix survives in the build.
- **`milesverse/report`:**
  - The no-data icon became `bg-destructive/10 text-destructive`. `#ef4444` is `--destructive`, and `0x1a` rounds
    exactly to 10%.
  - The dial box became `size-44` (176px).
  - The dial transition became `transition-[stroke-dashoffset] duration-1000 ease-[ease-out]`. The keyword `ease-out`
    is needed because Tailwind's own `ease-out` is a different curve.
  - The Strengths and Growth headings and bullets became `text-success` (`#27ae60`) and `text-warn` (`#f6bc53`). Both
    are exact `:root` values, and the page is not under `.admin-theme`.

**Stays inline (17), with reasons:**

| Where                                               | Why                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `badge-spot-animation` ×3, `ai-lab-dialog` ×6       | `animation-delay`. The component CSS's unlayered `animation` shorthand would reset a layered delay utility.         |
| `milesverse/report` ×2 (strength and growth panels) | They carry `.mv-card`, whose unlayered rule in `report.css` sets `border`/`background`. A utility would lose to it. |
| `milesverse/briefing` ×1                            | A two-property transition with per-property durations and easing. No single utility set expresses it.               |
| `micro-learning-hero` ×3                            | Multi-layer radial/linear gradients. They are one-offs and far more readable as CSS.                                |
| `micro-learning-hero-phone-mockup` ×1               | A one-off `text-shadow`.                                                                                            |
| `calendly-dialog` ×1                                | The Calendly embed container. It is kept out of caution, because the third-party script sizes itself from it.       |

**Process fix:** the sweep script had also rewritten markup inside an HTML comment, in `admin-topbar`'s commented-out
block. Every comment block in the changed files is restored byte-for-byte to `HEAD`.

## 2. Verification

These are the `verifier` subagent's results. Fix round 1 was reviewer-driven: the first review failed my leftover
triage, not the conversions.

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
- `reviewer`: **PASS** after fix round 1. It checked the whitelist token by token against `@theme inline`.
- **Prod CSS:** the verifier quoted every new rule, and each sets the same value the inline style did.
- **Bundle:** the initial bundle is **89.5 KB gz, +0.3% vs baseline**, up 0.2 KB. The gate passes. This is the utility
  CSS cost you accepted with decision (a). There are 324 lazy chunks.

## 3. Decisions needed / skipped / suspicious

- **None new.** This row closes the inline-style decision.
- **Phase 12 is complete.** Every tracker row is ✅.
- **Still open from earlier Phase 12 rows:** the spinner colours, and the app-wide dialog gradient token.
- **Logged, not fixed:** the comment at `styles.css` ~250 says the admin palette utilities "resolve to nothing on the
  public site". That is wrong for `warn` and `success`, because `--mm-warn` and `--mm-success` are also defined in
  `:root`. `milesverse/report` now relies on that.
- **Out of scope:** the unrouted v1 `admin/partner-platform/` keeps its 30 static and 8 bound style attributes.

## 4. Visual QA list

Check at 375 / 768 / 1440 px. The main surface is the **admin area**, which had most of the 177 conversions:

- **Admin shell:**
  - The sidebar: section labels, dividers, the badge colour and the avatar gradient.
  - The topbar: its translucent background, the breadcrumb colour and the numeric-font title.
- **Admin lists, tables and dialogs:** muted text (`fg-3`), `surface-2` chips, danger/info/warn/success banners and
  pills. This covers users, leads, user-report, seat tracker, audit log, roles, onboarding, dashboard, and
  partner-platform-v2 pages and dialogs.
- **`shared/ui` select, multiselect and autocomplete:** the popover width should still match the trigger.
- **Milesverse report:** the no-data icon, the dial size and animation, and the Strengths/Growth colours.
- **Page-not-found:** the glass button in Safari.
- **CPE compliance dialog:** the ring's centre number.
- **How-to-claim badge page:** the PDF iframe height.

## 5. Commit message

```
style(shared): move static inline styles to Tailwind utilities

- convert 177 of 194 static style="" attributes across the routed app
  (admin, partner-platform-v2, shared, features) to their exact
  @theme/utility equivalents; skip the unrouted v1 partner platform
- milesverse report colours → success/warn/destructive tokens
- 17 stay inline with a reason: animation delays and mv-card panels that
  unlayered component CSS would override, a two-property transition,
  multi-layer hero gradients, a text-shadow and the Calendly container

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
