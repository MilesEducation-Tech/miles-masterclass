# Auth contract fixes: align the sign-in session with the new Postman collection

**Branch:** `fix/MIL-XXX-auth-contract-fixes` (ticket number TBD)
**Commit:** `fix(auth): bearer on logout, transient refresh failures, 502 split, strict session types`
**Size target:** about 200 changed lines, specs included. That fits one PR.

## Goal

The new collection (`postman/Merged Masterclass Backend - All APIs/01. Authentication and Session/`) matches our five auth paths and request bodies exactly. What differs is behaviour: logout never works, a transient refresh failure signs the user out, and a transient 502 on verify throws away a valid code. This PR fixes those three problems and tightens the auth types to what the contract actually guarantees. It does not touch the profile, account or webinar code; those have their own PRs.

## What I read

- **Postman.** Folder `definition.yaml`, all 5 `*.request.yaml`, and all 19 saved examples. None of them is a 200: success shapes exist only in the prose.
- **Code.**
  - `core/models/auth.model.ts` (+ spec)
  - `core/services/auth-session/auth-session.ts` (+ spec)
  - `core/interceptors/app/app-interceptor.ts` (+ spec)
  - `features/auth/services/auth-facade.ts` (+ spec)
  - `features/auth/pages/login/login.html`
  - `shared/components/user-avatar-menu/user-avatar-menu.ts`

## Findings → fixes

| #   | Contract says                                                                                                                                                                                                                                      | Code does today                                                                                                                                                                                                                                                                                                                              | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `auth-logout/` **requires** `Authorization: Bearer`; without it: 401 `"Authorization header with a Bearer token is required."`                                                                                                                     | `AUTH_ROUTE_PATHS` includes logout, so `appInterceptor` sets `skipToken` for it (`app-interceptor.ts:39`). Every logout gets a 401, `AuthSession.logout()` swallows it and keeps the session (`auth-session.ts:135-142`), and the avatar menu hard-navigates to `/` while the user is still signed in.                                       | Exclude logout from the skip list. It then takes the normal interceptor path: refresh only if the token is inside the skew, then attach the bearer. See the A1 notes below.                                                                                                                                                                                                                                                                                                                                                                     |
| A2  | Refresh: only **401** means "sign in again". 502 and 503 are transient, and the collection keeps the tokens on any other non-200.                                                                                                                  | `doRefresh` calls `clear()` on **any** error (`auth-session.ts:204-210`). A 502, a 503 or a network blip signs the user out, including the `forceRefresh()` after a profile save.                                                                                                                                                            | Clear only on 401. On any other error, keep the tokens and let the original request go out. A 403 from the server on the next request is the real signal. The malformed-body path already clears inside `store()`; leave it.                                                                                                                                                                                                                                                                                                                    |
| A3  | verify has two 502s: `"Sign-in could not be completed. Please request a new code."` (the code is spent) and `"Sign-in is temporarily unavailable. Please try again."` (transient). identify, send, refresh and logout only have the transient one. | Every 502 becomes `retry_new_code` (`auth.model.ts:275`), and verify then always sends the user back to the login step (`auth-facade.ts:418`).                                                                                                                                                                                               | Add `AuthFailure` kind `unavailable`. A 502 whose message asks for a new code → `retry_new_code`; any other 502 → `unavailable`, which keeps the user on the current step with the message shown.                                                                                                                                                                                                                                                                                                                                               |
| A4  | "Code length is set server-side. Read it rather than hardcoding six boxes." No route returns a length, though.                                                                                                                                     | `6` is hardcoded twice and separately: `AuthFacade.OTP_LENGTH` and `[length]="6"` in `login.html:137`.                                                                                                                                                                                                                                       | There is no length field to read, so this stays a question for the backend. For now, make `OTP_LENGTH` one exported facade constant and bind `[length]="authFacade.otpLength"`, so a server change is a one-line edit and can't make the template and the validator disagree.                                                                                                                                                                                                                                                                   |
| A5  | `IdentifyResponse` prose names only `methods`, `defaultMethod`, "masked destinations" and `communicationId`. Session: `is_test_user` is always a boolean. 403 `code` is `account_blocked` or `account_deactivated`.                                | `accountType`, `maskedEmail` and `maskedPhone` are **required**, although no example confirms them and nothing reads them. `isSessionResponse` doesn't check `is_test_user`. `OtpSendResponse.channel` is a closed union, although §8.3 says SSO fields are additive. A 403 without a known code falls back to `blocked`, which is terminal. | Make the three identify fields optional, with a comment that they're unconfirmed. Check `typeof is_test_user === 'boolean'` in `isSessionResponse`. Widen `OtpChannel` with `(string & {})`; the facade's `otpDeliveryNote` switch already has a default. Map a 403 without a known code to `unknown`, because a terminal screen for an undocumented body is the wrong way to fail. Add an exported `AuthErrorBody` union type describing the documented bodies, used by `messageOf` and `fieldsOf` instead of `Record<string, unknown>` casts. |
| A7  | No lockout duration is documented for 429.                                                                                                                                                                                                         | Hardcoded to 30 minutes, with a comment claiming "what the contract documents" (`auth-facade.ts:461-464`).                                                                                                                                                                                                                                   | Keep 30 minutes, since the countdown needs some number. Rename it to `LOCKOUT_FALLBACK_MS` and correct the comment to say the duration is our assumption.                                                                                                                                                                                                                                                                                                                                                                                       |

