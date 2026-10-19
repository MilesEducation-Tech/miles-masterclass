# Complete the profile before webinar registration, then come back

## Assumptions

1. **Same branch:** `fix/MIL-62-require-sign-in`, as you asked. It is the same theme: send the learner to the page
   they need, then back.
2. **"Profile complete" means `AuthSession.isProfileCompleted()`.**
   - It is filled from `user-details/` (`is_profile_completed`). The header loads that row on every signed-in page.
   - It turns `true` only when every required profile question is answered.
   - `null` means "not known yet" (the row hasn't arrived). That never blocks: the call goes ahead, and the API's own
     refusal is the backstop (decision 2).
3. **After the profile is complete, the learner lands back on the page and clicks Register Now again.** Nothing
   registers by itself. An automatic retry would book a seat the learner may no longer want. Say so if you'd rather
   it resumed.

## Goal

A signed-in learner whose profile is incomplete clicks **Register Now**, or books through the guest "Secure Your
Seat" form. Instead of a dead-end 400 toast, they:

1. see a toast explaining why;
2. land on `/auth/profile?redirect=<the page they were on>`;
3. complete the profile;
4. are taken straight back to that page.

## Where a complete profile is needed (checked)

- **Backend:** every `api/` and `web-api/` route in the Postman collection was searched. **Only
  `POST events/register-via-zoom/` refuses an incomplete profile**, with `missing_first_name`, `invalid_first_name`,
  `missing_email` or `invalid_email`.
  - Nothing in masterclass, payment, tracker or assessment does.
  - Live join doesn't either: `zoom-meeting-client` falls back to the email's local part for a missing name.
- **Frontend callers of that route:** all go through `WebinarFacade.register()`.
  - **Register Now:** the list hero, list rows and detail hero.
  - **The guest seat form:** `GuestRegistration.verifyAndRegister()` calls `facade.register()` for a returning user.
    It already sends a `new_user` to `/auth/profile?redirect=…`.
  - So **one gate in `register()` covers every page.**

## What I read

- **`AuthSession`:** `isProfileCompleted` (`boolean | null`) and `setMilestones()`. Its comment says "nothing
  branches on this yet". `AccountApi.user` pushes the row's milestones in.
- **`WebinarFacade.register()`:** a profile refusal shows "Update your profile first" with the server's copy, and
  nothing else.
- **`webinar-error.ts`:** `PROFILE_CODES` gives `isProfileProblem`.
- **`profile.ts` `save()`:**
  - A partial save (some required answers missing) stays, with "still to answer".
  - A complete save sets the milestones, refreshes the token if the status moved, and toasts "saved".
  - After that, **onboarding goes to `/`, the profile form stays on the page, and `redirect` is never read.**
- **`AuthFacade` sign-in:** after the code is verified, a `new_user` goes to `/auth/profile` **without** the
  `redirect` it arrived with. Everyone else goes to `redirect ?? '/'`.
- **`GuestRegistration.verifyAndRegister()`:** a `new_user` goes to `/auth/profile?redirect=<router.url>`, which the
  profile page then ignores.

## Locked decisions

1. **Gate before the call** (`WebinarFacade.register()`). Signed in and `isProfileCompleted() === false`:
   - toast "Complete your profile first", body "We need a few details, including your name, before we can book your
     seat. We'll bring you straight back here.";
   - navigate to `/auth/profile?redirect=<router.url>`;
   - `register-via-zoom` is **not** called.
2. **Backstop after the call.** If the API still answers a profile code (because `isProfileCompleted` was `null`, or
   the row says complete but the name is missing), show the toast with the **server's** copy ("Please add your first
   name to your profile and try again.") and navigate to the profile page in the same way.
3. **The profile page honours `redirect`.** After a **complete** save (no `missing` answers), navigate to `redirect`
   if it is an in-app path (it starts with `/` but not `//`). Otherwise, as today: onboarding → `/`, the profile form
   stays. A partial save never redirects: the profile isn't complete.
4. **Sign-in keeps `redirect` for new users.** A `new_user` goes to `/auth/profile?redirect=<redirect>`, not bare
   `/auth/profile`. So "sign in to register" → onboarding → back to the webinar works.
5. **One helper, one convention.** `WebinarFacade` gets a private `sendToProfile(title, body)` used by both decisions 1
   and 2. It uses the same `redirect` query parameter `authGuard` and the sign-in prompts use. The toast copy lives in
   `webinar/constants/sign-in-prompts.ts`, next to the sign-in copy.
6. **No new guard, and no gate on other pages.** No other route or action is refused for an incomplete profile, so
   nothing else is gated (see "Where a complete profile is needed").

## Endpoint map

| Call                                    | Change                                               |
| --------------------------------------- | ---------------------------------------------------- |
| `POST api/v1/events/register-via-zoom/` | not sent when `isProfileCompleted() === false`       |
| `GET api/v1/account/user-details/`      | unchanged; its `is_profile_completed` is now read    |
| `PATCH api/v1/account/profile/`         | unchanged; a complete save now returns to `redirect` |

## Files touched

| File                                                              | Change                                           |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `src/app/features/offerings/webinar/services/webinar-facade.ts`   | gate + backstop + `sendToProfile`                |
| `src/app/features/offerings/webinar/constants/sign-in-prompts.ts` | profile toast copy                               |
| `src/app/features/auth/pages/profile/profile.ts`                  | return to `redirect` after a complete save       |
| `src/app/features/auth/services/auth-facade.ts`                   | new user keeps `redirect`                        |
| `src/app/core/services/auth-session/auth-session.ts`              | comment: `isProfileCompleted` is now branched on |

About 60 changed lines.

## Security

- **The redirect stays inside the app.** `redirect` is accepted only as an in-app path (`/…`, not `//…`), and
  `navigateByUrl` routes within the app anyway.
- **This is a convenience gate.** The server still refuses an incomplete profile itself.

## Acceptance criteria

1. **Signed in, profile incomplete, Register Now** (detail hero, list hero or a list row):
   - the toast shows;
   - the URL becomes `/auth/profile?redirect=<that page>`;
   - no `register-via-zoom` request is sent.
2. **Complete the profile and save:** you land back on that page. Register Now then registers.
3. **A partial save** stays on the profile page with "still to answer".
4. **The API refuses with a profile code anyway:** the server's message shows, and you land on the profile page with
   `redirect`.
5. **Profile complete:** Register Now registers in place, as today.
6. **A new user signs in from a webinar prompt:** onboarding → back to the webinar, not `/`.
7. **The guest seat form, returning user with an incomplete profile:** same as 1, after the code is verified.
8. **Gates:** `pnpm lint` 0 errors, `pnpm build:prod` green.

## How to verify

- **Me, with dummy cookies.** `ACCESS_TOKEN=dummy` plus `PROFILE_STATUS=onboard_completed` seeds
  `isProfileCompleted = false`.
  - Register Now on the detail page: the toast, the profile URL with `redirect`, and no `register-via-zoom` request
    in the network log.
  - Then `PROFILE_STATUS=profile_completed`: Register Now does send the request (the dummy token gets a 401, which
    is expected).
- **You, with your account** (its profile is incomplete; image 1):
  - Register Now → the profile page.
  - Complete the required questions → save → back on the webinar.
  - Register Now → seat booked.
  - I can't do this round trip myself: UAT sends no OTP to temp mail.

## Risks

- **Loop if the backend never sets `first_name`.** The MIL-52 notes recorded that the profile's name answer did not
  update the `user-details/` row. If that is still true, a learner with a complete profile gets `missing_first_name`
  forever: Register → profile → save → back → Register → profile. Your round trip will show it. If it happens, it's a
  backend fix: map the name answer to `first_name`. The frontend can't fill it.
- **New users take two hops.** Onboarding (what `/auth/profile` shows a `new_user`) and the profile form are
  separate. A new user may finish onboarding, come back, click Register Now, and be sent to the profile form once
  more. Each hop returns them to the webinar.
