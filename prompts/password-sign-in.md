# Password sign-in, forgot/reset, set & change password

**Epic, three stories.** Story 1 = **MIL-166** (`feat/MIL-166-password-login`), stories 2 and 3 to follow.
**Status:** approved 2026-11-02. Story 1 in progress.

## Goal

Sign-in is OTP-only today (`features/auth/pages/login`, `AuthFacade`), the onboarding/profile page is a
server-driven questionnaire that pre-fills only the name, and there is no password anywhere in the client. The
backend added five password routes on 2026-10-28 (repo Postman export of 2026-10-29, contract §2.6–2.10) and a
`has_password` flag on `user-details/`; `docs/AUTH_API.md` §7 ("password sign-in is not available") is stale.

The product asks for:

- a login page with **email + password** and a "Forgot password?" link under the password field;
- a **"Login with OTP"** label with phone and email icon buttons that open the code flow for that channel;
- **"Don't have an account? Create a new account"**, which opens a sign-up page;
- a **forgot-password** page (email → link → the link page reveals a new PIN);
- a **set-password step** in onboarding (new + confirm, skippable);
- a **Password section on the profile** (current + new when `has_password`, else new only);
- the questionnaire **pre-filled from the API**.

Every state is explicit: loading, submitting, success, each server `code`, empty, cooldown, terminal 403.

## What was read

- `features/auth/**` (login, profile, `AuthFacade`, routes, shell), `core/services/{auth-session,account-api,onboarding-api,api-client}`,
  `core/models/{auth,account,http}.model.ts`, `core/guards/auth/*`, `core/interceptors/app/app-interceptor.ts`,
  `src/legacy-redirects.ts`, `src/i18n/auth/*.json`, `docs/AUTH_API.md`, `scripts/check-structure.mjs`.
- The repo Postman collection, §2.6–2.10 and `user-details/` / `GET profile/` examples.
- The reference app's auth screens, for **design only** (layout, copy, states); its backend and code differ.

## Locked decisions (user, 2026-11-02)

1. **Prefill:** read `GET profile/?form=…` again (reverses the 2026-10-10 "drop it everywhere" decision); the name
   still seeds from `user-details/`.
2. **Sign-up:** `/auth/signup` is OTP-based (identifier + consent → code → set password → questionnaire). The
   account is created by `auth-otp-verify/`; there is no register-with-password route.
3. **Onboarding set-password is skippable** ("Skip for now"), as the reference app does.
4. **One epic, three PRs.** No refactor mixed in (the questionnaire `ProfileFacade` from the facade audit stays a
   later `refactor/` PR).

## Assumptions (reviewer, read first)

- **Password sign-in takes an email** (the brief says "email and password"; the forgot flow takes only an email).
  The API also accepts a phone or username; loosening the validator later is one line.
- **Sign-up is the `Login` component behind a second route** (`data: { signup: true }`): sign-up copy, OTP view
  only, Email tab first. A phone sign-up can't set a password until an email is confirmed (`password/` answers
  403 `email_required` / `email_not_confirmed`), which story 2 renders. A known identifier "signing up" simply
  signs in: `auth-identify/` answers identically for known and unknown.
- **The view follows the URL.** `/auth/login` is the password view; `?method=phone|email` is the OTP view on that
  tab. The icon buttons push a history entry, so Back returns to the password view; the tabs inside the OTP view
  replace it.
- **The password form validates on submit, not by disabling Login.** Chrome withholds autofilled values from
  script until the page is interacted with, so a button gated on validity can sit dead over filled fields. Submit
  reads both fields once, then validates and shows the errors.
- **A password 429 shows the server's message and a "Log in with a one-time code instead" way out, with no
  countdown.** It can be the account lock (15 minutes) or a shared upstream limit; a countdown would be a guess,
  and the server enforces the lock anyway.
- **Forgot page: only a 202 shows "Check your email".** 400 / 502 / 503 / network show an inline error and the
  button stays: nothing was sent (same rule as OTP send). The reference shows the sent state for every outcome;
  we deviate.
- **The reset link reveals a PIN** (`{username, password}`); it does not let the learner choose one. The local
  session is cleared only after a 200 (landing on the link signs nobody out; mail scanners pre-open links).
- **Saving answers (story 3):** blanks are still never sent (`null` is refused; `""`/`[]` undocumented), but a
  boolean now sends `false` when the saved value was `true`.
- **`has_password` is optional in `UserDetails`** (story 2, where it is first read), so an environment without it
  can't fail the whole row.

## Endpoint map (`postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`, §2.6–2.10)

Envelope `{success, message, data}`; on errors `data.statusCode` + `data.code`, `message` on top. camelCase fields.
Show `message` as-is; branch on `code`. Never log, cache, or put in a URL / storage / persisted form state:
passwords, PINs, reset tokens, codes. Passwords are JSON strings sent exactly as typed (no trim).

