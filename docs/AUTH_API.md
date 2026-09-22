# Authentication — MilesCAIRA Accounts v1

How this app signs a learner in, and the rules the backend imposes on it.

**Contract source:** the request descriptions inside
`Postman Collection/Merged_Masterclass_Backend_All_APIs.postman_collection.json`, which quote
`ACCOUNTS_API_CONTRACT_V1.md` verbatim. That collection is generated
(`Miscellaneous/Scripts/generate_postman_collection.py`) and marked do-not-hand-edit — treat it as
the source of truth and this file as the frontend's reading of it.

| Environment | `BASE_API_URL`                    |
| ----------- | --------------------------------- |
| production  | `https://api.milescaira.com/`     |
| UAT / local | `https://uat-api.milescaira.com/` |

---

## 1. The routes

All under `{BASE_API_URL}api/v1/account/`. Every path has a trailing slash; omitting it 404s.

### Sign-in — no auth, `AllowAny`

| Route                      | Body                          | 200                                                         |
| -------------------------- | ----------------------------- | ----------------------------------------------------------- |
| `POST auth-identify/`      | `{identifier}`                | `{methods, defaultMethod, communicationId, …masks}`         |
| `POST auth-otp-send/`      | `{identifier}`                | `{channel, cooldownSeconds}`                                |
| `POST auth-otp-verify/`    | `{identifier, code}`          | `{accessToken, refreshToken, profile_status, is_test_user}` |
| `POST auth-token-refresh/` | `{refreshToken}` _or_ `{}`    | same four keys, **rotated**                                 |
| `POST auth-logout/`        | _(none — bearer header only)_ | 2xx                                                         |

`identifier` is an email, phone number or username — the SSO works out which. `appCode` is **not**
accepted from the client; it is added server-side, because it names which application is asking and
a caller must not be able to claim to be another one.

### Account — JWT, `IsAuthenticated`

| Route                                     | Notes                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `GET/PATCH user_details/`                 | The user row, 28 fields. **No id in the path** — always the caller's.       |
| `GET questions/?form=onboarding\|profile` | `{Questions: [...]}`, flat, sorted by `display_order`.                      |
| `GET/PATCH profile/?form=…`               | Questionnaire answers **only**. See §4.                                     |
| `GET web/app-status/`                     | `{is_maintenance, is_web_maintenance, is_pathway, is_onboarding_completed}` |

---

## 2. The five rules

Each of these is a bug if ignored, and each has a test that fails if it regresses.

### Rule 1 — a bad or expired token answers **403**, not 401

DRF downgrades an authentication failure to 403 when the authenticator does not implement
`authenticate_header()`, and this one does not. The usual reading — 401 means signed out, 403 means
not allowed — is **exactly inverted** on this API.

Genuine 401s exist but only from routes that check the caller inside the handler:
`privacy-policy/`, `terms-and-conditions/`, the QR routes, and the `auth-*` routes themselves.

_Verified live against UAT on 2026-09-22: `user_details/`, `questions/`, `profile/` and
`web/app-status/` all answer 403 with no token._

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

`onboardingGuard` branches on `profile_status`, and `onboarding.guard.spec.ts` asserts that exactly
one status redirects.

### Rule 5 — after `PATCH profile/` advances the milestone, **refresh the token before anything else**

The claim is minted _into_ the token, so completing the profile and not refreshing re-reads a stale
value and bounces the user straight back into the onboarding they just finished. The contract calls
this "the single most common integration bug on this surface."

The sequence is: verify → `profile_status: "new_user"` → complete the profile → **refresh** → go.

---

## 3. Sign-in, end to end

1. **`auth-identify/`** — the first call of any login, always. It reports which methods this
   identifier can use.
   - **Render `methods`; do not assume a form.** When enterprise SSO ships, this same endpoint starts
     answering `saml` with a redirect. A client that renders the list needs no change.
   - **Do not build a "no such account" message from this response.** An identifier the SSO has never
     seen returns the same `methods`, `defaultMethod` and masks as a known one — the masks are built
     from what was typed, not from anything stored. `communicationId` is `null` for an unknown
     identifier and is the only existence signal, which is why this route is first-party only and the
     most tightly throttled of the five at 20/min.
