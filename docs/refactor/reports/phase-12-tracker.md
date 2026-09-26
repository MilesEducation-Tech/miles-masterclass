# Phase 12 — `features/tracker` (caira + cpe)

## 1. Summary

**All 3 stylesheets were empty, and all 3 are deleted.** Their `styleUrl`s went too: `tracker-table`,
`cpe-compliance-dialog` and `cpe-tracker`. The feature is now stylesheet-free, and its templates were already
Tailwind-only.

**No change needed:** the feature has no inline `styles`, no `NgClass`/`NgStyle` and no `@apply`.

**Colours left as they are, on purpose.** None matches a token exactly. The nearest is `#00B64D` against
`--chart-2`/`--mm-success` (`#27ae60`), a visibly different green.

- `cpe-tracker.constants.ts`: `FIELD_COLORS` and `DELIVERY_COLORS` are the chart and legend colours for fields of
  study and delivery methods. They are runtime data bound into charts and inline styles, not template classes.
- `cpe-compliance-dialog`:
  - `bg-[#0B1838]` for the dialog surface.
  - The SVG `stroke` attributes `#2A3355` (the ring track) and `#00B64D` (the ring progress).

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

- `reviewer`: **PASS**.
- **Bundle:** the initial bundle is 88.4 KB gz (−0.9% vs baseline), unchanged. There are 324 lazy chunks. Empty
  stylesheets emit nothing, so no size change was expected.

## 3. Decisions needed / skipped / suspicious

- **None new.** The spinner-colour decision from `shared/ui` is still open.
- **Kept CSS:** none.
- **Logged, not fixed (§2.7):** `cpe-compliance-dialog.ts` `FIELD_CARD_COLORS` duplicates three entries of
  `FIELD_COLORS` in `cpe/constants/cpe-tracker.constants.ts`, and repeats its fallback hex `#94A3B8`
  (`DELIVERY_COLORS.default`). If the brand colours change, these can drift apart. The fix is to import
  `FIELD_COLORS`, which is a logic change outside Phase 12.

## 4. Visual QA list

Nothing is expected to change visually, because only empty stylesheets were removed. For a spot check:

- **CPE tracker** page, including the tracker table.
- **CPE compliance dialog**: the ring and the field cards.

## 5. Commit message

```
style(cpe-tracker): drop the empty tracker stylesheets

- delete the 3 empty stylesheets (tracker-table, cpe-compliance-dialog,
  cpe-tracker) and their styleUrl

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
