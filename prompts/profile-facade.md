# Profile page: move the data and the decisions into a `ProfileFacade`

**Status:** implemented 2026-10-15 on `refactor/MIL-XXX-profile-facade`, stacked on `chore/MIL-86-facade-harness`.
The user asked for the fix directly ("fix the facade issues in profile") after reading `prompts/facade-audit.md`,
whose P1 item 1 is this change; that was taken as approval of the audit's recommendation.

## Jira

```
Summary: refactor(auth): move the profile page's data and save into a ProfileFacade
Issue type: Tech debt · Component: auth · Branch: refactor/MIL-<n>-profile-facade
Context: the facade audit found the 533-line profile page owning its reads, the save and what follows it, and writing
         its own state (which questionnaire) into the root core OnboardingApi, whose only consumer it was.
Expected: a facade owns the data and decisions; the page owns the signal form; no behaviour change.
Estimate: S
```

## Goal

Apply `.agents/skills/facade-pattern/SKILL.md` to `/auth/profile` without changing what the learner sees or what is
sent to the API.

## What it read

`features/auth/pages/profile/profile.ts|html`, `features/auth/auth.routes.ts`, `core/services/onboarding-api`,
`core/services/account-api`, `core/models/account.model.ts`, `core/guards/can-deactivate-exam-guard.ts`,
`@angular/router` 22.2.2 (route injector cleanup is opt-in through `withAutoCleanupInjectors`, not enabled in
`app.config.ts`).

## Decisions

- **D1 New `features/auth/services/profile-facade.ts`** (`ng generate service`), `@Service({ autoProvided: false })`.
  It absorbs `OnboardingApi` whole: the `questions/` resource, `PATCH profile/`, and the questionnaire kind.
- **D2 Provided by the `Profile` component, not the route.** Route injectors survive leaving the route here, and the
  questionnaire kind, the saving flag and the field errors must start fresh on every visit. A route-provided facade
  would show a returning learner the onboarding questionnaire again.
- **D3 The questionnaire kind is fixed per visit**, a plain value read from `AuthSession.needsOnboarding()` when the
  facade is created. Before, the page wrote it into the root service from its constructor.
- **D4 The facade owns the save and everything after it:** the write, the user reload, the partial-save toast, the
  milestones, the token refresh before navigating, the success toast, the redirect, and the 400 field-error mapping.
  `isSaving` and `fieldErrors` are read-only outside it.
- **D5 The facade owns the leave dialog** (`confirmLeave()`); the page keeps `isDirty`, `beforeunload` and the
  `canDeactivate` hook the guard calls.
- **D6 The page keeps the signal form:** the model, the schema, question gating, sections, and turning the form into
  the answer map. Validation (`markAsTouched`, `invalid`) stays with the form.
- **D7 `core/services/onboarding-api` is deleted** (no other consumer); three core comments that named it now point at
  the facade. `AccountApi` stays in core: the header, the avatar menu and `AuthSession` use it.

## Files

| File                                                                                                                           | Change                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `src/app/features/auth/services/profile-facade.ts`                                                                             | new                                                     |
| `src/app/features/auth/pages/profile/profile.ts`                                                                               | 533 → ~380 lines; injects only the facade and Transloco |
| `src/app/features/auth/pages/profile/profile.html`                                                                             | bindings read the facade                                |
| `src/app/core/services/onboarding-api/onboarding-api.ts`                                                                       | deleted                                                 |
| `src/app/core/models/account.model.ts`, `core/services/account-api/account-api.ts`, `core/services/job-sectors/job-sectors.ts` | comments                                                |
| `.agents/skills/facade-pattern/SKILL.md`                                                                                       | the route-injector note in "Scope"                      |
| `structure-baseline.json`                                                                                                      | pruned (the deleted file's relative-import entry)       |

## Acceptance criteria

- [ ] No behaviour change: same requests (`questions/?form=…`, `PATCH profile/?form=…`, `user-details/`), same
      toasts, same redirect after onboarding, same leave dialog, same field errors.
- [ ] A learner who completes onboarding and later opens `/auth/profile` gets the profile questionnaire.
- [ ] `pnpm lint` 0 errors, structure check, Prettier, `CI=true pnpm build:prod` green (state the environment).

## How to verify (signed in, dev on 4101)

1. Onboarding account: `/auth/profile` shows the onboarding title; save with a required answer blank → inline error;
   partial save → "still to answer" toast; complete → success toast, token refresh, redirect to `/`.
2. Open `/auth/profile` again → the profile title and questions (`form=profile`).
3. Type an answer, click the header logo → leave dialog; "Keep editing" stays, "Leave" goes.
4. Force a 400 with an unknown code → toast; with a known code → message under that question.

## Risks

- Found while verifying, not fixed here (it predates this change; the original page does the same): the leave dialog asks twice when the destination redirects. "Back to Home" goes to `/`, whose `rootRedirectGuard` starts a second navigation to `/us/accounting`; that navigation runs `canDeactivate` again on the still-dirty form and opens a second dialog. Fix, as its own `fix(auth)` commit: `ProfileFacade.confirmLeave()` remembers a confirmed leave for the rest of the visit and answers `of(true)` after that.
- Checked in dev (port 3000) with the browser pane's existing signed-in session, without saving: the profile
  questionnaire loads (`questions/?form=profile`, `user-details/`, 24 fields), and the leave dialog opens and "Keep
  editing" stays. The save path was not exercised, because it writes to the real UAT account.
- `AuthFacade`'s route comment says it is "destroyed when leaving", which D2's finding contradicts; it already resets
  itself on the login page's destroy, so it is correct in effect. Left as is.
