# Phase 9 — Data layer · `layout`

Date: 2026-09-25 · Branch: `refactor/structure-10` · Scope: your decision, recorded in STATE.md "Decisions".

## 1. Summary

**`layout` has no §4.2 conversions.** It makes no HTTP reads of its own:

- `footer-overlay` reads `lastViewed` through `FeatureFacade.getResource()`, which Phase 9 already moved to `httpResource`.
- The cart goes through `CartStore`, also already converted.
- `global-search-dialog` is a debounced search, which §4.2 keeps on RxJS.

I first described this row as "footer-overlay auth wiring" data work. That was wrong, and I corrected it before any code
changed: what Phase 9 left for this row is a **behaviour fix**.

| File                                           | Change                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout/footer-overlay/footer-overlay.ts`      | `isLoggedIn` was hardcoded `signal(false)`, left over from the removed `Auth` service. It is now `inject(AuthSession).isAuthenticated`, the **boolean** gate, so a token rotation never re-fires the effects it drives. `subscribed` stays `false`, and its comment says why: nothing in the app holds the user's plan (`shared/services/utils.ts:450` is nulled the same way). |
| `layout/footer-overlay/footer-overlay.spec.ts` | +3 tests: signed out, signed in, and signing in after render. They cover the three behaviours the flag gates: the cart load, the `lastViewed` read, and where Subscribe navigates. **Proven to bite:** reintroducing `signal(false)` fails 2 of the 3, and the signed-out test is the control.                                                                                  |

**The behaviour change (approved):** for signed-in users, `footer-overlay`, which appears on every page in the main layout, now:

- shows the **Continue Learning** card on offering home pages when there is an in-progress course;
- **loads the cart** once, so the cart count in the icon cluster is live;
- sends **Subscribe → `/payment/plan`** instead of `/auth/login`.

Signed-out rendering is unchanged, and so is the subscribe upsell, since `subscribed` is still `false`.

**SSR:** no new server work. The overlay only becomes visible after a scroll, which never happens on the server. The
`lastViewed` resource is browser-only (`FeatureFacade`), and `CartStore.loadMyBucket()` returns early off the browser.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run, local macOS / Node 24.15. I ran it myself: the `verifier` subagent's
invocation was refused by the harness bash guard, and the plain command is not.

| Gate            | Result                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint            | ✅                                                                                                                                                                                                                            |
| unit tests      | ✅ 163 files · **574 passed** + 1 skipped (was 571)                                                                                                                                                                           |
| build (local)   | ✅                                                                                                                                                                                                                            |
| build (prod)    | ✅                                                                                                                                                                                                                            |
| storybook build | ✅                                                                                                                                                                                                                            |
| format check    | ✅                                                                                                                                                                                                                            |
| bundle report   | ✅ · initial 99.0 KB gz, **unchanged from Phase 10 `shared/ui`**. The "+9.8 KB vs baseline" warning is the `modulepreload` artefact proven in [phase-10-shared-ui](phase-10-shared-ui.md) §2. This change adds nothing eager. |
| ssr smoke       | ✅ all routes                                                                                                                                                                                                                 |

`reviewer`: **PASS, zero violations.**

**Browser check (signed out):** on `/us/accounting/masterclass`, after scrolling, the overlay renders the subscribe card,
and Subscribe navigates to `/auth/login?redirect=%2Fus%2Faccounting%2Fmasterclass`, as before.
**I could not check the signed-in path in the browser.** It needs an OTP sign-in, which is yours to do. It is
covered by the specs and is the first item in §4.

## 3. Decisions needed / skipped / suspicious

- **No decision needed** to close this row.
- **`subscribed` has no source, app-wide.** There is no service that holds the signed-in user's plan. `utils.ts:450`
  (`userPlan = null`) and this overlay were both nulled when `Auth` went away. That makes the subscribe upsell show even to
  paying subscribers, **as it did before this change**. Fixing it needs a plan read, not a refactor phase, so it is logged
  here as a bug.
- **Pre-existing, logged:** once `CartStore` has been asked for the cart, it keeps its bucket across sign-out and
  sign-in (`wanted` never resets). Signing in as a different user in the same tab could show the previous user's cart
  count until something forces a reload. This change makes the path reachable from the overlay; it did not create it.
- No `@Injectable`, CSS file or heavy-library service is involved.

## 4. Visual QA list (signed in)

1. On `/us/accounting/masterclass`, `/podcast` and `/micro-learning` with an in-progress course, scroll down.
   **The Continue Learning card replaces the subscribe card**, and Resume opens the course.
2. On a course detail page, scroll down. The subscribe card shows, not Continue Learning, because it is restricted to exact routes.
3. The cart count in the overlay's icon cluster matches `/payment/cart`.
4. Subscribe goes to `/payment/plan`.
5. Sign out and repeat 1: the subscribe card is back, and Subscribe goes to login.

## 5. Commit message

```
fix(layout): wire footer-overlay isLoggedIn to AuthSession

isLoggedIn was hardcoded false after the Auth service was removed, so
signed-in users never got the Continue Learning card, never loaded the
cart count, and Subscribe sent them to login. Gate on the boolean
AuthSession.isAuthenticated so token rotation does not re-fire the
effects. subscribed stays false: no plan source exists yet.
```
