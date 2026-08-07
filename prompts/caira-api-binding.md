# CAIRA Web API binding — P1 transport core, P2 auth

> Implementation prompt. The programme plan this belongs to covers P0–P9; this file covers **P1 and
> P2**. Later phases each get their own `prompts/caira-api-<phase>.md` before implementation.

## Goal

Rebuild the HTTP transport layer that `241ce4f` deleted, targeting the CAIRA Web API, with every
failure classified at the boundary so that business states never surface as error toasts (P1), then
rebind sign-in, the user profile and the completeness guard on top of it (P2).

## What it read

- Skills: `angular-conventions`, `core-services`, `auth-module`, `routing-and-guards`, `tech-stack`,
  `masterclass`, `assessments`, `cpe-tracker`, `supabase`
- `AGENTS.md` (§3 layering, §5 envelopes, §6 contracts, §7 security, §9 gates), `prompts/README.md`
- `CAIRA_Web_API_Reference.md` — all 50 endpoints, §0 conventions, and the 55-item defect appendix
- Deleted code recovered from git: `git show 241ce4f~1:` for `api-client.ts`, `http.model.ts`,
  `app-interceptor.ts`, `auth-interceptor.ts`, `auth.ts`, `environment.ts`, and
  `prompts/caira-api-rebind.md` (the superseded programme plan)
- `src/app/app.config.ts`, `src/environments/*.ts`, `src/app/shared/core/services/{auth,storage,logger,notification,loading}/`
- The 153 `ponytail:` markers across 92 files, and the placeholder literals in
  `masterclass.ts`, `masterclass-course.ts`, `cpe-tracker.ts`, `login.ts`
- Design-system contracts: `cards/**` input signatures, `badge-card.model.ts`,
  `cpe-tracker/shared/mappers/report-to-table.ts`

## Assumptions

Every assumption below was **verified against live UAT** on 2026-08-07; captures are in
`docs/caira-contracts/`.

1. **Hosts** — prod `https://api.milescaira.com`, UAT `https://uat-api.milescaira.com`. Both return
   200 on `Top_Section/`. Local dev points at UAT. ✅ confirmed
2. **No `/api/` prefix.** Routes are registered at the Django URLconf root, unlike the old
   `api.milesmasterclass.com/api/`. The trailing slash on `BASE_API_URL` supplies the separator.
   ✅ confirmed
3. **Only `Authorization` is read.** UAT's `access-control-allow-headers` lists `content-type` and
   `authorization` but **not** `x-app-type` / `x-platform` / `x-country-code`. Had those been kept,
   the browser would have rejected every request. ✅ confirmed — dropping them was required
4. **Auth failures arrive as 403, not 401.** Verified for all three modes: no credentials
   (`"Authentication credentials were not provided."`), undecodable token
   (`"Error decoding signature."`), malformed header
   (`"Invalid token header. No credentials provided."`). All 403, all DRF `{detail}`.
   ✅ confirmed — this is what `authInterceptor` rests on
5. **A non-canonical UUID path param returns 404 `text/html`**, not the JSON envelope — Django's URL
   converter rejects it before the view runs. `cairaError` handles a string body. ✅ confirmed
6. **No runtime response validation** (owner decision). TS interfaces and defaults only. Request-side
   validation is not covered by that waiver and stays.
7. **`@Service`, not `@Injectable`** — [ADR-0001](../docs/adr/0001-service-decorator.md).
8. **No external state store** — [ADR-0002](../docs/adr/0002-no-external-store.md). NgRx SignalStore
   was evaluated and rejected; `AGENTS.md:94` stands.

## Files that will change

