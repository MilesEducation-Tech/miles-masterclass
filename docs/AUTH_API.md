# Authentication — MilesCAIRA Accounts v1

How this app signs a learner in, and the rules the backend imposes on it.

**Contract source:** the Postman collection `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`,
folders `01. Authentication and Session` and `02. Account, Profile and Reference Content`. Each request's
description quotes `ACCOUNTS_API_CONTRACT_V1.md` verbatim, and each request saves one example response per
documented status. The collection is generated backend-side and marked do-not-hand-edit — treat it as the source
of truth and this file as the frontend's reading of it.

Re-audited against the collection on 2026-09-27 (MIL-5 auth fixes, MIL-6 profile rebind), on 2026-10-10 when
the backend enveloped every response (see "The envelope" below), and on 2026-11-02 for the password routes
(MIL-166, §7).

**The envelope.** Since 2026-10-10 every body, success and error alike, on every route is
`{success, message, data}` (verified live on UAT). Everything this document calls "the body" or "the 200" is
`data`. The client unwraps it at the service: `AuthSession` (`.pipe(map((res) => res.data))`), `AccountApi`
and `OnboardingApi` (`parse`). Error details move too: a field-keyed 400 is `data: {<field>: message}`, and
`message` is lifted to the top.

| Environment | `environment.API.baseUrl`         |
| ----------- | --------------------------------- |
| production  | `https://api.milescaira.com/`     |
| UAT / local | `https://uat-api.milescaira.com/` |

---

## 1. The routes

All under `{API.baseUrl}api/v1/account/`. Every path has a trailing slash; omitting it 404s.

### Sign-in — no auth, `AllowAny`

| Route                       | Body                                    | 200                                                         |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `POST auth-identify/`       | `{identifier}`                          | `{methods, defaultMethod, communicationId, …masks}`         |
| `POST auth-otp-send/`       | `{email}` _or_ `{mobile, country_code}` | `{channel, cooldownSeconds}`                                |
| `POST auth-otp-verify/`     | the same, plus `code`                   | `{accessToken, refreshToken, profile_status, is_test_user}` |
| `POST auth-password-login/` | `{identifier, password}`                | the same session as `auth-otp-verify/` — see §7             |
| `POST auth-token-refresh/`  | `{refreshToken}` _or_ `{}`              | same four keys, **rotated**                                 |
| `POST auth-logout/`         | _(none — bearer **required**)_          | 2xx; 401 without a bearer                                   |

On identify, `identifier` is an email, phone number (E.164) or username — the SSO works out which.

**Send and verify no longer take `identifier`** (live on UAT 2026-10-12; both reject it as an
undeclared field). They take exactly one of `email`, or `mobile` + `country_code`
(`{"mobile": "7501223507", "country_code": "+91"}`): both is a 400 "never both", neither is a 400,
and `mobile` without `country_code` is a 400. The client types this as `OtpContact`. Both routes
also declare an optional `communication` (example `"dev"`); the app never sends it.

`appCode` is **not** accepted from the client; it is added server-side, because it names which
application is asking and a caller must not be able to claim to be another one.

### Account — JWT, `IsAuthenticated`

