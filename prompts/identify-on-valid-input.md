# Call `auth-identify/` as soon as the identifier is valid

## Goal

Fire `POST api/v1/account/auth-identify/` when the email or phone field becomes **valid**, instead of
waiting for the user to press "Send OTP". Sign-in then has one fewer round trip in the critical path:
by the time the button is pressed, the identity answer is usually already in hand and only
`auth-otp-send/` remains.

## What it read

- `Miscellaneous/Documentation/ACCOUNTS_API_CONTRACT_V1.md` (the attached contract, measured
  2026-09-22) — §1.4, §1.6, §2.1, §2.2, §2.3, §4.2, §10.
- `src/app/auth/shared/services/auth-facade.ts`, `src/app/auth/shared/pages/login/{login.ts,login.html}`
- `src/app/core/models/{auth,account}.model.ts`, `src/app/core/services/auth-session/auth-session.ts`
- `src/app/core/services/api-client/api-client.ts`, `docs/AUTH_API.md`
- Angular 22.0.8 typings for `debounced()` and `httpResource`.

## Assumptions

1. **The prefetch is silent.** A background identify that fails must never put an error under a field
   the user is still typing in. Failures surface only on the submit path.
2. **400 ms debounce.** `l@e.co` is valid and so is `l@e.com` one keystroke later; without a debounce
   this fires on almost every keystroke past the first valid prefix.
3. **`debounced()` is acceptable despite being `@experimental 22.0`.** It is one line, and it composes
   with `httpResource` to give debounce + dedupe + auto-cancellation of superseded requests for free.
   The fallback, if that is unwanted, is a `setTimeout` + `DestroyRef` debounce — roughly 30 lines of
   imperative code with a stale-response guard to test. Say the word and I will use the boring one.
4. Identify is treated as a **read** (it has no side effect; it is a POST only so the identifier stays
   out of the URL). That is what makes `httpResource` the right tool here rather than `ApiClient.call`,
   and it does not contradict AGENTS.md §6 — the rule there is about mutations.

---

## BLOCKER this uncovered — `methods` never matches, so no one can log in

`auth-facade.ts:335` reads:

```ts
if (identity.methods?.length && !identity.methods.includes('otp')) {
  this.error.set('This account signs in through your organisation. …');
  return;
}
```

Per the contract §2.1 the values are **`email_otp`**, **`phone_otp`**, **`password`** (and `saml`
later) — never the bare string `'otp'`:

> an email gives `["email_otp", "password"]`, a phone gives `["phone_otp", "password"]`, a username
> gives `["password", "email_otp"]`

So that condition is true for **every** account and every login dead-ends on the enterprise-SSO
message. It has never been exercised because UAT answers 503 on all five auth routes. This must be
fixed as part of this change — moving identify earlier only makes it fail earlier.

**Fix:** treat the account as OTP-capable when `methods` contains any member ending in `_otp`; prefer
`defaultMethod` when it is one. Only refuse when the list is non-empty and carries no `*_otp` at all.

---

## Target architecture

`AuthFacade` gains a reactive prefetch; `AuthSession.identify()` stays as the submit-time fallback.

```ts
/** The identifier, but only once the field actually validates. */
private readonly validIdentifier = computed(() =>
  this.loginForm.identifier().valid() && this.authModel().identifier
    ? this.toIdentifier()
    : undefined,
);

/** ponytail: debounce + dedupe + auto-cancel, declaratively. */
private readonly settled = debounced(this.validIdentifier, IDENTIFY_DEBOUNCE_MS);

readonly identity = httpResource<IdentifyResponse>(() => {
  const identifier = this.settled.value();
  return identifier
    ? { url: apiUrl(AUTH_ROUTES.identify.path), method: 'POST', body: { identifier } }
    : undefined;   // idle — no request while the field is empty or invalid
});
```

Three properties come from the framework rather than from code I have to test: an identifier that
changes mid-flight **cancels** the superseded request, an unchanged identifier does **not** re-fire,
and an invalid/empty field means **idle**, not error.

`submitLogin()` then becomes: use the prefetched identity if it is for the identifier being submitted;
otherwise `await auth.identify(...)` inline exactly as today. The contract's "identify first, always"
holds on both paths — the fallback is required, not decorative, because a fast typist can press Send
before the debounce fires.

## Endpoint map

| Route                 | Change                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST auth-identify/` | Now also called on valid input, debounced. Body unchanged: `{identifier}` — and **nothing else**, since §1.4 rejects undeclared keys. |
| `POST auth-otp-send/` | Unchanged. Still only on submit — it spends an OTP and must never be speculative.                                                     |

## Files touched

| File                                          | Change                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app/auth/shared/services/auth-facade.ts` | Add the prefetch resource; rewrite the `methods` check; `submitLogin` consumes the prefetch. |
| `src/app/core/models/auth.model.ts`           | Correct `IdentifyResponse` to the documented shape; add an `isOtpMethod` helper.             |
| `src/app/core/models/auth.model.spec.ts`      | Cover the `methods` matrix from §2.1.                                                        |
| `docs/AUTH_API.md`                            | Record the prefetch and the corrected `methods` values.                                      |

## Security requirements

- `auth-identify/` is **first-party only** (§2.1): `communicationId` is `null` for an unknown
  identifier, which makes the route an account-existence oracle. Calling it on input does **not**
  weaken that — anyone at the keyboard can already curl it — but it does raise call volume, which the
  debounce and the dedupe are there to bound.
- **Still render nothing from the response.** No "no such account", no "we found your account". The
  masks are built from what was typed, not from anything stored, so there is no signal to render.
- No OTP is ever sent speculatively. `auth-otp-send/` stays on the submit path only.

