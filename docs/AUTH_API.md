# Authentication — MilesCAIRA Accounts v1

How this app signs a learner in, and the rules the backend imposes on it.

**Contract source:** the Postman collection in `postman/Merged Masterclass Backend - All APIs/`
(a YAML tree, one file per request), folders `01. Authentication and Session` and
`02. Account, Profile and Reference Content`. Each request's description quotes
`ACCOUNTS_API_CONTRACT_V1.md` verbatim, and its `.resources/<request>.resources/examples/` holds one
saved response per documented status. The collection is generated backend-side and marked
do-not-hand-edit — treat it as the source of truth and this file as the frontend's reading of it.

Re-audited against the collection on 2026-09-27 (MIL-5 auth fixes, MIL-6 profile rebind), and again on
2026-10-10 when the backend enveloped every response (see "The envelope" below).

**The envelope.** Since 2026-10-10 every body, success and error alike, on every route is
`{success, message, data}` (verified live on UAT). Everything this document calls "the body" or "the 200" is
`data`. The client unwraps it at the service: `AuthSession` (`.pipe(map((res) => res.data))`), `AccountApi`
and `OnboardingApi` (`parse`). Error details move too: a field-keyed 400 is `data: {<field>: message}`, and
`message` is lifted to the top.

| Environment | `BASE_API_URL`                    |
| ----------- | --------------------------------- |
| production  | `https://api.milescaira.com/`     |
| UAT / local | `https://uat-api.milescaira.com/` |

---

## 1. The routes

All under `{BASE_API_URL}api/v1/account/`. Every path has a trailing slash; omitting it 404s.

### Sign-in — no auth, `AllowAny`

| Route                      | Body                           | 200                                                         |
| -------------------------- | ------------------------------ | ----------------------------------------------------------- |
| `POST auth-identify/`      | `{identifier}`                 | `{methods, defaultMethod, communicationId, …masks}`         |
| `POST auth-otp-send/`      | `{identifier}`                 | `{channel, cooldownSeconds}`                                |
| `POST auth-otp-verify/`    | `{identifier, code}`           | `{accessToken, refreshToken, profile_status, is_test_user}` |
| `POST auth-token-refresh/` | `{refreshToken}` _or_ `{}`     | same four keys, **rotated**                                 |
| `POST auth-logout/`        | _(none — bearer **required**)_ | 2xx; 401 without a bearer                                   |

`identifier` is an email, phone number or username — the SSO works out which. `appCode` is **not**
accepted from the client; it is added server-side, because it names which application is asking and
a caller must not be able to claim to be another one.

### Account — JWT, `IsAuthenticated`

| Route                                     | Notes                                                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET user-details/`                       | 8 routing fields (names, milestones, `Pathway`, enrolment). **GET only** — the old `user_details/` row and its PATCH were deleted 2026-09-24. |
| `GET questions/?form=onboarding\|profile` | `{Questions: [...]}`, flat, sorted by `display_order`.                                                                                        |
| `GET/PATCH profile/?form=…`               | Questionnaire answers **only**. See §4. The app writes (`PATCH`) but does **not read** it — the form pre-fills from `user-details/` only.     |
| `GET web/maintainance-status/`            | Public. `{is_maintenance, force_logout_all_user}`. Not bound yet — the old `web/app-status/` had no reader and was removed.                   |

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

Logout is the one auth route that needs `Authorization: Bearer`, so the interceptor's skip list
(`SESSION_MINTING_PATHS`) holds only the other four. Refresh clears the session **only on 401**;
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

- **This app does not call `GET profile/`** (product decision 2026-10-10). The onboarding and profile
  forms pre-fill from `user-details/`, which carries the name and nothing else, so a saved answer does not
  show when the learner returns. To keep a save from erasing what it cannot see, the form never sends a
  blank and sends a checkbox only when it is ticked (a saved "yes" cannot be taken back from the form).
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
  "career_counselling_booked": false
}
```

- **The client binds only the first four keys.** The rest were renamed or reshaped three times in a month
  (`Pathway` → `pathway` on 2026-10-05, the course list became rows and `onboarding_fully_completed` became
  `user_data_fully_filled` on 2026-10-07), and nothing in the app branches on them. `isUserDetails` checks
  exactly what `UserDetails` types, so one of those renames can no longer blank the header.
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