| Route (all `api/v1/account/`) | Auth   | Body                                                                                                     | 2xx                                                                         | Errors                                                                                                                                         |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST auth-password-login/`   | none   | `{identifier, password}`                                                                                 | 200 session, same shape as `auth-otp-verify/`                               | 400 · **401 "Invalid credentials"** (unknown = wrong) · **429** (5 fails / 15 min locks password sign-in, never code sign-in) · 502 · 503      |
| `POST auth-password-forgot/`  | none   | `{identifier: <email>}`                                                                                  | **always 202**, fixed message, `data:null`                                  | 400 not-an-email / strict · 502 · 503                                                                                                          |
| `POST auth-password-reset/`   | none   | `{token}`                                                                                                | 200 `{username, password}` (6-digit PIN, shown once); signed out everywhere | 400 fixed "This link has expired or was already used…" · 429 · 502 · 503                                                                       |
| `POST password-code/`         | bearer | none                                                                                                     | 202 `{maskedEmail, cooldownSeconds, reused?, validForSeconds?}`             | 403 six `code`s · 429 `data.retryAfterSeconds`                                                                                                 |
| `POST password/`              | bearer | `{newPassword}` + `emailCode` \| `currentPassword` \| nothing (first password ≤15 min after OTP sign-in) | 200 `{signedOutOtherSessions, signedOut}`                                   | 400 `password_policy` / `verification_required` · 401 `email_code_incorrect` / `current_password_incorrect` / none · 403 six codes · 429 · 503 |
| `GET user-details/`           | bearer | —                                                                                                        | + `has_password`                                                            | —                                                                                                                                              |
| `GET profile/?form=…`         | bearer | —                                                                                                        | flat `{code: answer}` (+ non-answer keys); `{}` empty                       | 400                                                                                                                                            |

The six 403 codes: `lms_managed`, `organisation_managed`, `email_required`, `email_not_confirmed`,
`account_inactive`, `not_available`. New-password policy: 8–72 **bytes**, a letter and a number. Login floor 6.

## Target architecture

### Story 1 — MIL-166 (this PR)

**core/**

- `models/auth.model.ts`: `AUTH_ROUTES.passwordLogin` (mints a session → in `SESSION_MINTING_PATHS` by
  derivation), `PasswordLoginRequest`; `toAuthFailure`'s 401 fallback becomes credential-neutral.
- `models/password.model.ts` (new): `PASSWORD_ROUTES.{forgot, reset}`, request/response types,
  `PASSWORD_MIN_LOGIN`. Story 2 adds `code`, `set`, `PasswordFailure`, `toPasswordFailure`, the policy pre-check.
- `services/auth-session/auth-session.ts`: `loginWithPassword(body)`, the same fresh start as `verifyOtp`
  (clear the AI Labs session, `store()`); `store()` is private, so a session can only be minted here.
- `services/password-api/password-api.ts` (new, stateless): `requestLink(email)`, `redeem(token)`, with
  `SKIP_AUTH_TOKEN` (both are `AllowAny`, and DRF authenticates before it checks permissions, so a stale bearer
  would 401 a valid link) and `SKIP_LOADING` (both pages show their own spinner).

**features/auth/**

- `services/auth-facade.ts`: `isSignup`, `view` (from `?method=`), `loginMethod` follows the URL,
  `passwordModel`/`passwordForm`, `passwordError`, `offerOtpInstead`, `loginWithPassword()`,
  `routeAfterSession()` (shared with `verifyOtp`), `useOtp()`, `usePassword()`, `start(signup)`.
- `models/sign-in.model.ts` (new): `PasswordLoginModel`, `LoginView`, `ForgotPasswordModel`, `ResetStatus`.
- `constants/auth.ts` (new): `SUPPORT_EMAIL` (the facade and the forgot page).
- `components/password-input/` (new): the field with a show/hide toggle, reused by stories 2 and 3.
- `pages/login/`: the password view (email, password, "Forgot password?", Log in, "Login with OTP" + two icon
  buttons, "Don't have an account? Create a new account"), the existing OTP markup, "Use password instead",
  sign-up copy. The legal line moves below the button and shows on both views.
- `pages/forgot-password/`, `pages/reset-password/` (new).
- `auth.routes.ts`: `signup`, `forgot-password`, `password/reset`; aliases.
- `src/legacy-redirects.ts`: `/auth/forget-password` → `/auth/forgot-password`; `/auth/signup` no longer redirected.

### Story 2 — onboarding set-password

`PasswordFacade` (route-scoped on `profile`), `components/password-form/`, `password.model.ts` failures and policy,
`PasswordApi.requestCode/set`, `UserDetails.has_password`, the step gated on `needsOnboarding() && has_password !== true`
inside `/auth/profile` (a separate route would lose `redirect`: `onboardingGuard` drops it).

### Story 3 — profile Password section and prefill

`components/password-section/`, `OnboardingApi.answers` (`GET profile/`), seed priority: unsaved edits > saved
answer > `user-details/` name.

## Routing

| path              | guards                       | providers                    | component                                   |
| ----------------- | ---------------------------- | ---------------------------- | ------------------------------------------- |
| `login`           | `guestGuard`                 | `[AuthFacade]`               | `pages/login` (`?method=`, `?redirect=`)    |
| `signup`          | `guestGuard`                 | `[AuthFacade]`               | `pages/login`, `data: { signup: true }`     |
| `forgot-password` | `guestGuard`                 | —                            | `pages/forgot-password`                     |
| `password/reset`  | none                         | —                            | `pages/reset-password` (token in `#token=`) |
| `profile`         | `authGuard`, `canDeactivate` | `[PasswordFacade]` (story 2) | `pages/profile`                             |