## Acceptance criteria

- [ ] Typing a valid email fires exactly **one** `auth-identify/` ~400 ms after the last keystroke.
- [ ] Typing an invalid or partial identifier fires **none**.
- [ ] Editing the identifier while a request is in flight cancels it; the stale answer never wins.
- [ ] Re-focusing and leaving the field unchanged fires nothing further.
- [ ] Pressing Send OTP after the prefetch resolved issues **only** `auth-otp-send/`.
- [ ] Pressing Send OTP before it resolves still issues `auth-identify/` then `auth-otp-send/`, in order.
- [ ] A failed prefetch shows **no** error while typing, and does not block submit.
- [ ] An account whose `methods` is `["email_otp","password"]` reaches the OTP step (today it cannot).
- [ ] An account whose `methods` is `["saml"]` shows the organisation message.

## Checks to run

```bash
pnpm lint && pnpm format:fix && pnpm test && pnpm build:prod
pnpm start     # port 4100
```

## How to verify

1. `/auth/login`, Email tab. Open DevTools → Network, filter `auth-`.
2. Type `a` … `abc@` — **no** request. Complete to `abc@example.com`, wait — **one** `auth-identify/`.
3. Keep typing so it becomes `abc@example.comm` then back — the superseded request shows as cancelled.
4. Press Send OTP — only `auth-otp-send/` goes out.
5. Clear the field, retype the same address fast and press Send immediately — `auth-identify/` then
   `auth-otp-send/`, in that order.
6. Throttle the network to Slow 3G and repeat (5) to confirm the fallback path, not a race.

## Risks

1. **`debounced()` is experimental** and could change shape in a minor. Contained to one line;
   assumption 3 names the swap.
2. **Call volume on `auth-identify/`.** §1.6 measured this backend's throttles as declared but _not
   enforced_, so a runaway loop would not be stopped by a 429 from us. The debounce plus the
   idle-on-invalid gate are what bound it; the acceptance criteria above test exactly that.
3. The `methods` fix changes a branch that has **never run against a live SSO** (UAT is 503). It is
   written from the contract, not from a captured payload.

---

## Out of scope here — other mismatches the same document revealed

Not touched by this change. Listed so they are not lost, and so you can tell me whether to fold them in.

| #   | Where                           | Shipped                                            | Contract says                                                                                                                                                                 |
| --- | ------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `AuthFacade.renderFailure`      | 429 hardcodes a **30-minute** lockout              | Body carries **`retryAfterSeconds`** (§2.2, §2.3)                                                                                                                             |
| 2   | `Question` (`account.model.ts`) | `label`, `type`, `options[{id,label,value}]`       | `question`, **`answer_format`**, `options[{text, value[]}]`, plus `help_text`, `placeholder`, `validation`, `parent_question`, `parent_answer_value` (§4.2)                   |
| 3   | `Profile.controlOf()`           | heuristic, because the vocabulary was undocumented | Exactly `text \| number \| boolean \| date \| single_select \| radio \| multi_select \| checkbox` — the heuristic can become a real switch, and **`date` is unhandled today** |
| 4   | `SessionResponse`               | 4 keys                                             | also `expiresIn`, `tokenType`, `user{communicationId, firstName, lastName, email, phoneCountryCode, phone}` (§2.3)                                                            |
| 5   | `UserDetails.id`                | `number`                                           | a **UUID string** (§3.1)                                                                                                                                                      |
| 6   | `toAuthFailure`                 | one 502 → `retry_new_code`                         | **two** distinct 502s: code spent (re-send) vs SSO unreachable (plain retry) (§2.3)                                                                                           |
| 7   | `IdentifyResponse`              | invented `maskedDestinations`                      | `accountType`, `maskedEmail`, `maskedPhone` (§2.1) — **fixed by this change**                                                                                                 |

(2), (3) and (5) will break the profile/onboarding screen against a live backend. (1) shows the wrong
countdown. None blocks login; (7) and the `methods` blocker do.

---

## Built — what changed from this plan

1. **`debounced()` did not work and was removed.** It returns a lazy `Resource`, and a resource read
   only from inside another resource's request function never activates — the chain sat at `idle`
   and no request was ever made (observed live). Replaced with the documented fallback: an `effect`
   whose `onCleanup` cancels the pending timer. An effect is an _eager_ consumer, which both
   debounces and starts the chain. No experimental API remains in the auth path.
2. **Password sign-in is gated off**, because the backend exposes no route to submit a password to.
   See `docs/AUTH_API.md` §7 for the one-route ask. The method-driven engine is in place, so turning
   it on is a constant flip plus the field.
3. The password UI was **not** written as hidden markup — it would be permanently invisible behind
   `PASSWORD_LOGIN_ENABLED = false`, and dead markup cannot be tested.

## Verified

Live, in the browser, typing into the real form:

| Behaviour                                                     | Result                                   |
| ------------------------------------------------------------- | ---------------------------------------- |
| Invalid / partial identifier (`s`, `so`, `sohan@`, `sohan@m`) | **0** requests                           |
| Four valid addresses typed 120 ms apart                       | **0** requests while typing              |
| After settling                                                | **exactly 1**                            |
| Left untouched afterwards                                     | still 1 — no re-fire                     |
| Prefetch failed (UAT down)                                    | nothing rendered; `error()` null         |
| Submit after a failed prefetch                                | falls back to an inline `auth-identify/` |

`auth-facade.spec.ts` covers the same seven behaviours with fake timers. Setting the debounce to 0
fails the coalescing test, so it is not vacuous.

UAT was returning 503 on **every** route including `faqs/` and the OPTIONS preflight while this was
verified, so the happy path past identify is still unexercised end to end.
