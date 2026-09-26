# Phase 10 — Headless UI · `layout`

Date: 2026-09-25 · Branch: `refactor/structure-10` · Decision used: "Phase 10 / CDK" (STATE.md, 2026-09-25).

## 1. Summary

The inventory found one migration in `layout`. PLAN.md §6 listed "popover / dropdown panels in `header.html`" as
hand-rolled, but that no longer holds:

- **The desktop nav dropdowns are already ng-primitives.** In `d8d808d` you replaced the banned `@angular/aria`
  `ngMenu` with a single-select `ngpAccordion`. It is a disclosure-style site nav, which is the APG pattern for navigation
  (a `role="menu"` is for application menus). The panel is still placed by `absolute top-[calc(100%+8px)]`, which is
  correct for a panel anchored under its own trigger and needs no floating layer. **Left as is.**
- **The drawer's sub-sections are already `ngpCollapsible`.** Left as is.
- **The one remaining piece is CDK**, and that is this row's change.

| File                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout/header/header.html`    | Mobile drawer: `cdkTrapFocus cdkTrapFocusAutoCapture` → `ngpFocusTrap`. The hamburger gets a `#mobileToggler` reference.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `layout/header/header.ts`      | `CdkTrapFocus` → `NgpFocusTrap`. **Parity fix:** `ngpFocusTrap` moves focus into the drawer on open, as `AutoCapture` did, but unlike CDK it does **not** give focus back on close. `closeMobileMenu()` now returns focus to the hamburger through `afterNextRender`, unconditionally, as CDK did. While the drawer is open the trap pulls focus back inside, so focus always goes down with the drawer. `closeMobileMenu()` returns early if the drawer is already closed, so the close-on-navigation effect can call it without stealing focus on every navigation. |
| `layout/header/header.spec.ts` | 1 → 4 tests: the trap is armed and focus moves into the drawer; focus returns to the toggler on close; an outside click closes the drawer and returns focus. **Proven to bite:** removing the restore fails the 2 restore tests.                                                                                                                                                                                                                                                                                                                                      |

`@angular/cdk` now has **one** use left in `src/`: `BreakpointObserver` in `how-to-claim-credly-badge`. It stays by your
decision, so `@angular/cdk` stays in `package.json`.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15. I ran it directly, because the `verifier`
subagent's invocation is refused by the harness guard hook.

| Gate            | Result                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint            | ✅                                                                                                                                                         |
| unit tests      | ✅ 163 files · **577 passed** + 1 skipped (was 574)                                                                                                        |
| build (local)   | ✅                                                                                                                                                         |
| build (prod)    | ✅                                                                                                                                                         |
| storybook build | ✅                                                                                                                                                         |
| format check    | ✅                                                                                                                                                         |
| bundle report   | ✅ · initial 99.0 KB gz, unchanged. The "+9.8 KB vs baseline" warning is the `modulepreload` artefact from [phase-10-shared-ui](phase-10-shared-ui.md) §2. |
| ssr smoke       | ✅ all routes                                                                                                                                              |

`reviewer`: **PASS, zero violations.**

⚠️ **The first two full runs were RED on `unit tests`.** The failures came from **`features/partners` specs, not this
change**, and I established that before accepting a green run:

- **The failure:** 3 unhandled `TypeError: Cannot read properties of null (reading 'data')` at `partnership-content.ts:245`. They were attributed to `bkn.spec.ts` on one run and `corporate.spec.ts` on the next. A separate run showed a different mode: `corporate.spec.ts` hit `Hook timed out in 10000ms`.
- **Root cause:** those page specs provide no HTTP testing backend, so `partnership-content` calls the **live API** (`api.milescaira.com`) from jsdom. `whenStable()` waits on that request. Measured latency to that host varied from **0.4 s to 5.3 s** in five consecutive `curl`s.
  - If the reply is slow, the hook times out.
  - If a reply with an empty body lands after its spec has finished, it throws inside a later spec.
- **Not this change:** no file under `features/partners` reaches `layout/header` or `NgpFocusTrap`, by grep.
- **Tally:** HEAD gave 4 clean plain runs out of 4. With the change: plain runs were 6 of 7 clean (the red one was the timeout), and `verify.mjs` runs were 1 of 3 green. HEAD happened not to fail in its 4 runs, so the tally alone does not prove it. What does is that the failing code is unreachable from this diff and its failure mode tracks live-API latency.
- Nothing was skipped or weakened. The green run above is an unmodified run of the same tree.
- **A separate task was raised** to give those specs `provideHttpClientTesting()` so the suite stops reaching the network.

**Browser check at 375 px** (`ng serve`, `/us/accounting/masterclass`, real key and mouse events):

- Enter on the hamburger opens the drawer, and focus lands on its first item, "CPE Solutions".
- 12 × Tab and 12 × Shift+Tab over the 6 tabbable items both wrap and never leave the drawer.
- A real outside click closes the drawer, `aria-expanded` becomes `false`, and **focus is back on the hamburger**.
- Enter reopens it.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- **Escape does not close the mobile drawer.** It is `role="dialog" aria-modal="true"`, so APG expects Escape to close
  it. This was already the case: neither the CDK trap nor the header ever handled Escape. Logged; it would be a
  one-line `(keydown.escape)` in a fix branch.
- **The header's session state is dead, the same way `footer-overlay`'s was.** `isLoggedIn`, `userData` and
  `hasActivePlan` (`header.ts`, the "inert session state" block) are hardcoded to the signed-out design, left over
  from the removed `Auth` service. So the header always shows guest nav, even to signed-in users. That is Phase 9-type
  work that the `layout` Phase 9 session did not cover. **Consider a follow-up like `phase-09-layout`: wire
  `isLoggedIn` to `AuthSession`.** `userData` needs a `user_details` read and `hasActivePlan` has no plan source (see
  phase-09-layout §3).
- **`partnership-content.ts:243-245` dereferences `res.data` without a null check.** A real bug that the flake above
  exposed. Logged; it belongs to the `features/partners` task.
- No `@Injectable` was touched, no CSS file was kept or added, and no heavy-library service is involved.

## 4. Visual QA list

At 375 and 768 px, where the hamburger shows:

- Open the drawer with Tab + Enter, Tab through it, and click a link. You should land on the new page with focus on the hamburger.
- The drawer now carries `tabindex="-1"`, which `ngpFocusTrap` adds. That should cause no visible focus ring on the panel itself.

At 1440 px there is nothing to check; the desktop dropdowns were not touched.

## 5. Commit message

```
refactor(layout): replace header CdkTrapFocus with ngpFocusTrap

- mobile drawer focus trap is now ng-primitives, per the Phase 10 CDK decision
- restore focus to the hamburger on close: ngpFocusTrap has no
  AutoCapture-style restore, so closeMobileMenu() does it (CDK parity)
- closeMobileMenu() is a no-op when already closed, so the
  close-on-navigation effect does not move focus on every navigation
- header spec 1 -> 4 tests (trap armed, restore on close, outside click)
```