## State matrix (story 1)

alert = `<p class="text-sm text-destructive" role="alert">`.

**Login, password view:** idle (fields, Forgot password?, Log in, OTP chooser, create-account footer, legal line) ·
submit with errors → touched-field messages, nothing sent · submitting → spinner, Log in disabled · 200 →
`new_user` to `/auth/profile?redirect`, else `redirect ?? '/'` · 401 → alert with the server message, password
cleared and focused · 429 → alert + "Log in with a one-time code instead" (OTP email view, email carried over) ·
403 blocked/deactivated → alert, Log in disabled for good · 400/502/503/network → alert, retry allowed.

**Login, OTP view:** the existing behaviour unchanged, plus "Use password instead" (not on sign-up).
**Sign-up:** OTP view with sign-up copy, Email tab first, footer "Already have an account? Log in".

**Forgot:** idle · invalid → field messages · submitting → spinner · 202 → "Check your email", server message,
spam hint, "Log in with a one-time code instead", "Still stuck? Contact support", "Back to login" · 400/502/503/network
→ alert, the form stays.

**Reset:** missing token → message + "Request a new link" · ready → "Show my new password" (no request yet) ·
busy → spinner · 200 → local session cleared, username + PIN, "Copy password"/"Copied", "Log in now" · 400 → alert

- "Request a new link" (link spent) · 429 → alert + Try again · 502/503/network → alert + Try again + "Request a new link".

## Files (story 1)

`core/models/{auth.model.ts, password.model.ts}`, `core/services/{auth-session/auth-session.ts, password-api/password-api.ts}`,
`features/auth/{auth.routes.ts, services/auth-facade.ts, models/sign-in.model.ts, constants/auth.ts,
components/password-input/*, pages/login/*, pages/forgot-password/*, pages/reset-password/*}`, `src/legacy-redirects.ts`,
`src/i18n/auth/{en,ar,fr,de,es}.json`, `docs/AUTH_API.md`, `AGENTS.md` (§5 row), `structure-baseline.json` (pruned),
`docs/refactor/STATE.md`. Relative imports in every touched file become aliases.

## Security

- Passwords and PINs live in signals for the page's lifetime only; `clear()` on leave wipes the login form.
- The reset token is read once from the fragment into a private field, stripped from the address bar at once, and
  sent only on click. It never enters a signal, the URL, storage or a log.
- No identifier in any URL (the forgot page is not pre-filled from login for that reason).
- Forgot and reset send no bearer.

## Acceptance criteria (story 1)

- `/auth/login` shows the password view; Log in signs in and routes like OTP; every error status renders.
- The phone and email buttons open the OTP flow on that tab, `?method=` deep links work, Back returns to password.
- `/auth/signup` signs up by code; `/auth/forgot-password` and `/auth/password/reset#token=` work per the matrix.
- `/auth/forget-password` redirects permanently to `/auth/forgot-password`; `/auth/signup` is a page.
- Five dictionaries carry every new key. `docs/AUTH_API.md` describes the password routes.

## Checks

`pnpm lint` · `pnpm format:fix` · `node scripts/check-structure.mjs` (prune) · `pnpm build:prod`.

## How to verify

Dev server 4101 with stubbed `api/v1/account/*` answers for every status; 375 / 768 / 1440; keyboard only; labels,
`role="alert"`, `autocomplete` (`username`, `current-password`), the eye toggle's `aria-pressed` and label. The
legacy redirect needs the SSR server. One live UAT password sign-in confirms the 200 shape (risk 1).

## Risks

1. **The login 200 example shows only token keys.** If the live body lacks `profile_status` / `is_test_user`,
   `isSessionResponse` refuses it. Confirm on UAT before review; don't loosen the guard.
2. **Reset link host and token placement:** the email must point at `/auth/password/reset#token=…` (fragment, not
   query). Confirm with the backend.
3. **A cached permanent redirect for `/auth/signup`** keeps sending some browsers to `/auth/login`.
4. **CORS:** the new routes must accept the interceptor's custom headers.
5. **Rate limits while testing:** stub every status; touch UAT only for happy paths.
6. **`has_password` false-negatives** and the **15-minute first-password window** (story 2).
7. **`PATCH profile/` and `""` / `[]`** (story 3).
