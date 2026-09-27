# Profile rebind: move the user record off the deleted `user_details/`

**Branch:** `fix/MIL-XXX-profile-rebind`, cut from `origin/master` once the auth PR is committed. The two don't overlap.
**Commit:** `fix(auth): rebind the user record to user-details/ and drop the deleted row PATCH`
**Size target:** about 250 changed lines, specs included.

## Jira ticket

Paste this into Jira, then rename the branch to the issued `MIL-<n>`. The template is `docs/engineering/jira-ticket-template.md`.

> **Summary:** `fix(auth): rebind the user record to user-details/ and drop the deleted row PATCH`
> **Issue type:** Bug · **Component / scope:** auth · **Branch:** `fix/MIL-<n>-profile-rebind`
> **Links:** Postman `02. Account, Profile and Reference Content` → `GET account-pathway-logout-route-v1`, `GET/PATCH account-profile-v1`, `GET web-maintainance-v1` · `prompts/profile-rebind.md` · relates to the auth contract fixes ticket
>
> **Context:** On 2026-09-24 the backend deleted `api/v1/account/user_details/`, the 28-field user row and its PATCH. Reads moved to `GET api/v1/account/user-details/` (hyphen), which returns 8 routing fields and has no PATCH (it answers 405). Profile fields are written through `PATCH account/profile/`.
>
> **Current behaviour:**
>
> - The profile page shows its load-error state because `user_details/` no longer exists.
> - Every profile save fails before the answers are written: the row PATCH runs first and 404s.
> - The avatar menu shows no name, email or initials.
> - The onboarding milestones are never refreshed from the server.
> - A non-field error body (`{status:"error", message}` or `{message, status:"Failed"}`) is read as field errors, so the "Save failed" toast never shows.
>
> **Expected behaviour:** The user record loads from `user-details/`. A save writes only `PATCH profile/`. The avatar shows `full_name` and the initials from it. Milestones come from `user-details/`. Every non-field error shows a toast.
>
> **Scope:**
>
> - In: account model and route registry, `AccountApi`, the profile page's save and its defaults, the avatar menu, error parsing, and removing the dead `appStatus`.
> - Out: a certificate-name editor (`POST name/`), maintenance mode UI (`force_logout_all_user`), and the full `docs/AUTH_API.md` rewrite. Each gets its own ticket if wanted.
>
> **Acceptance criteria:**
>
> - [ ] No request goes to `user_details/` or `web/app-status/`.
> - [ ] The profile page loads, and a save sends exactly one `PATCH profile/`.
> - [ ] The avatar shows the full name and initials, and has no email line.
> - [ ] A 500 or 404 envelope on save shows a toast; a code-keyed 400 shows under its question.
> - [ ] A malformed `user-details/` body puts the resource in its error state instead of producing `undefined` fields.
> - [ ] `pnpm lint`, `pnpm ng test --watch=false` and `pnpm build:prod` pass (state the environment).
>
> **How to verify:** On UAT, sign in, open `/auth/profile`, edit an answer and save. Network should show one `PATCH profile/` and no `user_details/` request, the toast should read "Saved", and the avatar name should be correct.
>
> **Open questions for the backend:**
>
> 1. Does a `first_name` / `last_name` answer in `PATCH profile/` also update the stored name, including `full_name` and the certificate?
> 2. Is `show_referral_code` now a key in `GET profile/`?
> 3. Can `user-details/` return `email` for the account menu?
>
> **Estimate:** M

## Goal

Point the app's single user-record read at the endpoint that exists, delete the write that no longer exists, and type both strictly. The questionnaire (`questions/` and `profile/` GET/PATCH with `?form=`) already matches the contract and isn't redesigned here.

## What I read

- **Postman.** Folder `02`:
  - `GET account-pathway-logout-route-v1`: prose plus 4 examples.
  - `GET` and `PATCH account-profile-v1`: prose.
  - `GET` and `POST account-name-v1`.
  - `GET web-maintainance-v1`.
  - The shared error envelopes: 403 `{detail}`, 500 `{status:"error", message}`, 404/502 `{message, status:"Failed"}`, and the strict-key 400.
