# Phase 12 — `shared/ui` (also Phase 12's first session)

## 1. Summary

**Tokens (the first-session item).** `@theme inline` already held every public token as `var()` indirection over
`:root`, and it stays that way. `.admin-theme` re-points the same variables at runtime, which plain `@theme` cannot do.
What was missing is now registered in `src/styles/styles.css`:

- **The admin palette:**
  - `fg-2`, `fg-3`, `surface-2`, `surface-3`
  - `warn`, `info`, `danger`, each with `-foreground` and `-bg`

  These are defined only under `.admin-theme`, so on the public site they resolve to nothing. That matches the
  `var(--mm-*)` inline styles (380 uses) that the admin rows will replace with them.

- **`--font-numeric`.** `webinar-countdown` already used `font-numeric`, which generated no CSS until now. It now emits
  `var(--font-numeric)`, which is undefined outside admin. I browser-checked that it still inherits Inter, so nothing
  changes.
- **New `surface-state` token (`#151f2b`),** the empty/error-state card colour that was hardcoded 4 times.
- **`--animate-dropdown-in` and `--animate-mobile-menu-in`,** for the header's `animate-[dropdownFadeIn_…]` arbitrary
  classes. The keyframes stay in `animation.css`.

**`shared/ui` (12 components touched, 11 CSS files deleted).**

- **Empty stylesheets.** 10 empty `.css` files are deleted along with their `styleUrl`: the 4 `aria/*`,
  `checkbox-list`, `forms`, `otp`, `select-menu`, `tab-strip` and `toast`. Three empty inline `styles:` `` blocks
  are removed from `error-state`, `spinner` and `page-loading`.
- **`button.css` is deleted and replaced by `host: { class: 'inline-block!' }`.**
  - The `!` is deliberate. The old unlayered `:host` rule outranked every layered utility, so the `flex`/`block`
    classes that 24 call sites put on `<app-button>` never took effect.
  - A plain `inline-block` would tie with those classes in the utilities layer and change how those buttons render.
  - Browser-checked: every host that isn't `inline-block` is a blockified flex child, the same as before the change.
- **`progress`.** Its 100-line `@apply` block became template utilities plus a `cn()` class map:
  - The host is `block w-full`.
  - The track is `bg-white/20` when indeterminate and `bg-muted` when determinate.
  - The indeterminate bar is 40% wide (`w-2/5`), and the stripes gradient and size are unchanged.
  - Only the two keyframes and their `animation` rules stay in `styles`. Angular scopes keyframe names per component,
    so they cannot move to `@theme`.
- **`error-state`:** `bg-[#151F2B]` becomes `bg-surface-state`. Browser-checked that it resolves to `rgb(21, 31, 43)`.

**Kept:** `dialog-shell.css`. It holds custom `@keyframes` and the `[data-exit]` animation rules that ng-primitives
waits on, which §4.6 allows.

## 2. Verification

The `verifier` subagent ran the full `verify.mjs`; it passed on the first run.

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

The baseline dir was unchanged. The `reviewer` returned **PASS**. The `shared/ui` specs pass (8 files / 39 tests).

**Bundle:** initial went from 88.0 to **87.3 KB gz**, now −2.1% vs baseline, the best yet. Button is in the initial
bundle, so dropping its component stylesheet counts, and `app.html` renders `app-progress`. Lazy chunks are unchanged
(324).

## 3. Decisions needed / skipped / suspicious

- **Decision (added to STATE.md): fix the spinner colours?** `spinner.ts` builds `text-${trackColor()}` and
  `fill-${color()}`, and Tailwind never sees interpolated class names.
  - Checked against the dev CSS: the defaults `fill-primary` and `text-neutral-tertiary`, and the `neutral-600` that
    10 call sites pass, **generate no CSS**. `neutral-tertiary` is not a token at all.
  - Only `fill-white` exists, and only by accident. So all 40 spinners render in the fallback colours.
  - The §4.6 fix is a literal class map, but it makes spinners start showing their intended colours, which is a visible
    change. **(a)** fix it as a class map in the Phase 12 cleanup, or **(b)** its own `fix(shared)` commit.
- **Bug (logged, §2.7):** `animate-fade-in` is used by `partner-level-panel`, `corporate`, `illinois` and `bkn`, but
  nothing defines it. `tailwindcss-animate` provides `animate-in fade-in`, not `animate-fade-in`. That panel's fade has
  never played. It is left for the partners row.
- **Correction to PLAN §8:** the "`--radius-4xl` is never defined" bug is not real. Tailwind's default theme emits
  `--radius-4xl: 2rem` (present in the built CSS), so the scrollbar radii work.
- **Left for their own rows:** the 3 payment `bg-[#151F2B]` usages (the token now exists), the admin `--mm-*` inline
  styles, and the header's arbitrary `animate-[…]` classes.
- **CSS files kept:** `dialog-shell.css` (keyframes + `[data-exit]`) and `progress`'s inline keyframe block. No
  `@Injectable`, no `NgClass`/`NgStyle`.

## 4. Visual QA list

Check at 375, 768 and 1440 px:

- **`app-progress`.** I could not browser-check it: UAT's course data does not load locally.
  - The course chapter list, masterclass and podcast hero progress, and the CAIRA level hero.
  - The admin certificate-download progress bar.
  - The global loading bar in `app.html`: indeterminate slide, track and fill colours, height.
- **Any `<app-button>`,** especially the icon buttons in the course heroes, `orders`, and the `hover`/`horizontal`
  cards. Their `flex` host classes must still be ignored.
- **`error-state`:** the card background stays the same deep navy.

## 5. Commit message

```
style(shared): move the admin palette into @theme and drop the shared/ui CSS

- styles.css: register the admin --mm-* palette (fg, surface, warn, info,
  danger), --font-numeric, a new surface-state token and the header dropdown
  animations in @theme inline; no call sites change yet
- shared/ui: delete 10 empty stylesheets and 3 empty inline styles
- button: :host display → host class inline-block! (keeps the old cascade:
  call-site display classes on <app-button> still don't apply)
- progress: @apply rules → template utilities and a cn() class map; only
  the keyframes stay in component styles
- error-state: #151F2B → bg-surface-state

Initial bundle 88.0 → 87.3 KB gzip.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
