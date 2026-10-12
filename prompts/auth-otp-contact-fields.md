# Sign-in: send `email` or `mobile` + `country_code` on OTP send/verify

## Jira ticket

**Summary:** `fix(auth): send email or mobile + country_code on OTP send and verify`

**Issue type:** Bug
**Component / scope:** auth
**Branch:** `fix/MIL-63-otp-contact-fields`
**Links:** Postman `Accounts › auth-otp-send/`, `auth-otp-verify/` (stale, see Risks) · `prompts/auth-otp-contact-fields.md`

### Context

The backend replaced the single `identifier` key on `auth-otp-send/` and `auth-otp-verify/` with
`email`, or `mobile` + `country_code`. UAT already runs the new contract and now rejects
`identifier` as an undeclared field, so nobody can sign in on UAT.

### Current behaviour

`AuthSession.sendOtp` / `verifyOtp` post `{identifier}` / `{identifier, code}`. UAT answers 400
`{"identifier": "Unrecognised field for this endpoint…"}`, so the login page and the webinar
"Secure Your Seat" card both fail at "send code".

### Expected behaviour

| Route                   | Email                      | Phone                            |
| ----------------------- | -------------------------- | -------------------------------- |
| `POST auth-otp-send/`   | `{email}`                  | `{mobile, country_code}`         |
| `POST auth-otp-verify/` | `{email, code}`            | `{mobile, country_code, code}`   |
| `POST auth-identify/`   | `{identifier}` (unchanged) | `{identifier}` E.164 (unchanged) |

### Scope

- In: the two OTP routes, both callers (login page, webinar seat card), `docs/AUTH_API.md`.
- Out: `auth-identify/` (still takes `identifier`), the faculty page (`v2/faculty/*`, a separate,
  already-404 contract), regenerating Postman (generated upstream).

### Acceptance criteria

- [ ] Email sign-in sends `{email}` then `{email, code}` and signs in.
- [ ] Phone sign-in sends `{mobile, country_code}` (`"7501223507"`, `"+91"`) and the matching verify.
- [ ] The webinar seat card accepts an email or a `+`-prefixed phone and sends the same shapes.
- [ ] `identifier` is never sent to send/verify; `communication` is never sent.
- [ ] `pnpm lint`, `pnpm build:prod` green (local macOS).

### How to verify

`pnpm start` (4101, UAT backend) → `/auth/login` → Network tab on `auth-otp-send/` and
`auth-otp-verify/` for both tabs; webinar list/detail signed out → "Reserve My Seat".

### Risks / open questions

See the Risks section below.

**Estimate:** S (< 100 lines)

---

## Goal

Sign-in works again on UAT: OTP send and verify post `email`, or `mobile` + `country_code`, instead
of `identifier`.

## What I read

- `core/models/auth.model.ts` (request types, route registry, `toAuthFailure`)
- `core/services/auth-session/auth-session.ts` (`sendOtp`, `verifyOtp`)
- `features/auth/services/auth-facade.ts` (`toIdentifier`, `send`, identify validator)
- `features/offerings/webinar/services/guest-registration.ts`, `components/seat-form/seat-form.ts|html`
- `core/constants/dial-code.ts` (dial codes are written `'+91'`, and the set is prefix-free)
- `docs/AUTH_API.md` §1, §3, §6; Postman `auth-*` requests

**Live UAT probes (2026-10-12, invalid bodies only, no code sent):**

| Body                                        | Answer                                                            |
| ------------------------------------------- | ----------------------------------------------------------------- |
| send `{}`                                   | 400 `email: One of \`email\` or \`mobile\` is required.`          |
| send / verify `{identifier}`                | 400 `identifier: Unrecognised field for this endpoint…`           |
| send `{mobile}`                             | 400 `country_code: \`country_code\` is required with \`mobile\`.` |
| send `{mobile, country_code, email}`        | 400 `email: Send either \`email\` or \`mobile\`, never both.`     |
| send `{mobile: "abc", country_code: "+91"}` | 401 "Unable to send a code to that identifier" (`"91"` same)      |
| verify `{email, code: "000000"}`            | 401 "Invalid or expired code"                                     |
| identify `{identifier}` / `{email}`         | 200 / 400 `email: Unrecognised field` — identify is unchanged     |

