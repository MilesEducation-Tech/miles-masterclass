# Phase 10 — Headless UI · `shared/components`

Date: 2026-09-25 · Branch: `refactor/structure-10` · Scope: the five items listed in this cell's tracker footnote
(STATE.md, Part B tracker ²).

## 1. Summary

| Item               | Before                                                                                                                                                                                                                                                 | Result                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `user-avatar-menu` | already `ngpMenu` / `ngpMenuItem` / `ngpMenuTrigger`                                                                                                                                                                                                   | **no change**. PLAN.md §6 was stale here.                                                                                                                                                                                            |
| `nav-menu-item`    | already `ngpCollapsible`, a nested disclosure consistent with the header's `ngpAccordion`                                                                                                                                                              | **no change**. PLAN.md §6 was stale here too.                                                                                                                                                                                        |
| `categories-list`  | a hand-rolled tooltip: `createEmbeddedView` + a manual append to `<body>`, `fixed` coordinates from `getBoundingClientRect`, window scroll/resize listeners, and **one hardcoded `id="categories-list-tooltip"` shared by every instance on the page** | **`ngpTooltip` / `ngpTooltipTrigger` / `ngpTooltipArrow`**. −61 lines. Delays 0/0, offset 8 px and scroll-close preserve the old behaviour. The primitive now owns the id and `aria-describedby`, so each instance gets its own id.  |
| `consent-banner`   | hand-rolled `role="switch"` buttons with `aria-checked` and ternary classes                                                                                                                                                                            | **`ngpSwitch` + `ngpSwitchThumb`**, with `data-[checked]` / `data-[disabled]` variants. The unused `cn` member was removed.                                                                                                          |
| `faq-item`         | a hand-rolled disclosure: `(click)`, `aria-expanded`, and `aria-controls="panel-<id>"`, whose ids collide when nested items share an id                                                                                                                | **`ngpCollapsible`**, keeping the `faq` / `level` / `mode` / `openFaqId` inputs and the `faqToggled` output. `ngpAccordion` was rejected, because its root would have to move into the parent `Faq` and change this component's API. |

**No public API changed:** the selectors, inputs and outputs are identical, and no call site was touched.

**Two details worth knowing:**

- **`faq-item` needed an override.** `src/styles/styles.css` sets `[ngpCollapsibleContent][data-closed] { display: none }`
  globally for the nav panels, and that would cut the FAQ's grid-rows animation. The panel carries `data-[closed]:grid!`,
  with a comment explaining why.
  - The primitive also adds `hidden="until-found"` only once the panel measures 0 px. So the close animation finishes
    first, and **find-in-page can now reveal and open a closed answer**. That is new behaviour, and an improvement.
- **The tooltip positions via computed `position`**, so its panel needs the `fixed` class. Without it the ng-primitives
  overlay would fall back to `absolute` and misplace it on a scrolled page.

**Tests:** 2 new spec files and 1 extended one, **+9 tests**:

- `categories-list.spec.ts` (new, 3): it stubs canvas and layout to force a "+3 more" overflow, then checks that focus opens a tooltip listing the hidden items, `aria-describedby` points at it, blur closes it, and **two instances get distinct ids**.
- `consent-banner.spec.ts` (new, 3): 5 switches; locked tiers are on and disabled; an optional tier toggles and the saved draft carries it.
- `faq-item.spec.ts` (1 → 4): the trigger↔panel wiring; multi mode toggles itself; in single mode a click only asks the parent, and **nothing opens until `openFaqId` answers**.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15. I ran it directly, because the harness guard
refuses the `verifier` subagent's invocation.

| Gate            | Result                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------- |
| lint            | ✅                                                                                              |
| unit tests      | ✅ **165 files · 586 passed** + 1 skipped (was 163 / 577)                                       |
| build (local)   | ✅                                                                                              |
| build (prod)    | ✅                                                                                              |
| storybook build | ✅                                                                                              |
| format check    | ✅                                                                                              |
| bundle report   | ✅ · initial **100.0 KB gz** (491.9 KB raw), **+1.0 KB vs the previous row (99.0)**. See below. |
| ssr smoke       | ✅ all routes                                                                                   |

