# Phase 10 — Headless UI · `features/offerings`

Date: 2026-09-26 · Branch: `refactor/structure-10` · Runs after Phase 9 offerings (`6a5ed84`).

## 1. Summary

Three hand-rolled widgets moved to ng-primitives. Each follows a precedent already set in Phase 10.

| Component                        | Before                                                                                     | After                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dialogs/select-cpe-mode`        | Two native radios inside card `<label>`s, checked styling by `[class.*]` ternaries         | **`ngpRadioGroup`** (vertical) of **`ngpRadioItem`** card buttons with an **`ngpRadioIndicator`** dot, the `ai-lab-agent-dialog` pattern. Headings, paragraphs and divs are not valid inside a `<button>`, so the card content became styled spans. Checked, unchecked and hover styling moved 1:1 to `data-[checked]:` / `not-data-[checked]:`. The unused `FormsModule` import is gone. |
| `webinar/components/webinar-faq` | Two-level accordion wired by hand: ids, `aria-expanded`/`-controls`, `role="region"`       | Two **`ngpAccordion`**s, both single and collapsible. The component still owns `openId`/`openChildId`, so "opening another category closes the open question" is unchanged. The primitive adds arrow-key movement between triggers and find-in-page reveal. The grid-rows animation is kept with `data-[closed]:grid!`, the `faq-item` override.                                          |
| `pages/final-assessment-report`  | Question rows were `div role="button" tabindex="0"` with hand-wired click, Enter and Space | **`ngpCollapsible`** with a native **`<button ngpCollapsibleTrigger>`** (the `ai-lab-agent-about` pattern) and `aria-controls` it never had. The inner divs are spans, and the multi-open `expandedItems` Set is unchanged.                                                                                                                                                               |

**Specs:** +7 tests.

- `select-cpe-mode` (+3), including the **`false` value**: picking Preview Mode must close with `cpe_mode_status: false`.
- `webinar-faq` (+3, new spec): the region labelling, single-open at each level, and the reset of the open question when the category changes.
- `final-assessment-report` (+1).

The tracker's footnote ⁴ named only the first two. The third was found by this row's own sweep of offerings.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15: **8/8 green**.

| Gate            | Result                                                |
| --------------- | ----------------------------------------------------- |
| lint            | pass                                                  |
| unit tests      | pass: 170 files, **623 passed** + 1 skipped (was 616) |
| build (local)   | pass                                                  |
| build (prod)    | pass                                                  |
| storybook build | pass                                                  |
| format check    | pass                                                  |
| bundle report   | pass: initial 88.7 KB gz, −0.5 KB vs baseline         |
| ssr smoke       | pass: 4 of 4 routes, matching the baseline            |

- ⚠️ **Initial bundle: +0.9 KB raw / +0.2 KB gz against the previous row** (453.1 vs 452.2 KB raw).
  - All three components live in lazy offerings routes.
  - The likely cause is the known `modulepreload`-list artefact from [phase-10-shared-ui](phase-10-shared-ui.md) §2: a new shared ng-primitives chunk joining the preload list.
  - **I did not prove it.** The bundle cache keeps only totals, and the previous build was overwritten. A Phase 11 per-page bundle diff would settle it.
- **`reviewer`: PASS, zero violations.** It compared the class mappings 1:1, confirmed `webinar-faq`'s explicit `OnPush` is untouched, and agreed with the non-changes in §3.
- **Browser: not run.** The only dev-server config (`.claude/launch.json`) starts `npx ng serve`. `CLAUDE.md` forbids `npx`, and `.claude/` is yours to edit. The visual checks are in §4. If you want me to check in the browser myself, add a `pnpm` entry there, e.g. `pnpm start`.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Accepted behaviour change (same as `ai-lab-agent-dialog`):** `ngpRadioItem` selects on focus. Tabbing into the CPE-mode picker with nothing chosen now selects **Preview Mode**. That only enables Continue; confirming still needs a click.
- **`select-cpe-mode` is named with `aria-label`, not `aria-labelledby`.** `ngpRadioGroup` manages `aria-labelledby` itself and drops a bound one. The spec caught that, and it is the same mechanism logged in Phase 10 `shared/ui`. The label text matches the heading: "Choose your {type} mode".
- **Not changed, on purpose:** the chapter-navigation pseudo-buttons, `div role="button"` in `course-chapter-list` (×2) and `video-chapter` (previous/next). They are navigation cards with block content (`<h2>`, images), not §4.3 disclosure or selection widgets, and Phase 10 `shared/dialogs` left the same kind alone. Making them real `<button>`s or `<a>`s would restructure their markup. That fits better with Phase 12 (Tailwind/markup), and is logged here for it.
- No `@Injectable`, no new CSS, and no heavy-library service.

## 4. Visual QA list

At 375 px, 768 px and 1440 px.

1. **CPE-mode picker**: on a masterclass, podcast and micro-learning course, press Start.
   - The two cards look as before, with a custom dot instead of the native radio.
   - The checked card is blue, and an unchecked card hovers grey.
   - Up and Down move between the cards.
   - Continue stays disabled until a mode is picked, then says "Continue with Preview/CPE Mode".
   - Picking Preview really starts Preview Mode.
2. **Webinar FAQ**, at the bottom of the webinar landing page:
   - opening a category closes the other one;
   - questions open one at a time;
   - switching category closes the open question;
   - open and close still animate;
   - Up and Down move between triggers;
   - browser find-in-page opens a collapsed answer.
3. **Final assessment report**:
   - each question row expands and collapses with the chevron;
   - several rows can be open at once;
   - Enter and Space toggle a row;
   - the Correct/Incorrect badges and the red left border are unchanged.

## 5. Commit message

```
refactor(offerings): move the CPE-mode picker, webinar FAQ and report rows onto ng-primitives

- select-cpe-mode: native radios -> ngpRadioGroup (vertical) with
  ngpRadioItem cards; checked styling via data-[checked]; select-on-focus
  behaviour change documented
- webinar-faq: hand-rolled two-level accordion -> two single, collapsible
  ngpAccordions; the component still owns the open ids
- final-assessment-report: div role=button disclosures -> ngpCollapsible
  with a native trigger
- +7 spec tests

Phase 10 (headless UI), features/offerings.
```
