# Phase 9 — Data layer · `features/auth`

Date: 2026-09-26 · Branch: `refactor/structure-10`. **No source changes: this row was already compliant.**

## 1. Summary

PLAN §13 predicted this row: "already `@Service()`, already `httpResource`, the smallest Part B diff". The audit
confirmed there is **nothing to convert**:

- **Reads:** the profile page reads `AccountApi.user`, `OnboardingApi.questions` and `OnboardingApi.answers`. These
  are core `httpResource`s, converted in Phase 9 core/shared and gated on the boolean `isAuthenticated()`.
  - Every `.value()` read is `hasValue()`-guarded (`profile.ts` ~222, ~229, ~251).
  - `isLoading`/`loadError` are derived from the three resources, with no manual flags.
- **The login identifier check** uses `validateHttp` from `@angular/forms/signals`. That is Angular's own
  `httpResource`-backed async validator: reactive, gated by `when`, and debounced. It is the §4.2 mechanism in
  validator form, not a gap.
- **Mutations** (send OTP, verify OTP, save user, save answers) go through core `AuthSession` / `AccountApi` /
  `OnboardingApi` commands. The core ones already `.reload()` the affected resource after success.
- **No** `ApiClient`/`HttpClient`/`resource()`/`firstValueFrom`/`subscribe` read remains in the feature.

## 2. Verification

`node scripts/refactor/verify.mjs`, full run on the clean tree, local macOS / Node 24.15: **8/8 green**. Lint,
unit tests (184 files / 672 passed + 1 skipped), both builds, Storybook, format, bundle (initial 88.8 KB gz) and
SSR smoke (4 of 4 routes) all pass.

`reviewer` (an audit against §4.2 rather than a diff review): **PASS, no conversion needed**, with the file:line
evidence above.

## 3. Decisions needed / skipped / suspicious

- **No decision needed.**
- A reminder, not new: the open decision about "course feedback can never be submitted" (Phase 9 offerings) proposes
  a user source from `AccountApi.user`, the same resource this feature already consumes correctly.

## 4. Visual QA list

None: nothing changed.

## 5. Commit message

```
docs(refactor): close Phase 9 for features/auth (already compliant)

The auth feature's reads are the core AccountApi/OnboardingApi
httpResources, all hasValue()-guarded; the login identifier check is
validateHttp. Full gates green on the unchanged tree; audit PASS.

Phase 9 (data layer), features/auth.
```