`reviewer`: **PASS, zero violations.** It reviewed steps 1–3; the `categories-list` spec was added afterwards and is
test-only. It judged the `!` modifier "a legitimate, narrowly-scoped use".

**Bundle: this +1.0 KB is real, and it is the consent banner.** `<app-consent-banner />` sits in `app.html`, so it is
eager, and `ngp-switch` now appears in `main-*.js`. None of the initial chunks contain tooltip or collapsible code; those
stay lazy with their pages. The size is small and the library is not a heavy one, so I did not add a deferral in a UI
phase. **Phase 11 option:** `@defer (on interaction)` the preferences panel behind "Customise". Most visitors never
open it, and the compact banner has no switches. The report's "+10.8 KB vs baseline" line is still dominated by the
`modulepreload` artefact from [phase-10-shared-ui](phase-10-shared-ui.md) §2.

**Browser check** (`ng serve`, `/us/accounting/masterclass`, 42 FAQ items):

- **FAQ, animation.** Sampled mid-transition, a panel opening measured 99 px (rising) and one closing measured 236 px (falling). `display` stays `grid` throughout, and `hidden="until-found"` returns only when the panel is fully closed.
- **FAQ, single mode.** The parent's mode holds: opening item 2 closes item 1.
- **FAQ, keyboard.** Real Enter opens and real Space closes, one toggle per key.
- **Tooltip: not checked in the browser.** No page renders a `categories-list` locally, because the course and listing APIs don't resolve here (the known `{{title}}` condition). The spec above covers it; it is the first item in §4.
- **Consent banner: not checked in the browser.** It only opens when consent is active, which is off locally. Covered by the spec; see §4.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **New, for the `features/offerings` Phase 10 cell:**
  `offerings/webinar/components/webinar-faq/webinar-faq.html` is a **second hand-rolled FAQ accordion**
  (`aria-controls="faq-panel-<id>"`, nested). It is the same pattern as `faq-item` was and was not on the tracker footnote.
  Worth folding into that row, or replacing with `app-faq-item` if the markup allows.
- **jsdom test notes, recorded so nobody fights them again:**
  - jsdom's selector engine mishandles `&` inside an attribute selector (`[aria-label="Analytics & performance"]` matches nothing).
  - Space/Enter on a `<button>` switch are native click activation, which jsdom does not synthesise; that path needs the browser.
- No `@Injectable` was touched and no heavy-library service is involved.
- **CSS kept:** `faq-item.css` (a `@keyframes`) and `consent-banner.css` (`:host` plus a `@keyframes`). Both are allowed by §4.6 and unchanged.

## 4. Visual QA list

1. **`categories-list` "+N more" tooltip.** Check it on a course page hero (masterclass / podcast), the CPE tracker table, and the hover course cards.
   - Hover and focus open it instantly, with the arrow pointing at the trigger.
   - It closes on mouse-leave, blur and scroll.
   - Near the top of the viewport it may now **flip below** the trigger, with the arrow following. The hand-rolled version always drew above, even when clipped.
2. **Consent banner → Customise.** Check this with consent active.
   - The three optional switches toggle by click, Space and Enter.
   - The two locked ones are dimmed and inert.
   - The colours and thumb travel look as before.
3. **Any FAQ.** On `/…/masterclass`, the webinar pages, `/faq`, and the partner pages: open and close items and check the animation both ways. Nested FAQs open their own children.
   - Ctrl/Cmd+F for a word that only appears inside a closed answer should now open that answer.

## 5. Commit message

```
refactor(shared): move tooltip, switch and faq disclosure onto ng-primitives

- categories-list: hand-rolled body-portal tooltip -> ngpTooltip (parity
  delays/offset/scroll-close); each instance now gets its own tooltip id
- consent-banner: role=switch buttons -> ngpSwitch/ngpSwitchThumb
- faq-item: hand-rolled disclosure -> ngpCollapsible, API unchanged;
  data-[closed]:grid! keeps the grid-rows animation past the global
  display:none rule, and find-in-page can now reveal closed answers
- specs: categories-list (new, 3), consent-banner (new, 3), faq-item 1 -> 4
```