| Concern                                      | Where                                      | Pattern                                         |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| The five sign-in POSTs, token state, refresh | `core/services/auth-session/`              | `@Service()` + `ApiClient.call`                 |
| `user-details/`                              | `core/services/account-api/`               | `@Service()` + `httpResource`                   |
| `questions/`, `PATCH profile/`               | `core/services/onboarding-api/`            | `@Service()` + `httpResource` (+ PATCH methods) |
| Login screen state                           | `features/auth/services/auth-facade.ts`    | `@Service({autoProvided: false})`, route-scoped |
| Bearer + rotation                            | `core/interceptors/app/app-interceptor.ts` |                                                 |
| Route gating                                 | `core/guards/auth/`                        | functional `CanMatchFn`                         |

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

`x-app-type`, `x-platform` and `x-country-code` used to go on every request. They are **gone**.
MilesCAIRA's `Access-Control-Allow-Headers` lists none of the three, so every preflighted request
carrying them fails CORS — and the API reads none of them anyway. The allowed set is:

```
content-type, authorization, x-csrftoken, x-requested-with, Access-Control-Allow-Origin,
X_LMS_OPEN_API_KEY (+ casings), x_enrollment_form_vendor_token (+ casings),
X_VENDOR_TOKEN, x_vendor_token, skip
```

---

## 6. Open items

As of **2026-09-27**, every `auth-*` route and `user-details/` on UAT answer a gateway
`503 Service Temporarily Unavailable`, so sign-in cannot be exercised live; the Events surface
(`web-api/v1/events/`) does answer. Production 404s the whole `/api/v1/account/*` surface (not
deployed there yet).

The auth folder saves 19 example responses, **none of them a 200** — every success shape in this
document is contract prose, not a captured payload.

| #   | Item                                                                        | Current assumption                                                                                                                                                                                                          | Where to change it                    |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | Phone identifier format                                                     | E.164 — `country_code + phone`, e.g. `+919876543210`                                                                                                                                                                        | `AuthFacade.toIdentifier()`, one line |
| 2   | `miles_sso_refresh` cookie attributes                                       | Not used; body-token path instead                                                                                                                                                                                           | `AuthSession.store()` / `doRefresh()` |
| 3   | OTP code length                                                             | 6; no route returns it. **Backend ask:** `codeLength` on otp-send                                                                                                                                                           | `AuthFacade.otpLength`                |
| 4   | The two 502s                                                                | Told apart by copy (`/new code/i`). **Backend ask:** a `code` field                                                                                                                                                         | `toAuthFailure()` in `auth.model.ts`  |
| 5   | Email for the account menu                                                  | Not shown. **Backend ask:** `email` on `user-details/`                                                                                                                                                                      | `UserAvatarMenu`                      |
| 6   | Does a name answer update `full_name`?                                      | **No** (live UAT, 2026-10-10): after `PATCH profile/` saves `full_name`, `user-details/` still answers `null`, so the avatar shows "U". **Backend ask:** write the answer to the row, or the client also calls `POST name/` | `Profile.save()`                      |
| 7   | `country_code` / `phone_number` / `communication` on identify, send, verify | Declared by the serializers, undocumented. Not sent; `identifier` alone, as the contract's example                                                                                                                          | `AuthFacade.toIdentifier()`           |

When a real token is obtainable, capture `identify`, `otp-send`, `otp-verify`, `user-details/` and
`questions/` into `docs/contracts/` and tighten the items above.

---

## 7. Password sign-in is not available, and that is a backend gap

`auth-identify/` legitimately answers `password` in `methods`, and the Miles SSO implements
`POST /auth/password/login` (`{identifier, password}`; password 8-128 chars; always
`401 Invalid credentials` on failure, never distinguishing a missing account from a wrong password).

**The MilesCAIRA backend does not proxy it.** It proxies five auth routes — identify, otp-send,
otp-verify, token-refresh, logout — and password login is not among them. The gap is visible in the
backend's own settings: `DEFAULT_THROTTLE_RATES` reserves a `web_login_password` scope at 10/min
which the contract records as declared on _"nothing in this repository"_.

So this client offers **OTP only**: it sends a code whenever `methods` contains any `*_otp` method,
and treats an account with none as enterprise SSO. That degrades safely: every documented identifier
kind also carries an OTP method — email → `email_otp`, phone → `phone_otp`, username → `email_otp` —
so sign-in works in all of them.

**The backend ask is one route:** `POST api/v1/account/auth-password-login/` proxying
`POST /auth/password/login` and returning the same session body as `auth-otp-verify/` (including the
merged `profile_status` and `is_test_user`). When it lands, add it to `AUTH_ROUTES` (it mints a
session, so it belongs in `SESSION_MINTING_PATHS` too) and render the password field for accounts
whose `defaultMethod` is `password`.
