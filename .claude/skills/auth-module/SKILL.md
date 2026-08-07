---
name: auth-module
description: Authentication in Miles Masterclass v3 — login, signup, forgot-password, profile, the Auth service token lifecycle, authInterceptor refresh, SSR TransferState hydration, and AI Labs OAuth. Read before touching src/app/auth, the Auth service, auth guards, or anything token-related.
---

# Auth (learner)

Learner identity. **Admin auth is a completely separate system** — see the `admin-panel` skill.

## Files

```
src/app/auth/
├── auth.ts                                  # routes + shell
└── shared/
    ├── services/auth-facade.ts
    └── pages/{login,signup,forget-password,profile}/

shared/core/services/auth/auth.ts            # the Auth singleton
shared/core/services/ai-labs-auth/
shared/core/interceptors/auth/               # authInterceptor
shared/core/guards/{auth,guest}/
shared/core/models/auth.model.ts             # User, CurrentPlanData, AUTH_ROUTES
pages/ai-labs-callback/
```

## Routes

```
/auth                     → redirect to login
/auth/login
/auth/signup
/auth/forget-password
/auth/profile
/auth/ai-labs-callback    ← declared BEFORE /auth in app.routes.ts
```

All `RenderMode.Client` — no SEO value, and forms must not be server-rendered with state.

**`auth/ai-labs-callback` is declared before the `auth` route in `app.routes.ts`.** Angular matches on prefix; the `auth` lazy route would otherwise swallow it and 404 inside `authRoutes`. It is the OAuth redirect target for the AI Labs sign-in popup and must stay a fixed, allowlistable path (`AI_LABS.redirectPath`). Do not move or reorder it.

## The Auth service

`shared/core/services/auth/auth.ts` — the single source of truth. See the `core-services` skill for the full member list. What matters here:

**Token lifecycle**

- `storeTokens(token, refreshToken)` → `Storage` under the `environment.AUTH.*` keys.
- `hasValidToken()` / `getAccessToken()` / `getRefreshToken()`.
- `refreshToken()` → new access token; `accessTokenSubject` + `isRefreshing` let `authInterceptor` queue requests during a refresh instead of firing a stampede of 401 retries.
- `clearAuth()` — wipes tokens, user, plan.

**Identity + plan**

- `currentUser`, `isAuthenticated`, `isLoggedIn`.
- `fetchMyProfile()`, `fetchCurrentPlan()`, `currentPlan`, `hasActivePlan`.
- `hasActivePlanFromCookie()` — the synchronous answer `activePlanGuard` needs on a hard refresh, before the plan API resolves. The active-plan flag is mirrored to a cookie for exactly this.

`currentPlan` is **always** reset from the response, including to `null`. That's deliberate: `hasActivePlan` must never show a stale `true` after a cancellation. Don't add a "keep last known value" branch.

## SSR hydration

Profile and auth status cross the server→browser boundary via **`TransferState`** (`AUTH.transferUserData`, `AUTH.transferAuthStatus`), so the first paint knows who the user is instead of flashing a logged-out header.

Course data does **not** use `TransferState` — it rides the HTTP transfer cache, which is why `withHttpTransferCacheOptions({ includeRequestsWithAuthHeaders: true })` is set in `app.config.ts`. Don't "unify" the two mechanisms.

## Guards

- `authGuard` — logged in, else redirect to login.
- `guestGuard` — logged out only (the guest home page).
- `activePlanGuard` — active subscription; falls back to the cookie.
- `isExistingUserGuard`, `rootRedirectGuard` — locale/returning-user routing.

Order matters: `[authGuard, activePlanGuard]` sends anonymous users to login rather than showing a paywall to someone who isn't signed in.

## Profile

`auth/shared/pages/profile/` — profile edit, using `location`, `location-autocomplete` and `job-sectors` from core services for the country/state and sector pickers. `dialog/profile-completion-dialog` prompts when the profile is incomplete.

Profile changes broadcast through `Utils` → `FeatureFacade.refreshPersonalized()` so personalised content re-renders. Calling the API directly leaves stale content behind.

## AI Labs OAuth

Entra sign-in via Supabase Auth (Azure provider), then a Copilot Studio deep link. `ai-labs-auth/` + `pages/ai-labs-callback/`.

The Entra **client secret is not in this repo and must never be** — the token exchange happens in the Supabase dashboard, server-side. Tenant and client IDs in `environment*.ts` are public identifiers by design. `redirectPath` resolves against `SITE_URL`, not `window.location.origin`, so the OAuth allowlist is a fixed per-environment value that SSR can also produce.

## Security

- Tokens go through `authInterceptor`. Never hand-attach an `Authorization` header.
- Tokens go through `Storage`. Never `localStorage` / `document.cookie` directly.
- Never log a token, even at debug level.
- Validate credentials client-side for UX only — the server is the authority.
- Never build a "remember password" or credential-autofill feature here.

## Verify

```bash
pnpm start
```

1. Login → redirected to `masterclass`, header shows the user.
2. Reload — session survives; no logged-out flash on first paint (that's `TransferState`).
3. Signup, then forgot-password end to end.
4. Hit `/us/cpa/cpe-tracker` while logged out → login, not the paywall.
5. Hit `/us/cpa/home` while logged in → `guestGuard` redirects away.
6. Let the access token expire and fire two requests at once — one refresh, both succeed (no stampede).
7. Logout — tokens cleared, protected routes blocked.
8. `/auth/ai-labs-callback` resolves to the callback page, not a 404.