| File                                                          | Create / Modify | Why                                                                    |
| ------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| `src/app/shared/core/models/caira/envelope.model.ts`          | Create          | Six success envelopes, `CairaFailure`, the three `HttpContext` flags   |
| `src/app/shared/core/http/caira-error.ts`                     | Create          | `cairaError()` — the only place that knows all five error vocabularies |
| `src/app/shared/core/http/caira-error.spec.ts`                | Create          | One case per documented error body                                     |
| `src/app/shared/core/http/caira.endpoints.ts`                 | Create          | All 50 paths; `isPublicCairaRoute` / `shouldAttachToken`               |
| `src/app/shared/core/http/caira.endpoints.spec.ts`            | Create          | Token scoping, trailing slashes, id types                              |
| `src/app/shared/core/services/api-client/api-client.ts`       | Create          | Restored; URL resolution + six verbs                                   |
| `src/app/shared/core/interceptors/app/app-interceptor.ts`     | Create          | Loading bar + `Authorization`, minus the three `x-*` headers           |
| `src/app/shared/core/interceptors/auth/auth-interceptor.ts`   | Create          | Single-flight refresh on an **expired** token                          |
| `src/app/shared/core/interceptors/error/error-interceptor.ts` | Create          | Classify; toast only `unexpected`                                      |
| `src/app/app.config.ts`                                       | Modify          | `withInterceptors([app, error, auth])`                                 |
| `src/app/shared/core/services/auth/auth.ts`                   | Modify          | Real `refreshToken()`; `fetchMyProfile` still stubbed for P2           |
| `src/environments/environment{,.development,.local}.ts`       | Modify          | Re-add `BASE_API_URL`                                                  |

## Implementation requirements

### Error classification

`cairaError(err) → CairaFailure`, a five-case discriminated union. Branch order matters because the
discriminators overlap:

1. `errors[]` present → `validation` (pydantic)
2. `reason` present → **`domain`** — the branch that keeps `chapter_locked`, `cool_off_active`,
   `already_started_via_7dc` out of the toast bucket. Sibling keys survive in `extra`, so the
   cool-off countdown can read `cool_off_minutes_remaining`.
3. `code` present → the `web/*` login routes. Their **401 is a wrong password**, so it maps to
   `domain`, never `auth` — otherwise a failed login fires a refresh and clears a session the user
   is still trying to create.
4. `detail` present → `auth` on 401/403, `notFound` on 404, `domain` on 429, `validation` on 400.
   Branch on status, not on the key: #31 uses `detail` for a 400 and #45 for a 404.
5. `message` **and** `error` both present → `unexpected`. This is a flattened server fault;
   `all_webinars_web` and `badges_catalog` return it as 400, not 500.
6. `error` alone → QR and mobile routes. 401/409/429 are `domain` (`attempts_remaining` into `extra`).
7. `message` alone → `notFound` / `validation` / `unexpected` by status.
8. DRF field-keyed dict → `validation`.

`isRefreshable()` is narrower than `kind === 'auth'`: only an _expired_ token. A malformed header or
unknown user is not fixed by a new token.

`userMessage()` never echoes the server text for `unexpected` — several 500 handlers return
`str(exc)` verbatim. The raw string goes to `Logger` only.

### Interceptor chain — `[appInterceptor, errorInterceptor, authInterceptor]`

Order is load-bearing. Requests run top-down, errors unwind bottom-up, so `errorInterceptor` must sit
**above** `authInterceptor`: otherwise a request that a token refresh rescues still toasts.

- `appInterceptor` — `loading.start()` / `finalize(stop)`; attaches `Bearer` **only** when
  `shouldAttachToken()` says so. That is an allowlist on `BASE_API_URL`, not an opt-out: the old rule
  would have sent a CAIRA token to WordPress or S3 the moment someone forgot `SKIP_AUTH_TOKEN`.
- `authInterceptor` — single-flight refresh. Concurrent 403s queue on `accessTokenSubject` rather
  than firing N refreshes. Loop guard is the `SKIP_AUTH_REFRESH` context flag, **not** a URL
  substring: the old `req.url.includes('refresh_token')` stopped matching when the path became
  `refresh`, silently disabling it.
