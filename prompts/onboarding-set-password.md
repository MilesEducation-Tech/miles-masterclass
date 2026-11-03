# Onboarding: set-password step (skippable)

**Story 2 of the password epic** (story 1 = MIL-166, merged as #231). **MIL-167**, branch
`feat/MIL-167-onboarding-set-password` off `master` (`c882e546`).
**Status:** approved 2026-11-03, implemented (see "Changes from the plan" at the end).

## Goal

A new learner chooses a password before the onboarding questionnaire, so next time they can log in with email and
password (story 1's default view). The step is skippable.

- `/auth/profile` in onboarding mode opens on **Set Password** (New password, Confirm new password) when the account
  may not have a password yet. **Skip for now** goes straight to the questionnaire.
- A first password needs no proof within 15 minutes of a code sign-in. After that the server answers
  `400 verification_required`, and the step asks for a code it emails to the learner (`password-code/`).
- Every answer of `password/` and `password-code/` has its own state (matrix below).
- The facade and form are built so story 3 (the profile's Password section, change with the current password) adds a
  proof and a wrapper, not a second form.

## What was read

- `features/auth/pages/profile/profile.ts|html`, `features/auth/auth.routes.ts`, `features/auth/services/auth-facade.ts`
  (countdown, lock and failure patterns), `features/auth/components/password-input/`, `features/auth/pages/login/login.html`
  (field, alert, button markup), `features/auth/{models,constants}/`, `features/auth/auth.ts|html` (the card shell).
- `core/models/{password,auth,account,http}.model.ts`, `core/services/{password-api,account-api,onboarding-api,auth-session,api-client}`,
  `core/interceptors/app/app-interceptor.ts` (no sign-out on 401/403: a coded 401 is safe to keep the form on),
  `core/guards/auth/*`, `shared/ui/input-otp/`.
- Postman §2.6 and §2.10 (`account-password-code-v1`, `account-password-v1`) and the `user-details/` example
  (`has_password`, 2026-10-28, recomputed on every cache hit).

## Locked decisions

1. **Skippable** (user, 2026-11-02): the reference app skips the step too.
2. **One epic, three PRs** (user, 2026-11-02). No refactor mixed in.
3. **Same route, a step on the page** (approved plan): no `/auth/password/set`. `routeAfterSession` already sends a
   `new_user` to `/auth/profile?redirect=…`; `onboardingGuard` sends to `/auth/profile` and drops `redirect`, so a
   separate route would lose the return URL; the step has no URL identity because it is skippable.

## Assumptions (reviewer, read first)

- **Who sees the step:** onboarding mode (`isOnboarding()`), `user-details/` loaded, and `has_password !== true`.
  `true` is trustworthy; `false` can be wrong (a reset PIN, another Miles app), which the step survives: the server
  then asks for proof (`verification_required`) and the code path takes over. If `user-details/` fails, there is no
  step and the questionnaire shows: onboarding is never blocked on an unknown.
- **The skip is not remembered.** A reload in onboarding offers the step again, still skippable. Nothing about a
  password is stored client-side (contract §2.6).
- **The facade is component-scoped** (`providers: [PasswordFacade]` on `Profile`, `@Service({ autoProvided: false })`),
  not route-scoped. Its lifetime is the page's, so a typed password can never outlive it and there is no `clear()` to
  forget; and a component provider is given the page's own `ActivatedRoute` (a route provider gets the root one,
  the story-1 trap), which it needs for `redirect`.
- **The emailed code uses `app-input-otp` with `environment.AUTH.otpLength` boxes**, digits only. The contract calls
  `emailCode` "6 to 10 characters" but also "the same code, throttle and cooldown as the email sign-in code", and that
  code is the login's OTP widget. One code, one widget. If the SSO ever sends a different length, the box count is
  the one place to change.
- **`verification_required` sends the code at once.** The learner already asked to set a password; the server's
  message says a code is needed, so the step sends it and shows where it went, rather than asking for a second click.
- **A 429 on `password/` carries no duration.** Submit is disabled for 60 s (constant, labelled an estimate) with the
  server's message; `password-code/`'s 429 uses its `retryAfterSeconds`. Skip stays enabled through both.
- **On success in onboarding:** toast "Password set" / "Next time, log in with your email and this password.",
  `account.user.reload()`, then the questionnaire. "Other devices were signed out" is NOT said here: a brand-new
  account has none, and the line would only confuse (story 3's change flow says it).
- **Client policy check** (8–72 UTF-8 bytes, a letter, a number) mirrors the contract's stated rule to save a round
  trip. The SSO stays the authority: `password_policy` puts its own message under the field (it also refuses
  "one character repeated" and "your email", which the client does not try to guess).
- **Profile mode is untouched.** The change-password section is story 3.

## Endpoint map (Postman §2.10, both bearer, `api/v1/account/`)

Envelope `{success, message, data}`; errors carry `data.statusCode` and `data.code`. Show `message` as-is; branch on
`code`. Never log, cache or keep in a URL, storage or persisted form state: passwords and codes.

| Route                 | Body                                                                                                | 2xx                                                                                                           | Errors                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST password-code/` | **none** (any key is a 400)                                                                         | 202 `{maskedEmail, cooldownSeconds, reused?, validForSeconds?}`; `reused: true` = a live code was not re-sent | 403 `code` ∈ the six refusals · 429 `data.retryAfterSeconds` · 400 (strict input)                                                                                                                                         |
| `POST password/`      | `{newPassword}` (first password, ≤ 15 min after a code sign-in, once) or `{newPassword, emailCode}` | 200 `{signedOutOtherSessions, signedOut}`, message "Your password has been set."                              | 400 `password_policy` · 400 `verification_required` · 401 `email_code_incorrect` (keep the form) · 401 no code (session failed) · 403 six refusals · 429 · 503 (after "The password could not be set", the code is spent) |
| `GET user-details/`   | —                                                                                                   | `+ has_password: boolean`                                                                                     | —                                                                                                                                                                                                                         |

Six refusals: `lms_managed`, `organisation_managed`, `email_required`, `email_not_confirmed`, `account_inactive`,
`not_available` — "this account cannot hold a password here at all".

The interceptor never signs out on a 401/403 (it only rotates before expiry), so a coded 401 keeps the session.

## Target architecture

### core

**`core/models/password.model.ts`** (extend)

- `PASSWORD_ROUTES.code` (`RouteConfig<void, CommonResponse<PasswordCodeResponse>>`) and `.set`
  (`RouteConfig<SetPasswordRequest, CommonResponse<SetPasswordResponse>>`). `ApiClient.call(route, undefined)` sends
  no body, which `password-code/` requires.
- `PasswordCodeResponse`, `SetPasswordRequest { newPassword; emailCode?; currentPassword? }` (at most one proof; an
  absent one is omitted, never `''`), `SetPasswordResponse`.
- `PASSWORD_REFUSAL_CODES` + `PasswordRefusalCode`; `PASSWORD_MIN = 8`, `PASSWORD_MAX_BYTES = 72`.
- `PasswordFailure` union + `toPasswordFailure(err)`:

  | kind                         | from                                         | carries                              |
  | ---------------------------- | -------------------------------------------- | ------------------------------------ |
  | `policy`                     | 400 `password_policy`                        | message                              |
  | `verification_required`      | 400 `verification_required`                  | message                              |
  | `invalid_input`              | other 400                                    | message                              |
  | `code_incorrect`             | 401 `email_code_incorrect`                   | message                              |
  | `current_password_incorrect` | 401 `current_password_incorrect`             | message (story 3 renders it)         |
  | `session_expired`            | 401, no code                                 | message                              |
  | `refused`                    | 403 with one of the six codes                | code, message                        |
  | `rate_limited`               | 429                                          | message, `retryAfterSeconds \| null` |
  | `unavailable`                | 502, status 0                                | message                              |
  | `code_spent`                 | 503 matching `/could not be set/i`           | message                              |
  | `misconfigured`              | other 503                                    | message                              |
  | `unknown`                    | anything else (an undocumented 403 included) | message                              |

  Reuses `readErrorBody` from `auth.model.ts` (exported for this; module-private today). `retryAfterSeconds` is
  read from `data` directly, since `readErrorBody` keeps strings only.

**`core/services/password-api/password-api.ts`** (extend) — `requestCode()` and `set(body)`, bearer attached (no
`SKIP_AUTH_TOKEN`), `SKIP_ERROR_NOTIFICATION` + `SKIP_LOADING` (the step shows its own spinner and every failure
inline). Class comment updated: no longer "only the routes that need no session".

**`core/models/account.model.ts`** — `UserDetails.has_password?: boolean` (optional: an environment without it must
not blank the header — the `Pathway` precedent); `isUserDetails` accepts `undefined | boolean`.

### features/auth

**`models/set-password.model.ts`** (new) — `SetPasswordModel { newPassword; confirmPassword; emailCode }`,
`PasswordProof = 'none' | 'email_code'` (story 3 adds `'password'`), `OnboardingStep = 'PASSWORD' | 'QUESTIONS'`.

**`constants/auth.ts`** (extend) — `PASSWORD_RETRY_FALLBACK_SECONDS = 60`, `CODE_COOLDOWN_FALLBACK_SECONDS = 60`.

**`utils/password-policy.ts`** (new) — `passwordPolicyError(value): 'short' | 'long' | 'letter' | 'digit' | null`
(bytes via `TextEncoder`). Pure; the facade maps it to copy.

**`services/password-facade.ts`** (new, `@Service({ autoProvided: false })`)

- Context: `hasPassword` (`user.hasValue() && has_password === true`).
- Step: `step = signal<OnboardingStep>('PASSWORD')`; `showsStep = computed(isOnboarding && step === 'PASSWORD' &&
user.hasValue() && !hasPassword())` — the page passes `isOnboarding` once via `start(isOnboarding)` (it owns that
  decision today); `skip()`.
- Form: `model = signal<SetPasswordModel>`; `form` — `required(newPassword)`, `validate(newPassword, policy)`,
  `required(confirmPassword)`, `validate(confirmPassword, ≠ newPassword → mismatch)`,
  `required(emailCode, { when: proof === 'email_code' })` + digits/length like the login code. Validated on submit
  (password managers fill without events — story 1's rule).
- Proof: `proof = signal<PasswordProof>('none')`; `maskedEmail`, `codeReused`, `codeValidUntil`, `cooldownUntil`,
  `isRequestingCode`, `codeSpent`; `requestCode()`; one `now` ticker (1 s, cleared by `DestroyRef`), `resendDisplay`,
  `validForDisplay`.
- Failure state: `error` (block line), `newPasswordError` (server `password_policy`), `codeError`
  (`email_code_incorrect`), `refusal` (`{code, message} | null`, replaces the form), `retryUntil` + `isRateLimited` +
  `retryDisplay`, `isSubmitting`.
- `submit()`: guards (submitting, rate-limited, refused, `codeSpent`); `PasswordApi.set({ newPassword, emailCode? })`
  with `newPassword` exactly as typed. Success / failure per the matrix. Clears every password and code from the
  model once settled.
- Session failure: `auth.clear()` → `/auth/login`, keeping the page's own `redirect` (a `new_user` returns to the
  profile anyway; nesting the profile URL inside `redirect` would loop through it).

**`components/password-form/`** (new, `app-password-form`, injects `PasswordFacade`) — the step's card content,
markup as story 1's login (heading `text-2xl font-semibold tracking-tight`, `app-field`, red `*`, `role="alert"`):

- h1 "Set Password" (`tabindex="-1"`, focused when the step appears), intro "Set a password to log in with your email
  next time. You can do this later from your profile.";
- New password (`app-password-input`, `new-password`) with the hint "8–72 characters, with at least one letter and
  one number." (`aria-describedby`), Confirm new password;
- the email-code block when `proof === 'email_code'`: server message (info, not red), "We've sent a code to
  p***a@example.com", `app-input-otp`, "Resend code" / "Resend in m:ss", the reused notice;
- block error, rate-limit line; submit "Set password" with spinner; ghost "Skip for now";
- note "A new password replaces any earlier password or emailed PIN." (contract: "say so wherever a learner can set
  one");
- refusal state: "Password not available" + server message + "Continue" (= skip).

**`pages/profile/profile.ts|html`**

- `providers: [PasswordFacade]`; inject it; `start(this.isOnboarding())` in the constructor.
- Template: loading spinner (unchanged) → `@if (password.showsStep()) <app-password-form />` → `@else` the existing
  heading + questionnaire, unchanged. On skip or success, focus moves to the questionnaire heading (`tabindex="-1"`),
  so keyboard and screen-reader users aren't left on a removed node.

**`i18n/auth/{en,ar,fr,de,es}.json`** — about 30 keys under `auth.password.*` (set, code, errors, toast, refusal);
every key in all five, no fallback language.

**Docs** — `docs/AUTH_API.md` §7: `password-code/` and `password/` move from "story 2" to bound, with the client rules
above. STATE.md entry.

## State matrix — the set-password step

alert = `<p class="text-sm text-destructive" role="alert">`.

| state                                                               | UI                                                                                                             | disabled                              |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| loading                                                             | the page's spinner until `user-details/` and `questions/` resolve                                              | —                                     |
| no step (`has_password` true, `user-details/` failed, profile mode) | questionnaire as today                                                                                         | —                                     |
| idle                                                                | heading, intro, New + Confirm (hint), Set password, Skip for now, replace note                                 | —                                     |
| invalid on submit                                                   | first error focused: required / short / long / letter / digit under New; required / mismatch under Confirm     | —                                     |
| submitting                                                          | spinner in Set password                                                                                        | Set password, Skip, Resend            |
| 200, `signedOut: false`                                             | success toast; `user` reloads; questionnaire, heading focused                                                  | —                                     |
| 200, `signedOut: true`                                              | `auth.clear()` → `/auth/login` (keeps `redirect`) + info toast "Log in with your email and your new password." | —                                     |
| 400 `password_policy`                                               | server message under New password, focused                                                                     | —                                     |
| 400 `verification_required`                                         | server message (info); code block appears; code requested at once                                              | —                                     |
| code requesting                                                     | spinner on Resend; "Sending a code…"                                                                           | Resend, Set password                  |
| code 202                                                            | "We've sent a code to {maskedEmail}", 6-box input focused, "Resend in m:ss" from `cooldownSeconds`             | Resend until 0:00                     |
| code 202 `reused: true`                                             | "Use the code we sent a few minutes ago" (+ "It's valid for m:ss more" when `validForSeconds`)                 | Resend until cooldown                 |
| code missing / wrong length on submit                               | under the code input                                                                                           | —                                     |
| 401 `email_code_incorrect`                                          | message under the code input; code cleared and focused; passwords kept                                         | —                                     |
| 401 no code                                                         | `auth.clear()` → `/auth/login` (keeps `redirect`) + toast "Your session has ended. Log in again."              | —                                     |
| 403 (six codes, either route)                                       | form replaced by "Password not available" + server message + Continue                                          | everything but Continue               |
| 429 `password-code/`                                                | alert; "Resend code in m:ss" from `retryAfterSeconds`                                                          | Resend; Skip stays                    |
| 429 `password/`                                                     | alert; 60 s estimate countdown                                                                                 | Set password; Skip stays              |
| 503 "could not be set"                                              | alert; code cleared; "Send a new code"                                                                         | Set password until a new code is sent |
| 502 / other 503 / network / other 400                               | alert; retry allowed                                                                                           | —                                     |
| Skip                                                                | questionnaire, heading focused; nothing sent                                                                   | —                                     |

## Files

| File                                                                    | Change                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/app/core/models/password.model.ts`                                 | routes `code`/`set`, types, refusal codes, policy constants, `PasswordFailure`, `toPasswordFailure` |
| `src/app/core/models/auth.model.ts`                                     | export `readErrorBody` + `AuthErrorBody`                                                            |
| `src/app/core/models/account.model.ts`                                  | `has_password?` + guard                                                                             |
| `src/app/core/services/password-api/password-api.ts`                    | `requestCode`, `set`; class comment                                                                 |
| `src/app/features/auth/models/set-password.model.ts`                    | **new**                                                                                             |
| `src/app/features/auth/constants/auth.ts`                               | two fallback constants                                                                              |
| `src/app/features/auth/utils/password-policy.ts`                        | **new**                                                                                             |
| `src/app/features/auth/services/password-facade.ts`                     | **new**                                                                                             |
| `src/app/features/auth/components/password-form/password-form.ts\|html` | **new**                                                                                             |
| `src/app/features/auth/pages/profile/profile.ts\|html`                  | provider, step gating, focus hand-off                                                               |
| `src/i18n/auth/{en,ar,fr,de,es}.json`                                   | ~30 keys each                                                                                       |
| `docs/AUTH_API.md`                                                      | §7                                                                                                  |
| `docs/refactor/STATE.md`                                                | entry; MIL-166 marked merged                                                                        |

**Size:** about 750 changed lines, ~150 of them dictionaries — over the ~400 guideline. The epic is split into three
PRs already (user's call); if review needs it smaller, the cut is **2a** (core + step with the no-proof path, every
state but the code) and **2b** (the email-code path). 2a alone would end a learner past 15 minutes at
"verification required" with only Skip, so I recommend one PR.

## Security

- Passwords and the code live only in the facade's signals, which die with the page; they are wiped on success, skip,
  a refusal and sign-out (kept after a fixable failure so the learner can correct them), never logged (`Logger` gets the failure kind only), never in a URL, storage or toast.
- `newPassword` is sent exactly as typed (no trim), as a string; `confirmPassword` never leaves the browser.
- No proof key is sent empty: `emailCode` is omitted unless the code step is active.
- `password-code/` gets no body at all.

## Acceptance criteria

1. A `new_user` signed in by code, `has_password: false`, lands on Set Password; Skip shows the questionnaire.
2. Set password (valid, matching) → 200 → toast → questionnaire; `user-details/` re-read; the step doesn't return.
3. `has_password: true`, profile mode, or a failed `user-details/` → no step.
4. Every row of the state matrix renders as described, with focus where the matrix says.
5. `verification_required` → code sent automatically → masked email, cooldown ticking, `reused` notice → correct code
   → 200.
6. Each of the six 403 codes, from either route, shows "Password not available" and Continue goes on.
7. A 401 with a `code` never signs the learner out; a 401 without one does, and returns them to the profile after.
8. Every key exists in all five dictionaries; English verified in the browser.
9. 375 / 768 / 1440: no sideways scroll, the card doesn't jump width between the step and the questionnaire.

## Checks

`pnpm lint` · `pnpm format:fix` · `node scripts/check-structure.mjs` (prune if a ratchet drops) · `pnpm build:prod`.

## How to verify

`pnpm start` (4101). Playwright with stubbed answers (`page.route('**://uat-api.milescaira.com/**')`): a signed-in
`new_user` session, `user-details/` with `has_password: false`, `questions/` from the Postman sample, then every
`password/` and `password-code/` answer from the matrix. Keyboard-only pass, `role="alert"` on every error, labels and
`autocomplete="new-password"` / `one-time-code`. English only. One live UAT run of the happy path within 15 minutes
of a code sign-in when a test inbox is available.

## Risks

1. **`has_password` not on every environment yet** → optional in type and guard; absent = "may not have one" → step
   shows, and the server decides.
2. **The 15-minute window** depends on the session a code sign-in opened. A learner who signed in by password has
   `has_password: true` and never sees the step.
3. **Phone-only sign-ups** have no confirmed email → 403 `email_required` / `email_not_confirmed` → "Password not
   available" + Continue. Expected, not a bug.
4. **`password/` 429 has no duration** → 60 s estimate (above).
5. **Rate limits while testing** — `password-code/` shares the email sign-in code's throttle and cooldown. Stub every
   status; touch UAT only for the happy path.

## Changes from the plan (implementation, 2026-11-03)

- **Card width:** the profile page's root is now `sm:w-[33rem]`, the card's inner width, as on the forgot and reset
  pages. Without it the card changed width when the step handed over to the questionnaire (491 → 455 px with a
  short stub). This also holds the card steady in profile mode, where gated questions appearing could resize it.
- **The questionnaire title is an `h1`** (was a `<p>`), with `tabindex="-1"`, so focus can move to it after the step.
- **Code messages have their own copy** ("Enter the code from your email.", "The code is N digits.") rather than
  the login's "Please enter the OTP": 36 keys per dictionary, not ~30.
- **Fields stay enabled while submitting.** Set password, Skip and Resend are disabled; disabling the inputs would
  make the focus hand-off after a refusal land on a still-disabled control (zoneless change detection runs after).
- **The code field starts untouched** when the server asks for it. The submit that got there touched every field,
  and the boxes showed red before a code was even sent.
- `PasswordProof` is `'NONE' | 'EMAIL_CODE'` (upper case, like `LoginView` and `ResetStatus`); the policy check is
  `passwordPolicyBreach()`; countdowns render through the shared `duration` pipe.