2. **`auth-otp-send/`** — sends the code.
   - **Write UI copy from the returned `channel`**, never from what was sent. It is `email`, `sms` or
     `whatsapp`, and phone routing is a table at the SSO that changes with no deploy on either side.
     As of 2026-09-08 **every country resolves to `sms`, India included.**
   - `cooldownSeconds` is how long the resend button stays disabled. Read it; do not hardcode one.
   - `channel` is **not an accepted input** — sending it is a 400.
   - A **503 means nothing was sent and nothing will be.** Advance the user to a retry, never to a
     code-entry screen. It says our mailer is broken; it never says anything about the account.
3. **`auth-otp-verify/`** — exchanges the code for a session. `code` is a string and its length is
   **not** validated client-side; the length is set server-side at the SSO.
4. Route on `profile_status`: `new_user` → `/auth/profile`, otherwise the `redirect` param or `/`.

### Failure modes, and the UI each one wants

| HTTP | Body                            | Meaning                                           | Do                                                       |
| ---- | ------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| 400  | field-keyed map                 | Malformed input; the SSO's copy is learner-facing | Render it verbatim, against the field                    |
| 401  | SSO's                           | Wrong or expired code                             | Let them retype                                          |
| 429  | SSO's                           | Identifier locked                                 | Show the lockout, **do not retry**                       |
| 403  | `{code: "account_blocked"}`     | Partner-imposed block                             | **Terminal.** Permission message, point at Miles support |
| 403  | `{code: "account_deactivated"}` | Miles deactivation                                | **Terminal.** Same, different team                       |
| 502  | `{message: …}`                  | Provisioning failed after a valid token           | **Retryable** — the code is spent, send for a new one    |
| 503  | `{message: …}`                  | Our configuration fault                           | Not the user's problem                                   |

The two 403s are deliberately distinct: `active` and `is_blocked` are separate columns set by
different people for different reasons, and telling a blocked learner their account is "deactivated"
sends them to the wrong team. `toAuthFailure()` in `auth.model.ts` is the only place that knows this
mapping.

**Unknown fields are rejected.** Verified live: posting an undeclared field returns 400 with a
field-keyed body (`{"code": "Unrecognised field for this endpoint. …"}`). Send exactly the declared
keys and nothing else.

---

## 4. Onboarding and profile

`api/v1/account/profile/` **changed meaning on 2026-09-09.** It used to serve the user row; it now
serves questionnaire answers and nothing else. The user row is `user_details/`.

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

`questions/` is server-driven: the backend decides which questions exist, in what order and with what
options. `section` is a label to group by — it does not affect ordering, and there are no screen
buckets (the legacy `Screen1`/`Screen2` keying is gone). `visibility: "both"` appears under either
`form` value.

---

## 5. How it is built here

| Concern                                      | Where                                      | Pattern                                         |
| -------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| The five sign-in POSTs, token state, refresh | `core/services/auth-session/`              | `@Service()` + `ApiClient.call`                 |
| `user_details/`, `web/app-status/`           | `core/services/account-api/`               | `@Service()` + `httpResource`                   |
| `questions/`, `profile/`                     | `core/services/onboarding-api/`            | `@Service()` + `httpResource` (+ PATCH methods) |
| Login screen state                           | `auth/shared/services/auth-facade.ts`      | `@Service({autoProvided: false})`, route-scoped |
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

Three things could not be verified because **every `auth-*` route on UAT answers
`503 {"message": "Sign-in is not configured on this environment."}` as of 2026-09-22**, and
production 404s the whole `/api/v1/account/*` surface (not deployed there yet).

| #   | Item                                  | Current assumption                                                       | Where to change it                    |
| --- | ------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| 1   | Phone identifier format               | E.164 — `country_code + phone`, e.g. `+919876543210`                     | `AuthFacade.toIdentifier()`, one line |
| 2   | `miles_sso_refresh` cookie attributes | Not used; body-token path instead                                        | `AuthSession.store()` / `doRefresh()` |
| 3   | The `Question.type` vocabulary        | Control chosen from `options.length` first, `type` string only to refine | `Profile.controlOf()`                 |

The collection ships **zero saved example responses**, so every response shape in this document is
documentation prose rather than a captured payload. When a real token is obtainable, capture
`identify`, `otp-send`, `otp-verify` and `questions/` into `docs/contracts/` and tighten the three
items above.
