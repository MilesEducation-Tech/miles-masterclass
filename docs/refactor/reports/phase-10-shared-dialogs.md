# Phase 10 — Headless UI · `shared/dialogs`

Date: 2026-09-25 · Branch: `refactor/structure-10` · **Status: ⏸.** The code is done and reviewed. The unit-test
gate is red on a **pre-existing** flake that was reproduced at HEAD, and your decision is needed (§3).

## 1. Summary

I grepped every role, disclosure and native radio in `shared/dialogs`. All the hand-rolled widgets live in the AI-lab
agent dialog, which matches this cell's tracker footnote.

| Where                                         | Before                                                                                                                                       | After                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-lab-agent-about`, flow-check and MCQ rows | `div role="button" tabindex="0"` with hand-wired `(click)`, `(keydown.enter)`, `(keydown.space)` and `aria-expanded`, and no `aria-controls` | **`ngpCollapsible`**. The trigger is a **native `<button ngpCollapsibleTrigger>`**, because the primitive listens only for `click` and relies on native button activation. The divs inside it became flex `<span>`s so the button's content is valid. The panel is `ngpCollapsibleContent` with `data-[closed]:grid!`, the same override `faq-item` uses to keep the 0fr/1fr animation past the global `display: none`. The component keeps its own `expanded` Set signal. |
| `ai-lab-agent-about`, "wrong only" toggle     | `role="switch"` with `aria-checked` and class ternaries                                                                                      | **`ngpSwitch` + `ngpSwitchThumb`** with `data-[checked]` variants                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ai-lab-agent-dialog`, workflow picker        | native `<input type="radio">` inside card `<label>`s, in a `fieldset` with a screen-reader-only `legend`                                     | **`ngpRadioGroup`** (vertical, so Up/Down move between cards), with **`ngpRadioItem`** card buttons and an **`ngpRadioIndicator`** dot. The group's `aria-label` is the old legend text. The checked card is styled with `data-[checked]` instead of a `[class]` ternary.                                                                                                                                                                                                  |

**Public APIs are unchanged** for both components: the selectors, `card`/`report` inputs and dialog `data` contract are
the same, and no call site was touched.

⚠️ **One accepted behaviour change: `ngpRadioItem` selects on focus.** Tabbing into the picker with nothing chosen now
selects the first workflow; native radios don't do that. It only enables Submit, and scoring still needs that click.
This is flagged in a template comment and pinned by a spec.

⚠️ **All of this is unreachable in the running app today.** The submit panel and the graded report sit behind
`environment.AI_LABS.assessmentEnabled`, which is `false` in all three environments. So there was no browser check, and
the specs are the only verification. They switch the flag on for their own run and restore it afterwards.

**Tests:** 2 new spec files, 6 tests.

- `ai-lab-agent-about.spec.ts` (3): one native-button disclosure per row, each wired to its panel; rows expand and collapse independently; the switch filters to the wrong answers.
- `ai-lab-agent-dialog.spec.ts` (3): a vertical radiogroup with nothing checked and Submit disabled; click-to-pick submits the picked workflow; **focus selects but submits nothing**.

## 2. Verification

| Gate            | Result                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint            | ✅                                                                                                                                                                                                                                                                                                                                          |
| unit tests      | ❌ **in all 3 `verify.mjs` runs, from the pre-existing `features/partners` flake, not from this diff (proof below)**. Clean runs with this diff: 167 files · 591 passed + 1 skipped, before the 3rd dialog test was added; that test passes on its own.                                                                                     |
| build (local)   | ✅                                                                                                                                                                                                                                                                                                                                          |
| build (prod)    | ✅                                                                                                                                                                                                                                                                                                                                          |
| storybook build | ✅                                                                                                                                                                                                                                                                                                                                          |
| format check    | ✅                                                                                                                                                                                                                                                                                                                                          |
| bundle report   | ✅ · initial **88.8 KB gz**. That is −11.2 KB against the previous row, from a change that only touches lazy dialog code. It is **the same `modulepreload` reshuffle artefact** as [phase-10-shared-ui](phase-10-shared-ui.md) §2, this time swinging the other way. That confirms the report's "initial" number is not a reliable measure. |
| ssr smoke       | ✅                                                                                                                                                                                                                                                                                                                                          |

