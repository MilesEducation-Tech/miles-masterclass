# Profile: Password section (set / change) and saved-answer prefill

**Story 3 of the password epic** (story 1 = MIL-166, #231; story 2 = MIL-167, #232). **MIL-168**, branch
`feat/MIL-168-profile-password-prefill` off `master` (`02200e2f`).
**Status:** approved 2026-11-03, implemented (see "Changes from the plan" at the end).

## Goal

1. **Password section on `/auth/profile`** (profile mode, not onboarding). A "Password" card offers **Change
   password** (current, new, confirm) when the account has a password, otherwise **Set a password** (new,
   confirm). "Forgot your current password?" switches to the emailed-code proof in place.
2. **Saved answers pre-fill the questionnaire** (onboarding and profile) from `GET profile/?form=…`; the name from
   `user-details/` fills `full_name` only when nothing is saved. Loading, empty and a failed read are explicit.

## What was read

- `features/auth/pages/profile/profile.ts|html` (the linked model, `rowDefaults`, `toAnswerMap`, save, leave guard),
  `features/auth/services/password-facade.ts`, `components/password-form/` (story 2),
  `core/services/onboarding-api/onboarding-api.ts`, `core/services/account-api/account-api.ts`,
  `core/models/{account,password}.model.ts`.
- Postman `account-profile-v1` GET and PATCH: the GET is a flat `{code: answer}` map with non-answer keys
  (`email`, `phone_number`, `phone_country_code`, `country_code`, `country_name`, `show_referral_code`,
  `profile_picture`); `{}` is the empty state; `form` defaults to `onboarding`. The PATCH refuses `null`, and
  "there is no clearing requirement yet".
- Postman §2.10 (`password-code/`, `password/`) for the change flow: `current_password_incorrect` (401, keep the
  form), `signedOutOtherSessions`, "hide the password section; show `message`" on a 403.

## Locked decisions

1. **Prefill reads `GET profile/` again** (user, 2026-11-02), reversing the 2026-10-10 "pre-fill from `user-details/`
   only" note in the code and `docs/AUTH_API.md` §4.
2. **One PR** for the story unless review asks for 3a (section) / 3b (prefill), which are independent.
3. **Profile: current + new when `has_password`, else new only** (user's brief).

## Assumptions (reviewer, read first)

- **The section shows only once `user-details/` has loaded.** Without it the app can't tell "set" from "change";
  hiding it beats asking for a current password the learner may not have.
- **"Set a password" goes like onboarding**: `{newPassword}` first; the server answers `verification_required`
  (outside the 15-minute window) and the code path from story 2 takes over.
- **"Forgot your current password?"** switches the proof to the emailed code and sends one at once; "Use my current
  password instead" switches back. Never both proofs in one request.
- **Success in the profile:** toast "Password changed" / "Password set", plus "Other devices were signed out." when
  `signedOutOtherSessions`; `user-details/` reloads (the card flips to "Change password"); the form closes and focus
  returns to the card's button.
- **A 403 refusal** replaces the section's body with the server's message (contract: "hide the password section;
  show `message`"). No Continue: there is nothing to continue to.
- **Session ended in the profile** returns to `/auth/profile` after sign-in (`redirect=/auth/profile`); onboarding
  keeps its own `redirect` as in story 2.
- **Prefill join:** only codes that `questions/` renders are seeded; the GET's non-answer keys are ignored. A select
  keeps only saved values that are still options (a retired option is not sent back); a single-select takes the
  list's first value; numbers become text; `null` is blank.
- **Seed priority:** the learner's own edit > saved answer > `user-details/` name. A row the learner hasn't touched
  takes a newer saved value when the read lands late.
- **After a save**, the form re-reads the saved answers and re-seeds from them, and its interaction state is reset
  (today a partial save leaves the form "dirty", so leaving after it asks "Leave without saving?").
- **Clearing is not possible** (contract: no clearing requirement; `null` refused, `""`/`[]` undocumented). Blanks
  stay unsent, so a cleared optional answer reappears after the save, which matches what is stored. Open question
  for the backend below.
- **A saved "yes" can now be taken back:** a boolean is sent when ticked, or when it was saved `true` (sends `false`).
- **Loading:** the page spinner covers only the first load of each read. The reloads after a save keep the form on
  screen (today the `user-details/` reload after every save swaps the whole form for a spinner).
- **A failed `GET profile/` is not fatal:** the form renders blank (plus the name) with a muted notice, and saving
  still works, like a failed `user-details/` today.

## Endpoint map

| Route                                   | Use                                                                                                              | Notes                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET profile/?form=onboarding\|profile` | new read, `OnboardingApi.answers` (`httpResource`)                                                               | `data` is the flat map; `{}` empty; gated on `isAuthenticated()` and keyed on `form()` |
| `PATCH profile/?form=…`                 | unchanged write                                                                                                  | then `answers.reload()` and `user.reload()`                                            |
| `POST password/`                        | `{newPassword, currentPassword}` (change), `{newPassword}` / `{newPassword, emailCode}` (set, or forgot-current) | `current_password_incorrect` 401 keeps the form                                        |
| `POST password-code/`                   | as story 2                                                                                                       |                                                                                        |
| `GET user-details/`                     | `has_password` picks set vs change                                                                               | reloaded after a password 200                                                          |

## Target architecture

### core

- **`account.model.ts`** — `ACCOUNT_ROUTES.answers` (`GET profile/`, `RouteConfig<void, CommonResponse<AnswerMap>, …,
{form}>`); the `AnswerMap` comment says the GET is read again.
- **`onboarding-api.ts`** — `readonly answers = httpResource(...)` (same gating as `questions`, `parse` unwraps
  `data`, `{}` for a `null` body); class comment rewritten.

### features/auth

- **`models/set-password.model.ts`** — `PasswordProof` gains `'CURRENT_PASSWORD'`; `SetPasswordModel` gains
  `currentPassword`; `PasswordMode = 'SET' | 'CHANGE'`.
- **`services/password-facade.ts`** — profile mode:
  - `isOnboarding` becomes readable (the form picks its copy and buttons from it, no inputs);
  - `mode` (`CHANGE` when `has_password === true`), `showsSection` (profile mode and `user-details/` loaded);
  - `isOpen`, `open()` (proof = `CURRENT_PASSWORD` in change mode, `NONE` in set mode), `cancel()` (wipe, close,
    reset code state);
  - `useEmailCode()` / `useCurrentPassword()` to swap the proof;
  - `required(currentPassword)` when the proof is the current password; submit body by proof;
  - `current_password_incorrect` → message under Current password, field cleared and focused;
  - success in profile mode → toast with or without "other devices", `user.reload()`, close.
- **`components/password-form/`** — onboarding keeps its heading and Skip; in the profile it renders no heading
  (the card has it), adds Current password with the "Forgot…" link when the proof is the current password, and
  Cancel instead of Skip. The submit reads "Change password" / "Set password" by mode. Refusal in the profile:
  the message only.
- **`pages/profile/profile.ts|html`**
  - Prefill: `savedAnswers` (joined on `questions/` codes, coerced per control), the linked model seeded by
    priority, re-seeded after a save; `toAnswerMap`'s boolean rule; `isLoading` = first load only, `answers`
    included; `answersError` notice; after save `answers.reload()` + `form().reset()`. The `rowDefaults` and
    class comments rewritten.
  - The Password section, after the questionnaire form (never inside it: nested forms are invalid):
    `<section aria-labelledby>` card with an `h2` "Password", copy by mode, the open button or
    `<app-password-form />`. Markup only, so no new component.
- **i18n** — about 18 keys × 5: `password.section.*`, `password.change.*`, `password.errors.currentRequired`,
  `password.toast.changed*` / `otherDevices`, `profile.answersLoadError`.

## State matrix

**Password section** (profile mode)

| state                                                                                    | UI                                                                                                     | disabled               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| `user-details/` loading or failed                                                        | no section                                                                                             | —                      |
| closed, set                                                                              | card: "Password", "Set a password so you can log in with your email.", button "Set a password"         | —                      |
| closed, change                                                                           | card: "Password", "You log in with your email and a password.", button "Change password"               | —                      |
| open, change                                                                             | Current password (+ "Forgot your current password?"), New (hint), Confirm, Change password, Cancel     | —                      |
| open, set                                                                                | New (hint), Confirm, Set password, Cancel                                                              | —                      |
| invalid on submit                                                                        | first error focused (current → new → confirm → code)                                                   | —                      |
| submitting                                                                               | spinner                                                                                                | Submit, Cancel, Resend |
| 401 `current_password_incorrect`                                                         | message under Current password; field cleared, focused; not signed out                                 | —                      |
| "Forgot your current password?"                                                          | Current password gives way to the code block; code sent at once                                        | —                      |
| `verification_required`, code states, 401 `email_code_incorrect`, 429, 503, 502, network | as story 2                                                                                             | as story 2             |
| 401 no code                                                                              | sign out → `/auth/login?redirect=/auth/profile` + "Session ended"                                      | —                      |
| 403 (six codes)                                                                          | the card keeps its heading; body is the server's message                                               | everything             |
| 200, change                                                                              | toast "Password changed" (+ "Other devices were signed out."); form closes; focus on the card's button | —                      |
| 200, set                                                                                 | toast "Password set" (+ other devices); card flips to "Change password" after `user-details/` reloads  | —                      |
| 200 `signedOut: true`                                                                    | sign out → login + "Signed out" toast, as story 2                                                      | —                      |
| Cancel                                                                                   | form wiped and closed; focus on the card's button                                                      | —                      |

**Questionnaire prefill**

| state                 | UI                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| first load            | spinner until `questions/`, `user-details/` and `GET profile/` have each answered once                                    |
| `questions/` failed   | existing load error                                                                                                       |
| `GET profile/` failed | form renders (blank + name), muted notice "We couldn't load your saved answers. You can still fill in and save the form." |
| `{}`                  | blank form (+ name)                                                                                                       |
| saved answers         | rows seeded; gated children revealed by their saved parent                                                                |
| saving / 400 / toasts | unchanged                                                                                                                 |
| after save            | both reads reload in place (no spinner swap), rows re-seed from what was stored, form no longer dirty                     |

## Files

| File                                                                    | Change                              |
| ----------------------------------------------------------------------- | ----------------------------------- |
| `src/app/core/models/account.model.ts`                                  | `answers` route; comments           |
| `src/app/core/services/onboarding-api/onboarding-api.ts`                | `answers` resource; comments        |
| `src/app/features/auth/models/set-password.model.ts`                    | proof + model + mode                |
| `src/app/features/auth/services/password-facade.ts`                     | profile mode                        |
| `src/app/features/auth/components/password-form/password-form.ts\|html` | current password, profile buttons   |
| `src/app/features/auth/pages/profile/profile.ts\|html`                  | prefill, section                    |
| `src/i18n/auth/{en,ar,fr,de,es}.json`                                   | ~18 keys each                       |
| `docs/AUTH_API.md`                                                      | §4 (GET is read), §7 (profile flow) |
| `docs/refactor/STATE.md`                                                | entry; MIL-167 marked merged        |

**Size:** about 450 changed lines with ~90 of dictionaries. Split point if needed: 3a section, 3b prefill.

## Security

- As story 2: passwords and codes only in the page-scoped facade, wiped on success, cancel, refusal and sign-out;
  never logged or stored; `currentPassword` and `newPassword` sent exactly as typed; one proof per request.
- `GET profile/` carries personal answers and `profile_picture`: read with the bearer like every account read,
  never logged, never cached beyond the resource (`transferCache` is moot: `/auth/**` renders on the client).

## Acceptance criteria

1. Profile with `has_password: true` → "Change password"; a correct change → toast, form closed.
2. Wrong current password → message under it, not signed out.
3. "Forgot your current password?" → code sent → `{newPassword, emailCode}` → 200.
4. `has_password: false` → "Set a password" → `{newPassword}` → `verification_required` → code → 200 → the card
   flips to "Change password".
5. A 403 refusal → the section shows only the message.
6. Onboarding and profile forms show saved answers (text, single, multi, boolean, number); non-answer keys ignored;
   a retired option dropped; `{}` blank; a failed read → notice and a working save.
7. Untick a saved "yes" → the PATCH sends `false`.
8. After a save: no spinner swap, the form is not dirty, leaving doesn't prompt.
9. Every key in all five dictionaries; English verified at 375 / 768 / 1440; story 1 and 2 checks still green.

## Checks

`pnpm lint` · `pnpm format:fix` · `node scripts/check-structure.mjs` · `pnpm build:prod`.

## How to verify

`pnpm start` (4101), Playwright with stubbed answers (`user-details/` with `has_password` true/false, `questions/`
with every control type and a gated child, `GET profile/` from the Postman sample plus a retired option, every
`password/` answer). English only.

## Risks and backend questions

1. **Clearing an answer** — `null` is refused and the contract has "no clearing requirement yet". Ask whether `""` /
   `[]` should clear; until then a cleared optional answer reappears after save.
2. **`login_via`** on `GET profile/` / `questions/` omits the phone or email question; the app doesn't send it
   today and this story doesn't change that.
3. **Large `profile_picture`** (up to 4 MB as base64) comes with every `GET profile/`; it is ignored but downloaded.
   Worth a backend flag later if it shows up in timings.

## Changes from the plan (implementation, 2026-11-03)

- **Re-seeding after a save** is per row, not a full re-seed: a row the learner left alone, or left blank, takes
  the newer seed; an edited row is kept. A full re-seed would have flashed just-saved edits back to the old
  values until the re-read landed. The result is the one planned: a cleared optional answer shows its stored
  value again once `GET profile/` returns.
- **The section's code state survives Cancel** (masked address, cooldown, a spent code). Reopening within the
  cooldown and choosing "Forgot…" otherwise showed a countdown with no code input, though the code was in the
  inbox. A spent code only blocks the code proof, not a change with the current password.
- **No new component:** the section is markup in `profile.html` around `<app-password-form />`; the form picks
  its heading, copy and buttons from `PasswordFacade.isOnboarding()` (no inputs, per AGENTS.md §3).
- **16 keys** per dictionary rather than ~18.
- **Found, not fixed (separate task):** with unsaved edits, "Back to Home" asks "Leave without saving?" twice —
  `/` redirects, and the redirect runs the leave guard again. It predates this branch.
