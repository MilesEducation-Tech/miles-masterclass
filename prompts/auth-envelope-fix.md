# Auth envelope fix: sign-in and profile against the enveloped Accounts API

**Branch:** `fix/MIL-XXX-auth-envelope` (from `master`; `git branch -m` once the ticket exists)
**Commit:** `fix(auth): read the {success, message, data} envelope on sign-in and profile`
**Size:** M, about 200 changed lines plus docs. The regenerated Postman files go in their own `chore` commit.

## Jira ticket

**Summary:** `fix(auth): read the {success, message, data} envelope on sign-in and profile`
**Issue type:** Bug · **Component:** auth · **Branch:** `fix/MIL-XXX-auth-envelope`
**Links:** Postman `01. Authentication and Session/*`, `02. Account, Profile and Reference Content/`
`account-profile-v1`, `account-questions-v1`, `account-pathway-logout-route-v1`; this file.

### Context

The backend now wraps every response, success and error alike, in `{success, message, data}`. The Postman
collection was regenerated on 2026-10-10, and the change was verified live on UAT the same day. Every auth
and account call in the app still expected bare bodies.

### Current behaviour

- A correct OTP shows "Something went wrong" and the learner stays signed out.
  - Cause: `isSessionResponse` finds no top-level `accessToken`.
- Every token rotation signs the learner out, for the same reason.
- `user-details/` errors on the renamed keys (`Pathway` → `pathway` and others), so there is no name in the
  header.
- The profile page renders nothing, then crashes on string option values (`optionKey` → `.join`).
- Field 400s never render under their question.

### Expected behaviour

- Verify → signed in → routed on `profile_status`.
- The questionnaire renders and saves.
- The rule-5 refresh keeps the session.
- Field errors render in place.

### Acceptance criteria

- [ ] Email sign-in completes end to end.
- [x] The header shows the learner's name or initials ("U" until the backend fills the name, see risks).
- [x] `new_user` lands on `/auth/profile`; a returning user lands on the `redirect` target.
- [x] Questions render with their option labels, and saved answers are pre-filled.
- [x] A 400 renders under its question.
- [ ] A partial save toasts "still to answer". Not reachable from the UI: the client enforces every `is_required` question first.
- [x] A full save refreshes the token before navigating to `/`.
- [x] A reload keeps the session, and a forced near-expiry makes exactly one refresh for two concurrent reads.
- [x] Logout answers 204 with the bearer, and clears the session.
- [x] `pnpm lint` and `pnpm build:prod` are green (macOS local).

### Risks and open questions

- **New request fields.** `country_code`, `phone_number` and `communication` were added to the
  identify/send/verify serializers, with no prose. We still send `{identifier}` only, as the contract
  example does. Ask the backend whether phone sign-in should also send the split fields.
- **401 instead of 403.** A missing or bad token now answers 401, not 403 (`docs/AUTH_API.md` rule 1).
  Nothing in the auth code branches on the difference.
- **The name answer does not reach the row.** After `PATCH profile/` saves `full_name`, `user-details/`
  still answers `first_name`/`full_name: null`, so the avatar shows "U". Backend ask: write the answer to
  the row, or the client also calls `POST name/`.
- **Disposable email domains.** UAT's mailer answered 200 for `@denipl.net` and never delivered;
  `@forexzig.com` arrived within a minute.

## What changed

| File                                             | Change                                                                                                                                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/models/auth.model.ts`                      | Routes typed `CommonResponse<…>`; `readErrorBody` also reads `data` (field map, `code`)                                                                                                                                                                                   |
| `core/services/auth-session/auth-session.ts`     | `.pipe(map((res) => res.data))` on send, verify and refresh                                                                                                                                                                                                               |
| `features/auth/services/auth-facade.ts`          | Identify validator reads `data.methods`                                                                                                                                                                                                                                   |
| `core/models/account.model.ts`                   | `UserDetails` and `isUserDetails` limited to the four keys the app reads (names nullable — `null` on a new account); option `value: string` + `description`; nullable `placeholder`; routes typed `CommonResponse<…>`; `readAccountError` reads the field map from `data` |
| `core/services/account-api/account-api.ts`       | `parse` unwraps `data`                                                                                                                                                                                                                                                    |
| `core/services/onboarding-api/onboarding-api.ts` | `parse` unwraps `data` on questions and answers; `saveAnswers` maps `res.data`                                                                                                                                                                                            |
| `features/auth/pages/profile/profile.ts`         | Option value is its own key (the key↔value helpers are gone); `rowDefaults` seeds `full_name`; a single-select's scalar is read through `asList()`, so select answers go out as lists                                                                                     |
| `features/auth/pages/profile/profile.html`       | `placeholder ?? ''`                                                                                                                                                                                                                                                       |
| `docs/AUTH_API.md`                               | Envelope, 401, `user-details/` shape, option shape                                                                                                                                                                                                                        |

## Out of scope

- **App-wide envelope fallout:** `response.status` reads in `faculty.ts` and `podcast-course-hero.ts`, and
  `CommonResponse.status` → `success`.
- **Questionnaire UX:** the option `description` line, and `?login_via=`.

## Found during live testing (not fixed here)

- **Native popups:** the profile form has no `novalidate`, so an empty required text field shows the
  browser's own "Please fill out this field." instead of the translated in-app message.
- **Raw section labels:** `section` values (`common`, `licensed_accountant`) render as headings.
- **Dead endpoints on the signed-in home:** `v2/user/last_viewed/` and `user/cart/mybucket/` answer 404.