- **Code.**
  - `core/models/account.model.ts`
  - `core/services/account-api/account-api.ts` (+ spec)
  - `core/services/auth-session/auth-session.ts` (milestone comments)
  - `features/auth/pages/profile/profile.ts` (+ html)
  - `shared/components/user-avatar-menu/user-avatar-menu.ts` (+ html)
  - `core/interceptors/app/app-interceptor.spec.ts` (uses the old path as a sample URL)
  - the three `environments/*.ts` comments

## The contract (what we bind to)

`GET api/v1/account/user-details/`: JWT, `IsAuthenticated`, **GET only** (a PATCH answers 405).

```ts
interface UserDetails {
  first_name: string; // falls back to the first token of full_name
  full_name: string; // whitespace-stripped; may be ''
  is_onboarding_completed: boolean; // stored column
  is_profile_completed: boolean; // stored column
  Pathway: 'Yes' | 'No'; // a STRING, capitalised; 'No' = "could not confirm"
  Enrolled_status: 'Yes' | 'No';
  Enrolled_course: string[]; // [] when not enrolled
  onboarding_fully_completed: boolean; // DERIVED; not the gate
}
```

The endpoint never 500s on an enrolment lookup failure; it falls back to the "No" payload. A bad or expired token gives a 403 `{detail}`. The legacy fields `show_referral_code`, `career_counselling_booked`, `office_visit_booked` and `show_seven_day_challenge` were moved or removed, and nothing in our code reads them.

## Changes

