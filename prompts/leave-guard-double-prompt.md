# Ask "Leave without saving?" once, even when the way out redirects

**MIL-171**, branch `fix/MIL-171-leave-guard-double-prompt` off `master` (`f49bbe4a`).
**Status:** approved and implemented 2026-11-03, as planned.

## Goal

A learner with unsaved edits on `/auth/profile` clicks "Back to Home" and confirms "Leave": they are asked once and
leave. The same holds for every page behind `canDeactivateExamGuard`, whatever redirect the destination makes.
"Keep editing" still keeps them on the page, and the browser's own prompt still guards a tab close or reload with
unsaved edits.

## What was read

- `features/auth/auth.ts`: `handleBackOrLogout()` navigates to `backUrl ?? '/'`. On a direct load of
  `/auth/profile` there is no `backUrl`, so it goes to `/`.
- `app.routes.ts`: `/` has `canActivate: [rootRedirectGuard]`, which answers with a `UrlTree` for
  `/<country>/accounting`. `:country/:profession_type` has `canMatch: [onboardingGuard]` and
  `canActivate: [validateProfessionCountryGuard]`.
- `core/guards/can-deactivate-exam-guard.ts`: calls `component.canDeactivate()` every time it runs, with no memory
  of an earlier answer.
- `features/auth/pages/profile/profile.ts`: `canDeactivate()` opens the leave dialog whenever the form is dirty and
  not saving; `onBeforeUnload()` calls `preventDefault()` on the same condition.
- The other users of the guard, `offerings/pages/final-assessment-exam` and `ai-labs/pages/ai-lab-exam`: "Exit the
  exam?" as a `Promise`, the same `onBeforeUnload`. Their Back buttons go to routes whose only redirect is a
  `canMatch`, which is settled before the leave guard runs, so they don't double-prompt in normal use. They would on
  any destination that redirects from `canActivate`, a resolver or the error handler.
- The router: a `canActivate` that returns a `UrlTree` cancels the navigation with
  `NavigationCancellationCode.Redirect` and starts a new one. `checkGuards` runs `canDeactivate` before
  `canActivate`, so the new navigation runs the leave guard again while the page is still on screen. The router's
  own `afterNextNavigation` treats `Redirect` and `SupersededByNewNavigation` cancels as "still navigating"; every
  other end event settles the chain.
- `app.config.ts`: `withNavigationErrorHandler(recoverFromStaleChunk)` reloads onto a new build with
  `location.assign()` when a lazy chunk is missing, before the router emits `NavigationError`.

## Root cause (reproduced on 4101, stubbed session, English)

```
NavigationStart#2 /              GuardsCheckStart#2   → prompt 1, "Leave"
NavigationCancel#2 / code=0      (Redirect, from rootRedirectGuard)
NavigationStart#3 /us/accounting GuardsCheckStart#3   → prompt 2, "Leave"
NavigationEnd#3 /us/accounting   → /us/accounting/masterclass
```

The guard has no memory of the learner's answer, and a redirect is a new navigation, so every redirect between the
click and the destination asks again.

Second form: after "Leave", a missing chunk (a deploy since the tab opened) makes `recoverFromStaleChunk` reload, and
the page's `beforeunload` raises the browser's "Leave site?" on top of the answer already given.

## Locked decisions

