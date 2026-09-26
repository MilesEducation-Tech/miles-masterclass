# Phase 12 — `features/partners`

## 1. Summary

**All 14 stylesheets were empty, and all 14 are deleted.** Their `styleUrl`s went too. They were `for-partnership-tabs`,
`partnership-content` and the 12 partner pages. The feature is now stylesheet-free.

**Existing token:** the `illinois` and `bkn` hero glow changed from
`bg-[radial-gradient(circle,rgba(42,133,255,1)_30%,…)]` to `…var(--color-accent)…`.

- `--accent` is exactly `rgb(42, 133, 255)`.
- Only `.admin-theme` redefines it, and partner pages never render under it.
- The arbitrary value stays because the gradient is a `circle` with explicit stops. Tailwind's `bg-radial` defaults to
  an ellipse and oklab interpolation.

**New tokens (§4.6: add missing tokens rather than repeat arbitrary values):**

- The frosted "&lt;Partner&gt; Members Access" pill repeats on 7 partner heroes: `allinial-global`, `cpa-canada`,
  `ctcpa`, `dscpa`, `hawaii`, `mgi-north-america`, `mgi-world`.
- Its two colours now have tokens:
  - `--mm-pill-label: #f5f5f7` is exposed as `pill-label`.
  - `--mm-pill-cta: #0071e3` is exposed as `pill-cta`.
- Both follow the `--mm-surface-state` / `--color-surface-state` precedent, with a role comment in `styles.css`.
- **21 arbitrary colours were replaced:** `text-[#f5f5f7]` ×7, `bg-[#0071e3]` ×7 and `hover:bg-[#0071e3]/90` ×7.
- The CTA is an `<app-button variant="ghost">`. The ghost variant adds no `bg`, and tailwind-merge keeps `bg-pill-cta`
  exactly as it kept `bg-[#0071e3]` (tested).

**Colours left as they are, on purpose.** None matches a token exactly.

- **Per-partner brand colours**, each used on one page only:
  - `cpa-canada`: `#0680d1`, and `#0064A7` ×2.
  - `hawaii`: `#f9bb16` ×3.
  - These are partner data, not design-system values. Phase 13, if approved, would move them into
    `data/<partner>.ts`.
- **`caira-landing`** `text-[#A8A8A8]`: the same value `home` left, and 1 unit off nothing.
- **`for-firms-panel`**: its gradient stops (`#071625`, `#1A2027`, `#111111`, `#1D1D1D`) are used within that one
  component only.

**No change needed:** there is no inline `styles`, `NgClass`/`NgStyle` or `@apply`. The `headingClass` and
`subHeadingClass` hits are component inputs.

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
- **SSR:** `/us/accounting/partners/cpacanada` renders 200 with its title.
- **Prod CSS:** it contains `.text-pill-label`, `.bg-pill-cta`, `hover:bg-pill-cta/90` (with the `color-mix` form) and
  the radial glow with `var(--color-accent)`.
- **Bundle:** the initial bundle is 88.6 KB gz, −0.7% vs baseline, up 0.1 KB for the two tokens. There are 324 lazy
  chunks.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** none.
- **Minor:** `hover:bg-pill-cta/90` now relies on `color-mix()`, because the colour is a variable.
  - Browsers without `color-mix()` fall back to the full-opacity CTA colour on hover. Tailwind v4 already needs
    `color-mix()` for its colour system, so this is not a practical change.

## 4. Visual QA list

Check at 375 / 768 / 1440 px:

- **The "Members Access" pill** on the 7 partner heroes: its label colour, its Activate CTA fill and the CTA's hover.
  The heroes are `/partners/cpacanada`, `ctcpa`, `dscpa`, `hawaii`, `mgi-north-america`, `mgi-world` and
  `allinial-global`.
- **`illinois` and `bkn`:** the blue radial glow behind the hero.

## 5. Commit message

```
style(partners): drop the empty partner stylesheets and tokenise the hero pill

- delete the 14 empty partner stylesheets and their styleUrl
- illinois/bkn hero glow: rgba(42,133,255,1) → var(--color-accent)
- add pill-label / pill-cta tokens for the "Members Access" pill repeated
  on 7 partner heroes, replacing 21 arbitrary colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