### A1 notes: logout

- `AUTH_ROUTE_PATHS` is renamed **`SESSION_MINTING_PATHS`**: identify, sendOtp, verifyOtp and refresh. It is still derived from `AUTH_ROUTES` so a renamed path can't drift, with logout filtered out by key. The rationale in its comment ("refreshing before the call that mints the session is nonsense") now fits every entry.
- The token is still attached only by the interceptor (AGENTS.md §7); nothing is hand-attached.
- `AuthSession.logout()` returns `Promise<boolean>`: true when the SSO confirmed. The session is cleared on 2xx (the contract). **Assumption:** it is also cleared on a 401, because a 401 now means our bearer is unusable, so no live session is being hidden (see Assumptions).
- `UserAvatarMenu.onLogout` shows an error notification through the existing `core/services/notification/notification.ts` and does **not** navigate when logout returns false. Today it navigates to `/` either way, which looks like a signed-out screen on top of a live session.

## Out of scope (other PRs)

- **A6, refresh via the httpOnly cookie** (`{}` + `withCredentials`). That still needs your decision, and the cookie attributes still can't be observed on UAT. `doRefresh` keeps sending `{refreshToken}`, which the contract allows.
- **Account and profile.** `user_details/` was deleted, and `setMilestones` / the doc comments that reference it are handled in the profile PR.
- **`docs/AUTH_API.md` rewrite** (the docs PR). This PR only fixes the two docs lines it makes wrong: the logout-auth row and the 502 row.
- **The unused `SKIP_ERROR_NOTIFICATION` flag.** Noted only; it's not a contract issue.

## Files touched