`reviewer`: **PASS on round 2.** Round 1 failed on one finding: the select-on-focus change was neither flagged nor
tested. That was fixed with a comment and a spec.

### Why the unit-test red is not this diff

- **The failure:** 3 unhandled errors, `TypeError: Cannot read properties of null (reading 'data')` at
  `features/partners/components/partnership-content.ts:245`. Vitest attributed them to `illinois.spec.ts`, then again to
  `illinois.spec.ts`, then to `corporate.spec.ts`. They are the same errors as in [phase-10-layout](phase-10-layout.md) §2.
- **The cause:** the partners page specs have no HTTP testing backend, so `partnership-content` calls the **live** API.
  A slow or empty reply lands in whichever spec is running at that moment.
- **Why `verify.mjs` goes red and a plain run doesn't:** `verify.mjs` runs tests with **`CI=1`**, which changes Vitest's
  scheduling. With `CI=1`:
  - **HEAD, without this diff:** run 1 clean, **run 2 red with 6 unhandled errors** (`bkn.spec.ts` + `corporate.spec.ts`).
    **The failure is pre-existing and reproduces without this change.**
  - **This diff:** 2 out of 2 runs clean. Without `CI=1` it was 3 out of 3 clean.
- **Unreachable from this diff:** nothing under `features/partners` references the AI-lab dialog, by grep.
- ⚠️ **GitHub Actions also sets `CI=true`**, so this flake can turn the required `verify` check red on any PR, not just
  in this harness.

I **stopped retrying at 3 red runs**, as the phase rules require, rather than rerunning until one came up green.

## 3. Decisions needed / skipped / suspicious

- **⏸ DECISION: how to close this row.**
  - **(a) Fix the flake first (recommended).** Run the already-raised task "Stop partners specs hitting the live API",
    which gives those specs `provideHttpClientTesting()`, commit it, and rerun `verify.mjs`. That should turn this row
    green on its own. It also protects CI, and every future Phase 10/11/12 row, which will keep hitting this.
  - **(b) Close ✅ on the evidence above**, the way Phase 9 closed on its stale SSR baseline. This red is explained and
    was reproduced at HEAD, which is the distinction the Phase 9 decision drew. But the gate stays red for everyone until
    (a) lands anyway.
- **Suspicious:** `partnership-content.ts:243-245` dereferences `res.data` with no null guard. That is a real product bug
  the flake exposes; it is logged in the partners task.
- **STATE.md formatting drift:** each commit's formatter pushes an old nested table in the Phase 0 decisions
  (~line 1530) further right. It is whitespace only, but it grows every run. That section is yours; worth reflowing once.
- No `@Injectable` was touched, no CSS file was kept or added, and no heavy-library service is involved.

## 4. Visual QA list

This can only be checked with `AI_LABS.assessmentEnabled = true`, for example in a local environment file.

1. **AI Labs, a chapter tile, the "Submit your workflow" picker.**
   - The cards look as before, and the custom dot replaces the native radio.
   - The checked card has the accent border and fill.
   - Tab into the list (it selects the first card, which is expected), then use Up/Down.
   - Submit is enabled only once a card is picked.
2. **The graded report after a submission.**
   - Flow-check and MCQ rows expand and collapse with the height animation, by click, Enter and Space.
   - The chevron rotates.
   - The "wrong only" switch slides and filters.

## 5. Commit message

```
refactor(shared): move ai-lab agent dialog widgets onto ng-primitives

- ai-lab-agent-about: div role=button disclosures -> ngpCollapsible on
  native button triggers; wrong-only role=switch -> ngpSwitch/ngpSwitchThumb
- ai-lab-agent-dialog: native workflow radios -> ngpRadioGroup (vertical)
  with ngpRadioItem cards; select-on-focus behaviour change documented
- specs: ai-lab-agent-about (new, 3), ai-lab-agent-dialog (new, 3)
```