- `errorInterceptor` — logs every failure with its `kind`; toasts only `unexpected`, and only when
  `SKIP_ERROR_NOTIFICATION` is unset. Always re-throws unchanged so facades can re-classify.

### `Auth.refreshToken()`

`POST refresh` with the token in the **body** — the only auth call that works that way. The response
is documented as fully opaque (the view forwards the SSO's JSON and reads none of it), so
`extractAccessToken` tries the shapes the sibling login endpoints use and treats a miss as a failed
refresh. Collapse it to one path once P0 captures the real response.

## P2 — auth

### The Email tab is now email + password

The plan left this open; the backend closes it. **CAIRA has no email-OTP route** — `otp/generate` /
`otp/validate` verify an address _after_ login, they are not a login path. So the Email tab binds to
#33 (email + password) and signs in in one step, while the Mobile tab keeps the #34 → #35 OTP flow.
The submit label follows: "Log In" on Email, "Send OTP" on Mobile. The design anticipated this — the
template already carried a commented-out "Signup with password" button.

### Two flags that look usable and are not

- **`onboarding` from a login response.** `_finalize_login` sets it to a hardcoded literal `true` on
  #33, so binding `isExistingUserGuard` to it would wave every incomplete profile straight through.
  `Auth.isProfileComplete` derives from `v2/status`'s real column values instead — the same condition
  the mobile `verify-otp` computes server-side (`first_name && name && email`).
- **`refresh_token` on #35.** #33's documented response includes it; #35's does not. Read
  defensively; an absent one just means the session ends with the access token.

### Failures the login form must not toast

`INVALID_CREDENTIALS` (401), `PROFILE_INCOMPLETE` (403) and `MULTIPLE_ACCOUNTS` (409) all classify as
`kind: 'domain'`, render inline, and never reach the refresh path. The 401 case matters most: a wrong
password is not an expired token, and treating it as one would fire a pointless refresh and clear a
session the user is still trying to create.

### `CairaUser` replaced the old snake_case `User`

Typing `Auth.currentUser` surfaced ~35 consumers of the deleted Django shape across 13 files. Most
were renames (`first_name`→`firstName`, `mobile`→`phone`, `country_code`→`countryCode`); the rest
read fields CAIRA does not have and are recorded in `docs/CAIRA_GAPS.md`:
`is_beta_access`, `is_existing_user`, `is_profile_completed`, `sector`, `job_role`, `company`,
`state_board_name`.

### Profile

`v2/status` reads; `v2/update` writes. **Seven of the thirteen form fields have no counterpart** and
are excluded from the request body rather than sent and silently dropped — `location` maps to `city`,
and phone/country code are not writable here at all (the SSO owns them). #43 returns **200 even when
the email was rejected**, with an `email_verification` key explaining why, so a blanket success
message would be a lie; that case gets its own copy. The canonical post-save read is a fresh
`v2/status`, not #43's body, whose `data` has 18 keys to #42's 19.

## Security requirements

- The token is attached by allowlist on `BASE_API_URL` — never to WordPress, S3, CloudFront,
  Supabase or Credly. Covered by a test.
- `#39`/`#40` (the unprefixed mobile OTP routes) are **absent from the registry**: #39 returns the
  generated OTP to any anonymous caller for any phone number with no throttle. A test asserts they
  are not present.
- `caira/*_lms` and `devops_api/*` are never callable from the browser — they authenticate with a
  shared API key.
- No hand-attached `Authorization` header anywhere; the interceptor is the only writer.
- 500 bodies can contain raw exception text. It reaches `Logger`, never a toast.
- Query strings are stripped from log lines — they can carry ids and emails.

## Acceptance criteria

- [x] `pnpm build:prod` is green
- [x] `pnpm lint` passes with no new errors
- [x] `cairaError` has a test per documented error body, including the 403-is-auth case and the
      QR-401-is-not-auth case
- [x] The token-scoping rule has a test proving no off-origin leak
- [x] SSR renders `/us/cpa/masterclass` with correct `<title>` and canonical
- [x] **P0:** prod + UAT hosts confirmed and substituted
- [x] **P0:** CORS verified — `authorization` allowlisted, the three `x-*` headers are not
- [x] **P0:** the 403-not-401 auth contract verified live for all three failure modes
- [x] **P0:** #1 and #2 captured and matching the reference exactly (`docs/caira-contracts/`)
- [x] **P2:** a wrong password renders inline and raises no toast — verified live against
      `api.milescaira.com`, logged as `→ domain {status: 401, reason: INVALID_CREDENTIALS}`
- [x] **P2:** the Email tab renders a password field and a "Log In" label; Mobile keeps "Send OTP"
- [x] **P2:** `Auth.currentUser` is typed `CairaUser`; no consumer reads a Django field name
- [ ] **P0:** capture the three shapes the reference leaves out of scope — needs a UAT token.
      Blocks P4/P5, not P1/P2: `CAIRAMasterclassQuizQuestionSerializer`,
      `CAIRAMasterclassFeedbackQuestionSerializer`, `_build_full_course_progress`
- [ ] **P0:** QR crypto contract — blocks P8 only
- [ ] **P2:** the phone OTP round trip. Not exercised — #34 sends a **real SMS**, so it needs a test
      number rather than a fabricated one. Confirm the `session_id` replay and whether #35 returns a
      `refresh_token`.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm test
pnpm build:prod
```

Routes and server code are in play, so also:

```bash
pnpm build && pnpm serve:ssr:miles-masterclass-v3
```

> `pnpm test` currently fails to compile on five pre-existing broken specs unrelated to this work
> (`course-chapter-list`, `notification` ×2, `slider`, `toast` — wrong or missing exports). They are
> present on `master`. Until they are fixed the P1 suites run directly:
>
> ```bash
> npx vitest run src/app/shared/core/http/ --globals --environment node
> ```

## How to verify it

1. `pnpm build && PORT=4321 node dist/miles-masterclass-v3/server/server.mjs`
2. `curl -sL http://localhost:4321/us/cpa/masterclass | grep -E '<title>|canonical'` → both present.
3. `curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/blog-test` → `200`. Proves the
   WordPress path still works now that it passes through `appInterceptor`.
4. `npx vitest run src/app/shared/core/http/ --globals --environment node` → all green.

Contract checks against live UAT (no token needed):

```bash
API=https://uat-api.milescaira.com
# 200, and the documented 3 top-level / 8 item keys
curl -s "$API/CAIRA_LMS_Masterclass_MilesOne_Web/Top_Section/?limit=2" | python3 -m json.tool
# 403 + {"detail":…} — NOT 401. The assumption authInterceptor rests on.
curl -s -w '\n%{http_code}\n' "$API/CAIRA_LMS_Masterclass_MilesOne_Web/caira/levels_progress/"
# allow-headers must contain `authorization` and must NOT contain any x-app-type/x-platform/x-country-code
curl -s -o /dev/null -D - -X OPTIONS "$API/CAIRA_LMS_Masterclass_MilesOne_Web/Top_Section/" \
  -H 'Origin: https://uat.milesmasterclass.com' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization' | grep -i access-control-allow-headers
```

Once a facade exists to exercise the chain (P2 onward):

5. DevTools → Network on any CAIRA call: exactly one `Authorization: Bearer …` header, and **no**
   `x-app-type` / `x-platform` / `x-country-code`. No request blocked by CORS preflight.
6. Force a 403 `{"detail":"Signature has expired."}` with concurrent in-flight requests → exactly
   **one** `POST refresh`, and every queued request replays with the new token.
7. Force a 403 `{"status":"error","reason":"chapter_locked"}` → **no toast**, and the failure reaches
   the caller as `kind: 'domain'`.