## Locked decisions

1. **One type for "who gets the code":**
   `OtpContact = { email } | { mobile, country_code }`. The union makes "both" and "neither"
   unrepresentable, which is exactly what the route 400s on.
2. **`country_code` keeps its `+`** (`'+91'`), as in the user's curl and the dial-code table. UAT
   also accepts `"91"`, so this is the documented form, not the only one.
3. **`communication` is never sent.** It is optional and its example value is `"dev"`; nothing in
   the app needs it, and a dev switch must not reach prod.
4. **`auth-identify/` is untouched** — it still takes `identifier` (E.164 for a phone).
5. **Webinar seat card stays one field** (no dial-code picker). A phone must start with `+`; it is
   split on the matching dial code from `dialCodeWithLength`. Dial codes are prefix-free, so the
   first match is the only one. Spaces are stripped first, since the placeholder itself shows
   `+1 555 000 0000` (which today's validator rejects).
6. **No error-mapping change.** Send's new 401 for an unreachable number already renders the
   server's own copy via `toAuthFailure`, and does not count toward the verify attempt tally.

## Target shape

```ts
// auth.model.ts
export type OtpContact = { email: string } | { mobile: string; country_code: string };
export type OtpSendRequest = OtpContact;
export type OtpVerifyRequest = OtpContact & { code: string };

// auth-session.ts
sendOtp(contact: OtpContact)            // body: contact
verifyOtp(contact: OtpContact, code)    // body: { ...contact, code }

// auth-facade.ts — toIdentifier() → toContact()
EMAIL → { email: identifier.trim() }
PHONE → { mobile: identifier without spaces, country_code }

// guest-registration.ts — exported, used by the seat form's validator and by sendCode
toOtpContact(value: string): OtpContact | null
```

## Files touched

| File                                                                   | Change                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/app/core/models/auth.model.ts`                                    | `OtpContact`; send/verify request types                     |
| `src/app/core/services/auth-session/auth-session.ts`                   | `sendOtp` / `verifyOtp` take an `OtpContact`                |
| `src/app/features/auth/services/auth-facade.ts`                        | `toIdentifier()` → `toContact()`; `send()` signature        |
| `src/app/features/offerings/webinar/services/guest-registration.ts`    | `toOtpContact()`; keep the parsed contact for verify/resend |
| `src/app/features/offerings/webinar/components/seat-form/seat-form.ts` | validator calls `toOtpContact()`                            |
| `docs/AUTH_API.md`                                                     | §1 table + paragraph, §3 step 2/3, §6 rows 1 and 7          |

No new files, no route or UI change beyond the seat card's validator.

## Security

- Input is validated at the boundary (both forms) before it reaches the API.
- No token handling changes; both routes stay in `SESSION_MINTING_PATHS` (no bearer).

## Checks

`pnpm lint` · `pnpm format:fix` · `pnpm build:prod`, all local macOS.

## How to verify

1. `pnpm start` → `http://localhost:4101/auth/login`.
2. **Email tab:** type an address → `auth-identify/` still posts `{identifier}` → Send →
   `auth-otp-send/` posts `{"email": "…"}` and answers 200 → enter the code → `auth-otp-verify/`
   posts `{"email": "…", "code": "…"}` → signed in.
3. **Mobile tab** (+91): `auth-otp-send/` posts `{"mobile": "75…", "country_code": "+91"}`; verify
   posts the same plus `code`.
4. **Webinar card** (signed out, a webinar detail page): `+91 75012 23507` and an email both pass the
   validator and post the shapes above; `9876543210` (no `+`) is refused under the field.

Steps 2–4 send real codes, so they need an inbox/phone you control — I'll run them with the account
you name, or stop at checking the request bodies.

## Risks

- **Postman is stale:** it still shows `identifier` + `phone_number` + `communication`. The live
  UAT answers above are the contract here; ask the backend to regenerate the collection.
- **Prod:** if prod still runs the old contract when this ships, sign-in breaks there instead. The
  frontend and backend changes must deploy together.
- **Seat card, phone without `+`:** previously passed the client and was left to the SSO; now it is
  refused with "Enter a valid email or phone with country code".