| #   | File                                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `core/models/account.model.ts`                                           | Replace the 28-field `UserDetails` with the 8-field shape above, plus the `YesNo` union type. Delete `UserDetailsPatch`, `AppStatus`, and the route entries `updateUserDetails` and `appStatus`. Set the `userDetails` path to `api/v1/account/user-details/`. Add an `isUserDetails(body: unknown): body is UserDetails` guard (the same hand-written pattern as `isSessionResponse`: every key and its type, and the `'Yes' \| 'No'` literals). Add `AccountErrorBody` / `readAccountError(err)`, which normalises the envelopes into `{ kind: 'fields', fields } \| { kind: 'message', message }`. Update the "READ THIS FIRST" header comment. |
| 2   | `core/services/account-api/account-api.ts`                               | `user = httpResource(() => …, { parse: parseUserDetails })`, where the parse function throws on a body that fails `isUserDetails`, so a drifted contract lands in `error()` in one place. Delete `appStatus` and `updateUser`. Keep the milestone push effect unchanged: both booleans are still on the new body. Update the doc comment.                                                                                                                                                                                                                                                                                                          |
| 3   | `core/services/account-api/account-api.spec.ts`                          | Remove the `appStatus` cases. Feed the verbatim Postman "enrolled" and "fallback" bodies and assert the milestones are pushed. A malformed body gives `error()`, not a value. A signed-out user sends no request.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | `features/auth/pages/profile/profile.ts`                                 | Delete `identityPatch`, `ROW_WRITABLE` and the `updateUser` call. The contract says to write profile fields through `PATCH profile/`, and `first_name` etc. are already questions in that map. `rowDefaults` keeps only what the new row carries (`first_name`, plus `last_name` split from `full_name` when there are exactly two tokens). The other codes are seeded from their stored answers, as today. `applyFieldErrors` uses `readAccountError`: `fields` → per-question errors, `message` → toast with the server's copy. Update the class doc comment (`user_details/` → `user-details/`, no second write).                               |
| 5   | `shared/components/user-avatar-menu/user-avatar-menu.ts` + `.html`       | `displayName` = `full_name \|\| first_name`. `initials` come from the first and last tokens of `full_name`, falling back to `'U'`. Delete `displayEmail` and its `<div>` (no route returns an email; see Assumptions).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | `features/auth/pages/profile/*.spec.ts` (create one if it doesn't exist) | A save sends exactly one request, to `profile/`. A 500 `{status:"error", message}` shows a toast. A code-keyed 400 sets `fieldErrors`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 7   | `core/services/auth-session/auth-session.ts`                             | Comments only: `user_details/` → `user-details/` (4 places). No behaviour change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 8   | `core/interceptors/app/app-interceptor.spec.ts`, `environments/*.ts`     | Sample URL and comment text → `user-details/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Removing dead code (`appStatus`, `UserDetailsPatch`) is part of the fix, not a separate refactor: both point at routes the backend deleted.

## Out of scope (with reasons)

- **`POST name/`** (`{firstName, lastName}`, camelCase, strict). No screen edits the certificate name separately today. Add it with the ticket that builds that screen, once backend question 1 is answered.
- **Maintenance probe** (`GET web/maintainance-status/`, public, `{is_maintenance, force_logout_all_user}`). The old `appStatus` had no reader, so I'm deleting it rather than rebinding it. Wiring the real probe needs a UX decision about the maintenance page and forced logout, so it gets its own ticket.
- **`country/`, `city-autocomplete/`.** Nothing calls them.
- **Legacy `core/models/profile.model.ts` / `user/profile/update/`**, used by `payment-facade.ts:531`. It's a different route, outside this contract. I'll list it as a follow-up.

## Security requirements

- Reads stay gated on the boolean `isAuthenticated()`; there's no token read in the request function.
- No hand-attached headers; the interceptor owns the bearer.
- `PATCH profile/` still never sends `null` (the contract refuses it) and never sends a hidden question's code.
- The error parser renders server copy as text only (Angular interpolation, no `innerHTML`).

## Assumptions (reviewer: read these first)

1. **Avatar email: the line is dropped.** No account route returns an email any more. Decoding it from the access token would work, but it invents a claim contract nobody documented. If the backend adds `email` to `user-details/` (question 3), add it back with one line.
2. **The name is written only through `PATCH profile/`.** The contract says "to write profile fields, use `PATCH account/profile/`". If question 1 turns out to mean the stored name is separate, the follow-up adds `POST name/`.
3. **`show_referral_code` gets no special handling.** `toAnswerMap()` only sends codes of questions actually rendered from `questions/`, so an extra non-answer key in `GET profile/` is never written back. It's already safe, and a spec asserts it.
4. **The milestone gate stays on `is_onboarding_completed`**, not on the new derived `onboarding_fully_completed`. The contract calls the latter derived and distinct, and changing the gate is a product decision.
5. **`last_name` seeding** splits `full_name` only when it has exactly two tokens. Otherwise the field is left blank, so the learner fills it in rather than seeing a wrong guess.

## Acceptance criteria

These are the ticket's criteria, plus:

- No `as UserDetails` / `raw as` casts. Parsing goes through `isUserDetails`.
- `UserDetails` has no optional fields. Every key is always present per the contract.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm ng test --watch=false
pnpm build:prod
```

Record the environment the checks ran in.

## How to verify manually

UAT, `pnpm start` → http://localhost:4101. UAT sign-in answered 503 on 2026-09-27; if it still does, verification rests on the specs fed with the Postman bodies, and I'll say so.

1. Sign in. The avatar should show the full name and its initials, with no email line.
2. Open `/auth/profile`. The questions render and stored answers are filled in.
3. Edit an answer and save. Network should show exactly one `PATCH …/profile/?form=profile` and no `user_details/` request, and the toast should read "Saved".
4. In DevTools, make `profile/` return 500 (block it, or use Overrides). The "Save failed" toast should show.

## Risks

- **Backend question 1.** If a name answer doesn't update the stored `full_name`, the avatar keeps showing the old name after an edit. It's visible, not silent, and the fix is the `POST name/` follow-up.
- **Strict parse.** If the backend adds a key, nothing breaks (extra keys are allowed). If it renames or removes one, the profile page shows its load error instead of rendering `undefined`. That's intended; the error is logged.
- **Avatar layout** loses a line. Check it at 375, 768 and 1440 px.