| Route                                     | Notes                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET user-details/`                       | 8 routing fields (names, milestones, `Pathway`, enrolment) and the subscription block. **GET only** — the old `user_details/` row and its PATCH were deleted 2026-09-24. |
| `GET questions/?form=onboarding\|profile` | `{Questions: [...]}`, flat, sorted by `display_order`.                                                                                                                   |
| `GET/PATCH profile/?form=…`               | Questionnaire answers **only**. See §4. Read to pre-fill the form (`OnboardingApi.answers`); `PATCH` is the only write.                                                  |
| `GET web/maintainance-status/`            | Public. `{is_maintenance, force_logout_all_user}`. Not bound yet — the old `web/app-status/` had no reader and was removed.                                              |

---

## 2. The five rules

Each of these is a bug if ignored, and each has a test that fails if it regresses.

### Rule 1 — a missing or bad token answers **401** (it used to be 403)

Until the envelope landed, DRF downgraded an authentication failure to 403, because the authenticator
did not implement `authenticate_header()`. **As of 2026-10-10 UAT answers 401** —
`{"success":false,"message":"Authentication credentials were not provided.","data":null}` with no token,
`"Error decoding signature."` with a bad one — while the collection's saved examples are still labelled 403.
Nothing in the client branches on the difference: no read retries, and only `logout`/refresh act on a 401.

_Verified live against UAT on 2026-10-10: `user-details/` and `questions/` answered 401 with no token and
with a garbage bearer._

### Rule 2 — refresh **before** expiry, never as a retry after a 401/403

The access token is deliberately short — it is the window in which a suspended user keeps access —
and it cannot be revoked once issued, so the documented client behaviour is to rotate ahead of time.
Retrying after a 401 would also mean re-sending the original request, which is wrong for a POST that
has already taken effect.

`AuthSession.ensureFreshToken()` decodes the JWT `exp` and rotates when under 120 s of life remains
(the same skew the Postman collection uses). `appInterceptor` calls it on the way out of every
request, so freshness is checked exactly when it matters and there is no timer to leak under SSR.

### Rule 3 — refresh tokens rotate, and two refreshes must never run at once

The previous refresh token dies about **ten seconds** after use. Two concurrent refreshes therefore
invalidate the caller's own session. `AuthSession` serialises them behind one in-flight promise, and
stores the **rotated** pair every time — keeping the old one works exactly once and then fails
against a value that still looks like a valid token.

### Rule 4 — `profile_status` is **not** the token claim `miles.onboarding_required`

They describe different facts and have **opposite polarity**. The claim describes the identity store
(whether the SSO still needs a name); `profile_status` is this platform's onboarding milestone. A
user can be fully known to the SSO and still be `new_user` here. Reading one for the other inverts
the sign-up gate silently.

`onboardingGuard` branches on the milestone, and `onboarding-guard.spec.ts` asserts that exactly
one status redirects.

### Rule 5 — after `PATCH profile/` advances the milestone, **refresh the token before anything else**

The claim is minted _into_ the token, so completing the profile and not refreshing re-reads a stale
value and bounces the user straight back into the onboarding they just finished. The contract calls
this "the single most common integration bug on this surface."

The sequence is: verify → `profile_status: "new_user"` → complete the profile → **refresh** → go.

---

## 3. Sign-in, end to end

1. **`auth-identify/`** — the first call of any login, always. It is wired as an **async validator on
   the identifier field** (`validateHttp`), not as a step in the submit handler, so it fires as soon
   as the identifier looks complete, debounced by 400 ms. The field's `valid()` is false while it is
   pending, which is what the submit button is already gated on — "identify first, always" is
   therefore structural, and the submit path issues only `auth-otp-send/`.
   - **`methods` never contains the bare string `"otp"`.** The values are `email_otp`, `phone_otp`,
     `password` and later `saml`, and they follow the KIND of identifier: an email gives
     `["email_otp", "password"]`, a phone gives `["phone_otp", "password"]`, a username gives
     `["password", "email_otp"]`. Match with `isOtpMethod()` (suffix `_otp`), never on equality —
     matching `"otp"` is how every account ends up looking like enterprise SSO.
   - An account with no `*_otp` method becomes a **field error** ("signs in through your
     organisation"), so the form refuses the submit rather than a bespoke banner doing it.
   - **A failed identify reports nothing** (`onError` returns `null`): a background call must never
     put an error under a field the user is still typing in, and it must not block the send.
   - The `when` gate asks "is this worth a round trip yet?" from the **value only**. It must not read
     `state.invalid()` — this validator feeds that signal, and reading it is a computation cycle.
2. **`auth-otp-send/`** — sends the code.
   - **Write UI copy from the returned `channel`**, never from what was sent. It is `email`, `sms` or
     `whatsapp`, and phone routing is a table at the SSO that changes with no deploy on either side.
     As of 2026-09-08 **every country resolves to `sms`, India included.**
   - `cooldownSeconds` is how long the resend button stays disabled. Read it; do not hardcode one.
   - `channel` is **not an accepted input** — sending it is a 400.
   - A number the SSO cannot send to answers **401** "Unable to send a code to that identifier".
     `toAuthFailure` files it as `bad_code` and renders that copy; it does not count toward the
     verify attempt tally.
   - A **503 means nothing was sent and nothing will be.** Advance the user to a retry, never to a
     code-entry screen. It says our mailer is broken; it never says anything about the account.
3. **`auth-otp-verify/`** — exchanges the code for a session. `code` is a string; the contract
   says its length is set server-side at the SSO — but **no route returns that length**, so the
   OTP boxes and the validator share one constant (`AuthFacade.otpLength`, today `6`). If the
   backend ever reports it (see §6), read it into that one field.
4. Route on `profile_status`: `new_user` → `/auth/profile`, otherwise the `redirect` param or `/`.

### Failure modes, and the UI each one wants

| HTTP | Body                                     | Meaning                                           | Do                                                       |
| ---- | ---------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| 400  | field-keyed map                          | Malformed input; the SSO's copy is learner-facing | Render it verbatim, against the field                    |
| 401  | SSO's                                    | Wrong or expired code                             | Let them retype                                          |
| 429  | SSO's                                    | Identifier locked                                 | Show the lockout, **do not retry**                       |
| 403  | `{code: "account_blocked"}`              | Partner-imposed block                             | **Terminal.** Permission message, point at Miles support |
| 403  | `{code: "account_deactivated"}`          | Miles deactivation                                | **Terminal.** Same, different team                       |
| 502  | `{message: "…request a new code."}`      | Provisioning failed after a valid token (verify)  | **Retryable** — the code is spent, send for a new one    |
| 502  | `{message: "…temporarily unavailable…"}` | Transient, any auth route                         | Retry the same step; nothing was consumed                |
| 503  | `{message: …}`                           | Our configuration fault                           | Not the user's problem                                   |

The two 403s are deliberately distinct: `active` and `is_blocked` are separate columns set by
different people for different reasons, and telling a blocked learner their account is "deactivated"
sends them to the wrong team. A 403 with any other body is **not** terminal. The two 502s carry no
`code`, so `toAuthFailure()` tells them apart by copy. `toAuthFailure()` in `auth.model.ts` is the only
place that knows this mapping.

Logout is the one sign-in route that needs `Authorization: Bearer`, so the interceptor's skip list
(`SESSION_MINTING_PATHS`) holds all the others. Refresh clears the session **only on 401**;
502/503 keep the tokens.

**Unknown fields are rejected.** Every auth route uses a strict serializer: posting an undeclared
field returns 400 keyed by **that field's own name**, with a string (not a list) value —
`{"appCode": "Unrecognised field for this endpoint. Each endpoint declares its own fields; …"}`.
Send exactly the declared keys and nothing else.

**Auth routes share the envelope.** The SSO's body arrives whole inside `data`. Errors carry `message` at
the top (401/429/502/503), a `code` for the two 403s (read off the top level or `data`), and the field-keyed
400 under `data`. `toAuthFailure()` reads all three.

---

## 4. Onboarding and profile

`api/v1/account/profile/` **changed meaning on 2026-09-09.** It used to serve the user row; it now
serves questionnaire answers and nothing else, and `PATCH profile/` is the only profile write. The user record is the read-only `user-details/`.

- **The onboarding and profile forms pre-fill from `GET profile/`** (read again since 2026-11-02; the
  2026-10-10 decision had dropped it). The map is joined on the `questions/` codes, so its non-answer keys
  (`email`, `phone_number`, `profile_picture`…) are ignored; a select keeps only saved values that are still
  options. `user-details/` fills `full_name` only when nothing is saved. A failed read is not fatal: the form
  renders blank with a notice, and saves.
- **Saving:** a blank is never sent (`null` is refused and there is no way to clear an answer yet), so a
  cleared optional answer comes back from the next read. A checkbox is sent when ticked or when it was saved
  `true`, so a saved "yes" can be taken back. After a save both reads reload in place and the form is no
  longer dirty.
- `GET profile/` is a **bare flat map keyed by question code** — the value is the answer itself, not
  an object describing it. `{}` is a normal empty state, not a 404. Key order is display order.
  Flattened on 2026-09-10, so `type` is no longer reported here — join `questions/` on `code`.
- `PATCH profile/` takes the **same flat map back**, so you read, edit and send without reshaping.
  Partial by definition (a code you omit keeps its value), `null` is **refused** rather than read as
  "clear", and it is idempotent, so a retry after a timeout is safe.
- The write **always succeeds**; the milestone advances only when every required, shown question of
  that form has an answer. A partial save returns `missing` naming what is outstanding —
  **`missing` being non-empty is not an error.**
- A 400 is keyed by question code, one message per bad answer. Validation runs before the transaction
  opens, so a rejected submission never partially applies.
- Then **rule 5**.

### The user record — `GET user-details/` (hyphen)

Rewritten 2026-09-24. The old `user_details/` (underscore) — a 28-field row with a PATCH writing 16
of them — was **deleted**; a client still calling it gets 404, and a PATCH on the new route is 405.

```json
{
  "first_name": "Sohan",
  "full_name": "Sohan Biswas",
  "is_onboarding_completed": true,
  "is_profile_completed": true,
  "pathway": "Yes",
  "enrolled_status": "Yes",
  "enrolled_course": [{ "course_name": "cpa", "is_enrolled": true, "is_alumni": false, "…": "…" }],
  "user_data_fully_filled": true,
  "career_counselling_booked": false,
  "has_password": false,
  "subscription_status": "Active",
  "current_subscription_details": {
    "subscription_id": "0199f3c2-…",
    "product_id": "454db30e-…",
    "plan_id": "48366a41-…",
    "plan_name": "Masterclass Annual",
    "status": "active",
    "started_at": "2026-10-01T00:00:00Z",
    "expires_at": "2027-10-01T00:00:00Z",
    "days_remaining": 337
  },
  "queued": []
}
```

- **The client binds the first four keys, `has_password` and `current_subscription_details`.** The rest were renamed or reshaped three times in a month
  (`Pathway` → `pathway` on 2026-10-05, the course list became rows and `onboarding_fully_completed` became
  `user_data_fully_filled` on 2026-10-07), and nothing in the app branches on them. `isUserDetails` checks
  exactly what `UserDetails` types, so one of those renames can no longer blank the header.
- **The subscription block** (added 2026-10-29, contract §3.2) is on every response, the degraded fallback
  included. The app reads only `current_subscription_details`: the term in force, or `null`. A cancelled term
  (`subscription_status: "Deactivate"`) is still there until `expires_at`. `AccountApi.hasSubscription` is the
  one place it is read: `true` with a term, `false` signed out or with `null`, and `null` (not known) while
  the read is loading, failed or the key is missing. Every subscription decision in the app (header crown, the
  footer's subscribe card, CPE mode, chapter locks, CPE Tracker and its "download all", badge claims, the faculty
  form) reads that signal and acts only on a known answer. It is UI only: the contract calls the block "a
  description, not an access gate", and the server keeps deciding access. A paid invoice reloads the record.
- `pathway` / `enrolled_status` are **strings**, not booleans. `"No"` means "could not confirm".
- The onboarding gate reads the **stored** `is_onboarding_completed`, not the derived
  `user_data_fully_filled`.
- There is **no email, last name, phone or city** here — those are questionnaire answers now. The
  avatar menu shows `full_name` and its initials only.
- `parseUserDetails` in `account.model.ts` checks every key at the `httpResource` boundary; a drifted
  body becomes the resource's `error()` rather than `undefined` on screen.
- `show_referral_code` **moved to `GET profile/`** on 2026-09-24. The profile page only sends codes
  of questions it rendered, so a non-answer key there is never written back.

### Other account routes (not bound yet)

| Route                                    | Shape                                                          | Why unbound                                                |
| ---------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `GET/POST name/`                         | POST body is **camelCase** and strict: `{firstName, lastName}` | No screen edits the certificate name separately yet        |
| `GET web/maintainance-status/` (public)  | `{is_maintenance, force_logout_all_user}` (backend's spelling) | Needs a UX decision on the maintenance page / force-logout |
| `GET country/`, `GET city-autocomplete/` | `{data: [...]}` / `{suggestions: ...}`                         | Nothing calls them                                         |

### Account error envelopes

Four shapes are live; `readAccountError()` in `account.model.ts` normalises them into
"messages under fields" or "one message":

| Status     | Body                                   | Rendered as                      |
| ---------- | -------------------------------------- | -------------------------------- |
| 400        | `{<question_code>: message}`           | Under that question              |
| 400 strict | `{<undeclared_key>: message}`          | Toast (no question owns the key) |
| 403        | `{detail}` (DRF, bad/expired token)    | Toast                            |
| 404 / 502  | `{message, status: "Failed"}`          | Toast                            |
| 500        | `{status: "error", message, details?}` | Toast                            |

`questions/` is server-driven: the backend decides which questions exist, in what order and with what
options. Each option is `{text, description, value}`, and `value` is a **string** (it was a one-element list
until 2026-10-09). A select's answer is still a **list** of those values, even for a single-select.
`placeholder` may be `null`. `section` is a label to group by — it does not affect ordering, and there are no screen
buckets (the legacy `Screen1`/`Screen2` keying is gone). `visibility: "both"` appears under either
`form` value.

---

## 5. How it is built here

| Concern                                 | Where                                      | Pattern                                         |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| The sign-in POSTs, token state, refresh | `core/services/auth-session/`              | `@Service()` + `ApiClient.call`                 |
| Forgot / reset, code / set              | `core/services/password-api/`              | `@Service()` + `ApiClient.call`                 |
| `user-details/`                         | `core/services/account-api/`               | `@Service()` + `httpResource`                   |
| `questions/`, `PATCH profile/`          | `core/services/onboarding-api/`            | `@Service()` + `httpResource` (+ PATCH methods) |
| Login and sign-up screen state          | `features/auth/services/auth-facade.ts`    | `@Service({autoProvided: false})`, route-scoped |
| Set-password step (`PasswordFacade`)    | `features/auth/services/`                  | `@Service({autoProvided: false})`, on `Profile` |
| Bearer + rotation                       | `core/interceptors/app/app-interceptor.ts` |                                                 |
| Route gating                            | `core/guards/auth/`                        | functional `CanMatchFn`                         |

**Commands vs reads.** Mutations go through `ApiClient.call()` against the `RouteConfig` registries
in `auth.model.ts` / `account.model.ts`; reads are `httpResource`s. This follows Angular's own
guidance: _"Avoid using `httpResource` for mutations like POST or PUT. Instead, prefer directly using
the underlying `HttpClient` APIs."_

### The four `httpResource` rules

1. **Gate on the boolean `isAuthenticated()`, never on the token string.** A request function tracks
   every signal it reads, so reading the token would re-fire every read in the app on every rotation.
   `account-api.spec.ts` asserts this, and the assertion fails if the gate is changed.
2. **Never set `Authorization` on a resource.** The interceptor attaches it — which is what keeps
   rule 1 possible.
3. **Guard `value()` with `hasValue()`.** Reading `value()` in the error state throws at runtime.
4. Returning `undefined` from the request function makes the resource **idle** and sends no request.
   That is the signed-out state, not an error.

### Token storage

Access and refresh tokens live in **first-party, JS-readable cookies** so SSR can read them out of
the request headers and render the signed-in shell. That makes them XSS-exposed — the same trade the
pre-strip design made.

The upgrade is the SSO's httpOnly `miles_sso_refresh` cookie plus `withCredentials`, which
`auth-token-refresh/` already supports (it accepts an empty body for exactly that reason). It is not
wired because the cookie's `SameSite`/`Secure` attributes could not be observed — see §6. The CORS
side is already in place: the API returns `access-control-allow-credentials: true` with a
non-wildcard origin.

### CORS

`appInterceptor` sends four headers on every non-external request:

- `X-Accept-Language`, the language from `LanguageContext`. It replaced the standard `Accept-Language`
  on 2026-10-13.
- `X-Country-Code`, upper-case ISO2 from `CountryContext`. The commerce, catalogue and plans APIs price by
  it.
- `X-Platform`, from `CLIENT_PLATFORM` in `app-interceptor.ts` (`masterclass`).
- `X-App-Type`, from `CLIENT_APP_TYPE` in `app-interceptor.ts` (`WA`).

None of the four is CORS-safelisted, so each must be listed in `Access-Control-Allow-Headers`, or the
browser blocks the request. Checked 2026-10-13:

- **UAT `uat-api.milescaira.com`:** allows `x-country-code`, `x-platform` and `x-app-type` (with
  `access-control-max-age: 86400`), but **not `x-accept-language`**. Until the backend adds it, every browser
  request fails CORS. Seen in dev: "Request header field x-accept-language is not allowed by
  Access-Control-Allow-Headers".
- **Production `api.milescaira.com`:** allows none of the four.

SSR is unaffected, because Node sends no preflight. `X-Country-Code`, `X-Platform` and `X-App-Type` were
removed on 2026-09-22, when UAT did not allow them either, and restored on 2026-10-13.

---

## 6. Open items

As of **2026-09-27**, every `auth-*` route and `user-details/` on UAT answer a gateway
`503 Service Temporarily Unavailable`, so sign-in cannot be exercised live; the Events surface
(`web-api/v1/events/`) does answer. Production 404s the whole `/api/v1/account/*` surface (not
deployed there yet).

The auth folder saves 19 example responses, **none of them a 200** — every success shape in this
document is contract prose, not a captured payload.

| #   | Item                                   | Current assumption                                                                                                                                                                                                          | Where to change it                                        |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Phone format                           | Identify: E.164, e.g. `+919876543210`. Send/verify: `mobile` + `country_code` with its `+` (UAT also accepts `91`)                                                                                                          | `AuthFacade.toContact()`, identify request in `loginForm` |
| 2   | `miles_sso_refresh` cookie attributes  | Not used; body-token path instead                                                                                                                                                                                           | `AuthSession.store()` / `doRefresh()`                     |
| 3   | OTP code length                        | 6; no route returns it. **Backend ask:** `codeLength` on otp-send                                                                                                                                                           | `AuthFacade.otpLength`                                    |
| 4   | The two 502s                           | Told apart by copy (`/new code/i`). **Backend ask:** a `code` field                                                                                                                                                         | `toAuthFailure()` in `auth.model.ts`                      |
| 5   | Email for the account menu             | Not shown. **Backend ask:** `email` on `user-details/`                                                                                                                                                                      | `UserAvatarMenu`                                          |
| 6   | Does a name answer update `full_name`? | **No** (live UAT, 2026-10-10): after `PATCH profile/` saves `full_name`, `user-details/` still answers `null`, so the avatar shows "U". **Backend ask:** write the answer to the row, or the client also calls `POST name/` | `Profile.save()`                                          |
| 7   | `communication` on send / verify       | Optional, example `"dev"`, undocumented. Never sent. Postman still shows the old `identifier` + `phone_number` bodies; UAT is the source (2026-10-12)                                                                       | `AuthFacade.toContact()`, `toOtpContact()`                |

When a real token is obtainable, capture `identify`, `otp-send`, `otp-verify`, `user-details/` and
`questions/` into `docs/contracts/` and tighten the items above.

---

## 7. Passwords

Added to the contract on 2026-10-28 (§2.6–2.10 of the collection): five routes onto the Miles SSO's password
API, all under `api/v1/account/`. The SSO owns every rule — lockouts, the policy, who may hold a password at
all — and forwards its status, `code` and `message` unmodified. Show `message` as-is; branch on `code`.

| Route                        | Auth   | Body                                                   | 2xx                                                                               | Errors                                                                                                                                                                |
| ---------------------------- | ------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST auth-password-login/`  | none   | `{identifier, password}`                               | 200: the same session as `auth-otp-verify/`                                       | 400; **401 "Invalid credentials"** for an unknown account and a wrong password alike; **429** after 5 failures in 15 minutes, locking password sign-in only; 502; 503 |
| `POST auth-password-forgot/` | none   | `{identifier}`, an email                               | **always 202** with one fixed message, `data: null`                               | 400 (not an email); 502; 503                                                                                                                                          |
| `POST auth-password-reset/`  | none   | `{token}`                                              | 200 `{username, password}`: a six-digit PIN, shown once; every session signed out | 400, one fixed message for an invalid, expired, used or ineligible link; 429; 502; 503                                                                                |
| `POST password-code/`        | bearer | none                                                   | 202 `{maskedEmail, cooldownSeconds, reused?, validForSeconds?}`                   | 403 with a `code`; 429 with `data.retryAfterSeconds`                                                                                                                  |
| `POST password/`             | bearer | `{newPassword}`, plus `emailCode` or `currentPassword` | 200 `{signedOutOtherSessions, signedOut}`                                         | 400 `password_policy` / `verification_required`; 401 `email_code_incorrect` / `current_password_incorrect`; 403 with a `code`; 429; 503                               |

The 403 codes are `lms_managed`, `organisation_managed`, `email_required`, `email_not_confirmed`,
`account_inactive` and `not_available`: this account cannot hold a password here. A new password is 8 to 72
**bytes** with a letter and a number; the sign-in floor is 6 characters. `password-code/` and `password/` are
bound by onboarding's set-password step (below); the profile's change flow reuses them.

**Client rules**

- **Password sign-in mints a session**, so it is in `AUTH_ROUTES` and, by derivation, in
  `SESSION_MINTING_PATHS`: no bearer, no refresh first. `AuthSession.loginWithPassword()` stores it exactly as
  `verifyOtp()` does, `isSessionResponse` included. The other routes live in `PASSWORD_ROUTES`
  (`core/models/password.model.ts`).
- **No identify first.** For an email, `auth-identify/` always offers `password` and answers the same for known
  and unknown accounts, so it would add a round trip and tell the password form nothing.
- **Passwords, PINs, reset tokens and codes** are never logged, cached, or kept in a URL, storage or a persisted
  form state. A password is a JSON string sent exactly as typed: never trimmed, never a number.
- **The login page validates on submit**, not by disabling Log in: Chrome withholds autofilled values from script
  until the page is interacted with, so a button gated on validity can sit dead over filled fields.
- **A password 429 offers a code instead**, because the lock never covers code sign-in. No countdown: the 429 can
  also be a shared upstream limit, so a duration would be a guess.
- **Forgot** (`/auth/forgot-password`): only the 202 shows "Check your email", and it is the same for every
  account. A 400, 502, 503 or a dropped connection means nothing was sent, so the form stays with the reason.
  The old `/auth/forget-password` redirects there permanently (`src/legacy-redirects.ts`).
- **Reset** (`/auth/password/reset#token=…`): the token rides in the fragment, which never reaches a server. The
  page reads it, rewrites the address bar without it, and calls the route only when the learner clicks — a
  redeemed link is spent even when the response is lost, and mail scanners open links first. On 200 the local
  session is cleared, since the SSO has signed the account out everywhere.
- **Forgot and reset send no bearer** (`SKIP_AUTH_TOKEN`). Both are `AllowAny`, but DRF authenticates before it
  checks permissions, so a stale token in the cookies would turn a valid link into a 401.
- **`has_password`** on `user-details/` is `true` after a password sign-in or `password/`, and is never reset.
  `false` can be wrong (a reset PIN, or a password set in another Miles app, doesn't set it), so it offers "Set a
  password" and never says the learner has none. It is optional in `UserDetails`: absent reads as "may not have
  one".
- **Set-password step** (`/auth/profile`, onboarding only): offered unless `has_password` is `true`, and
  skippable; a failed `user-details/` read skips it rather than hold onboarding up. `PasswordFacade` is provided
  on the `Profile` component, so the typed password dies with the page. `password/` goes with `newPassword`
  alone first (a first password is allowed within 15 minutes of a code sign-in, once); on
  `verification_required` the step emails a code at once (`password-code/`, no body) and sends
  `{newPassword, emailCode}`. The code is the email sign-in code, so it uses the login's code boxes.
- **A 401 with a `code` is a wrong proof**: keep the form. Only a 401 with no `code` ends the session (local
  sign-out, then `/auth/login` keeping `redirect`). `signedOut: true` on a 200 does the same, with a "log in with
  your new password" toast.
- **The six 403 codes** replace the step with "Password not available", the server's message and Continue (in
  the profile, the section shows only the message). Any other 403 stays a retryable error.
- **Profile Password section** (profile mode, once `user-details/` has loaded): "Change password" sends
  `{newPassword, currentPassword}` when `has_password` is `true`, otherwise "Set a password" goes as onboarding
  does. "Forgot your current password?" switches the proof to the emailed code. `current_password_incorrect`
  keeps the form; a 200 toasts (with "Other devices were signed out." when `signedOutOtherSessions`) and reloads
  `user-details/`. A session that ends here returns to `/auth/profile` after sign-in.
- **429:** `password-code/` gives `retryAfterSeconds` and Resend waits it out; `password/` gives no duration, so
  Set password waits an estimated 60 seconds. Skip stays enabled through both.
- **503 "The password could not be set"** spent the emailed code: the code is cleared and Set password waits for a
  new one.

**Open with the backend**

1. The saved 200 example of `auth-password-login/` shows only the token keys. If the live body lacks
   `profile_status` and `is_test_user`, `isSessionResponse` refuses it and the learner sees "Something went
   wrong". Confirm on UAT.
2. The reset email must link to this app's `/auth/password/reset#token=…` (the fragment, not a query string).