1. **Fix it once, in the shared guard.** `canDeactivateExamGuard` remembers a "Leave" for that page until the
   navigation chain settles: a `Redirect` or `SupersededByNewNavigation` cancel carries it on; `NavigationEnd`,
   `NavigationSkipped`, `NavigationError` or any other cancel ends it (the router's `afterNextNavigation` rule).
   Covers the profile and both exams, for every redirecting destination, with no page logic changes.
2. **Only a confirmed dialog is remembered.** A sync `true` means the page was clean (nothing to remember); a sync
   or async `false` cancels as today, so "Keep editing" asks again next time.
3. **The memory is a module-level `WeakSet` of page instances** in the guard file: no service, nothing kept alive.
4. **`beforeunload` honours it.** The guard file exports `leaveConfirmed(component)`; each of the three pages'
   `onBeforeUnload` returns early when it is true. A tab close or reload with no leave in flight still asks.
5. **Rejected:** a flag on `Profile` only (the exams keep the bug; AGENTS.md §8, fix the shared function); pointing
   Back straight at the locale home (repeats `rootRedirectGuard`, misses every other redirect); turning
   `rootRedirectGuard` into a functional `redirectTo` (fixes `/` only, changes `/` everywhere).
6. **The guard keeps its name.** "Exam" is already wrong for the profile, but a rename touches three route files and
   is not this fix.

## Target code

`core/guards/can-deactivate-exam-guard.ts`: `leaving` (`WeakSet`), `leaveConfirmed(component)`, the guard (skip when
`leaving` has the page; on an async `true`, add it and drop it on the first settling router event), `settles(event)`.

Each page's `onBeforeUnload` gains `leaveConfirmed(this)`:

- `Profile`: `if (leaveConfirmed(this) || !this.isDirty() || this.isSaving()) return;`
- Both exams: `if (this.isInProgress() && !leaveConfirmed(this)) event.preventDefault();`

## Endpoint map

None. No API call changes.

## Phases

One: the guard, then the three `onBeforeUnload` lines, then the checks and the browser run.

## Files touched (~45 lines)

- `src/app/core/guards/can-deactivate-exam-guard.ts`
- `src/app/features/auth/pages/profile/profile.ts`
- `src/app/features/offerings/pages/final-assessment-exam/final-assessment-exam.ts`
- `src/app/features/ai-labs/pages/ai-lab-exam/ai-lab-exam.ts`
- `docs/refactor/STATE.md`, this prompt

## Security requirements

None new. Nothing outlives the page, and no data leaves the browser.

## Acceptance criteria

1. On `/auth/profile` with unsaved edits, "Back to Home" asks once; "Leave" lands on `/us/accounting/masterclass`.
2. "Keep editing" stays with the edits kept, and the next "Back to Home" asks again.
3. A reload with unsaved edits and no leave in flight still raises the browser prompt, including right after
   "Keep editing".
4. "Leave" followed by a stale-chunk reload raises no browser prompt.
5. A confirmed leave that ends back on the profile (onboarding: `onboardingGuard` sends the learner back) lets the
   next leave and a reload ask again.
6. A clean form leaves without a prompt.
7. Both exams keep Cancel and Exit as today; their `beforeunload` is unchanged when no Exit is in flight.

## Checks to run

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
```

## How to verify

Dev server on 4101, Playwright, English, stubbed session (`ACCESS_TOKEN`, `REFRESH_TOKEN`, `PROFILE_STATUS` cookies;
stubbed `user-details/`, `questions/`, `profile/`), with a router-event log. One check per acceptance criterion:
prompt count and final URL (1, 2, 6), `page.on('dialog')` for the browser prompt (3, 4; 4 aborts script requests
after the first prompt), `PROFILE_STATUS=new_user` for 5. Exams: the masterclass exam with a stubbed paper, Cancel
then Exit with a stale chunk; if the stubs prove impractical, say so rather than claim it.

## Risks

- **Browser timing:** the `beforeunload` part relies on Chromium firing `beforeunload` synchronously inside
  `location.assign()` (measured on 4101). A browser that fires it later sees the chain settled and shows its prompt,
  which is today's behaviour, never a lost prompt.
- **Superseded navigations:** a learner who confirms "Leave" and clicks elsewhere before it lands isn't asked again
  for that next navigation. They already chose to leave.
- **SSR:** the `WeakSet` is module state, but the server never has a page to deactivate, so nothing is shared
  between requests.

## Assumptions

1. A confirmed "Leave" covers the whole redirect chain: the learner answered for leaving the page, not for one URL.