| File                                                                            | Change                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core/models/auth.model.ts`                                                     | `SESSION_MINTING_PATHS`; `unavailable` kind; the 502 split; 403 fallback → `unknown`; `AuthErrorBody`; optional identify fields; `OtpChannel` widening; `is_test_user` check                                 |
| `core/models/auth.model.spec.ts`                                                | Specs use the **verbatim Postman example bodies**: both 502s, the strict-key 400, the 401 logout body, 503, both 403 codes plus a 403 with no code; `is_test_user` rejection; logout not in the minting list |
| `core/interceptors/app/app-interceptor.ts`                                      | Import `SESSION_MINTING_PATHS`; update the comment                                                                                                                                                           |
| `core/interceptors/app/app-interceptor.spec.ts`                                 | "skips every **session-minting** route"; new: "logout carries the bearer (and may refresh first)"                                                                                                            |
| `core/services/auth-session/auth-session.ts`                                    | `doRefresh` clears only on 401; `logout(): Promise<boolean>`, clearing on 2xx or 401                                                                                                                         |
| `core/services/auth-session/auth-session.spec.ts`                               | Refresh 502 and 503 keep the session; refresh 401 still clears; logout returns true/false; logout 401 clears                                                                                                 |
| `features/auth/services/auth-facade.ts`                                         | Public `otpLength`; `unavailable` doesn't call `goBackToLogin()`; `LOCKOUT_FALLBACK_MS`                                                                                                                      |
| `features/auth/services/auth-facade.spec.ts`                                    | Verify 502 "try again" stays on the OTP step; 502 "new code" goes back to login                                                                                                                              |
| `features/auth/pages/login/login.html`                                          | `[length]="authFacade.otpLength"`                                                                                                                                                                            |
| `shared/components/user-avatar-menu/user-avatar-menu.ts` (+ spec if one exists) | Toast and stay on a failed logout                                                                                                                                                                            |
| `docs/AUTH_API.md`                                                              | Two rows (logout requires the bearer; the 502 split)                                                                                                                                                         |

## Security requirements

- The bearer is still attached only by `appInterceptor`, and only to our own API origin. The `IS_EXTERNAL_REQUEST` bypass is unchanged.
- The four minting routes still never carry a bearer and never trigger a refresh.
- Refresh stays serialised through `inFlight`. The change to what counts as failure must not add a retry loop: a failed refresh is not retried by `doRefresh` itself.
- A 403 without a documented code must never render the terminal blocked or deactivated screen.

## Assumptions (reviewer: read these first)

1. **Clearing on a logout 401.** The contract says "clear tokens on 2xx only". I also clear on a 401, because once the bearer is attached, a 401 can only mean our token is invalid, so the SSO has no session to keep alive. If you want the contract followed to the letter, it's a one-line revert.
2. **Telling the two 502s apart by message text** (`/new code/i`). There is no `code` field to switch on. If the match misses, the fallback is `unavailable` (the user stays on the step and retries). The worst case is then a 401 "bad code", after which the user resends. That's safer than throwing away a valid code.
3. **OTP length stays 6.** Nothing in the contract returns a length. **Backend question:** add `codeLength` to the `auth-otp-send/` response?
4. **Refreshing before logout is allowed.** `ensureFreshToken` is a no-op unless the token is within 120 s of expiry, and a fresh token is what logout needs.

## Acceptance criteria

- Logout sends `Authorization: Bearer <token>`, clears the cookies on 2xx, and a reload stays signed out.
- A failed logout (502/503) keeps the session, shows a toast, and does not navigate.
- A refresh answering 502 or 503 leaves `isAuthenticated()` true; a 401 clears it.
- A verify 502 "temporarily unavailable" keeps the OTP step and the typed code; a verify 502 "request a new code" returns to the login step.
- A 403 with no or unknown `code` renders the message without the terminal state.
- The number of OTP boxes and the validator length come from one constant.
- No `any`, no `as unknown as`, no new dependency.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm ng test --watch=false
pnpm build:prod
```

Record the environment the checks ran in (macOS local, Node 24.15).

## How to verify manually (UAT, `pnpm start` → http://localhost:4101)

1. Open `/us/cpa/auth/login` and sign in with phone OTP. Profile routing is unchanged.
2. Avatar menu → Sign out. In DevTools → Network, `auth-logout/` should have an `Authorization` header and a 2xx response. The cookies are gone, and a reload shows the signed-out header.
3. In DevTools → Network, block `auth-logout/` (or throttle to offline) and sign out again. A toast appears, you stay on the page, and you're still signed in.
4. Force a refresh failure: block `auth-token-refresh/` and wait until the token is within 120 s of expiry, or call `forceRefresh` from the profile save. You stay signed in.

## Risks

- **UAT access.** UAT answered 503 on every auth route as of 2026-09-22. If it still does, steps 1–4 can't run live, and verification rests on the specs fed with the Postman bodies. I'll say which one it was.
- **Message matching** (Assumption 2) breaks if the SSO rewords its copy. The fallback is the safe side.
- **Renaming `AUTH_ROUTE_PATHS`** touches every importer. There are two, both covered by specs, and a grep confirms there are no others.
