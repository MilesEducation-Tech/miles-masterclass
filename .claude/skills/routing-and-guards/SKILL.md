---
name: routing-and-guards
description: The route tree of Miles Masterclass v3 — the /:country/:profession_type locale prefix, lazy loading, route-scoped facade providers, functional guards, and per-route SSR render modes. Read before adding a route, guard, redirect, or changing how a page is rendered.
---

# Routing and guards

## The shape

```
/auth/ai-labs-callback          ← declared FIRST; `auth` would otherwise swallow it
/auth/**                        → authRoutes            (lazy, RenderMode.Client)
/admin/**                       → adminRoutes           (lazy, RenderMode.Client)
/page-not-found  /maintenance   → PageNotFound
/compliance                     → Compliance
/blog-test/**                   → blog pages inside BlogLayout
/:country/:profession_type/**   → featuresRoutes        (guarded)
/                               → rootRedirectGuard detects country + profession
/**                             → redirect to page-not-found
```

**Order matters.** Angular matches on prefix, so every fixed top-level path must be declared before `:country/:profession_type` — otherwise `/blog` is read as country `blog`.

## The locale prefix

Everything learner-facing lives under `/:country/:profession_type` (`/us/cpa/...`, `/in/accounting/...`). Two guards protect it:

- `validateProfessionCountryGuard` — rejects unknown combinations.
- `isExistingUserGuard` — routes returning users appropriately.

`rootRedirectGuard` on `/` detects the pair and redirects. When building a link, never hardcode the prefix — read it from the active route.

## Feature routes

`features/features.ts`, all children of `DynamicLayout` (header + footer shell):

| Path                                                            | Notes                                                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `''`                                                            | Functional redirect: `masterclass` when logged in, `home` when not.                                                              |
| `home`                                                          | Two routes, same path. First is `canMatch: [uaeCairaMatchGuard]` → UAE CAIRA landing; falls through to the guest-guarded `Home`. |
| `library/**`                                                    | Course / instructor / badge library.                                                                                             |
| `cpe-tracker`                                                   | `authGuard` then `activePlanGuard`.                                                                                              |
| `payment/**`                                                    | Cart resolver + payment guards.                                                                                                  |
| `faq`, `terms-of-service`, `privacy-policy`                     | Also under `mobile/` with `data: { layout: 'plain' }` for the Flutter WebView.                                                   |
| `instructor/:instructorId/:instructorName`                      |                                                                                                                                  |
| `connect-us`, `faculty`, `ai-labs`, `how-to-claim-credly-badge` |                                                                                                                                  |
| `premiere/**`                                                   | Legacy → `webinar` redirects.                                                                                                    |
| `''` → `PARTNER_ROUTES`                                         | `caira`, `cpe-for-corporate`, `partners/*`.                                                                                      |
| `''` → `offeringsRoutes`                                        | `masterclass`, `podcast`, `webinar`, `micro-learning`. Provides `MasterclassFacade`.                                             |

Two `path: ''` `loadChildren` entries coexist — partner routes are tried first, offerings second.

## Route-scoped providers

```ts
{ path: 'cpe-tracker', providers: [CpeTrackerFacade], loadChildren: ... }
```

This is how feature facades get their lifetime. Moving one to `providedIn: 'root'` forks state — read the `FeatureFacade` comment in `features.ts` for what that broke last time.

`Tracks` is provided on the `DynamicLayout` route so the whole feature tree shares one instance.

## Guards

All functional. `shared/core/guards/`:

| Guard                                         | Gate                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `validateProfessionCountryGuard`              | Valid country + profession pair.                                                     |
| `isExistingUserGuard`                         | Returning-user routing.                                                              |
| `rootRedirectGuard`                           | `/` → detected locale.                                                               |
| `authGuard`                                   | Logged in, else login redirect.                                                      |
| `guestGuard`                                  | Logged out only (the guest home).                                                    |
| `activePlanGuard`                             | Active subscription. Falls back to `Auth.hasActivePlanFromCookie()` on hard refresh. |
| `paymentGuard`                                | Non-empty, non-mixed cart before billing/review.                                     |
| `homeRedirectGuard`                           |                                                                                      |
| `canDeactivateExamGuard`                      | Blocks navigation out of an in-progress exam.                                        |
| `uaeCairaMatchGuard` / `cpaLandingMatchGuard` | `canMatch` — pick a country-specific landing variant.                                |

Admin guards live in `admin/shared/guards/`: `adminAuthGuard`, `adminGuestGuard`, `permissionGuard(PERM.*)`.

**Order is semantic.** `[authGuard, activePlanGuard]` means anonymous users hit login, not the paywall. Reversing that shows a subscription wall to someone who isn't signed in.

`canActivate` vs `canMatch`: use `canMatch` when a _different route_ should be tried on failure (the two `home` routes); `canActivate` when access is being denied.

## Resolvers

`payment.routes.ts` uses `cartResolver` on the shell route. Parent resolvers run before child `canActivate`, so cart state is guaranteed loaded before `paymentGuard` evaluates — even on a deep link where the shell component hasn't been constructed. It's skipped during SSR (the routes are `RenderMode.Client`).

## SSR render modes

`app.routes.server.ts`:

| Route                                                                 | Mode       | Why                                                              |
| --------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `admin/**`, `auth/**`                                                 | **Client** | Interactive, no SEO value.                                       |
| `.../final-assessment/:sessionId\|:session_id/exam` (all three types) | **Client** | Live exam state must not be prerendered.                         |
| `.../cpe-tracker`                                                     | **Client** | Per-user data.                                                   |
| `.../webinar`                                                         | **Client** |                                                                  |
| `.../payment/plan`                                                    | **Server** | Marketing-visible pricing.                                       |
| `.../payment/**`                                                      | **Client** | Authenticated cart flow.                                         |
| `**`                                                                  | **Server** | Default — covers course/podcast detail, where SEO is leaf-owned. |

Changing a page from Server to Client silently drops its SEO. If the page has meta tags, it must stay Server.

## Functional redirects

Angular's static `redirectTo: 'webinar/:courseId/...'` does **not** reliably substitute params — it sends users to a literal `/:courseId`. Use the functional form:

```ts
{ path: 'premiere/:courseId/:courseTitle', pathMatch: 'full',
  redirectTo: r => `webinar/${r.params['courseId']}/${r.params['courseTitle']}` }
```

Server-side production redirects are handled separately in `src/legacy-redirects.ts` — see `docs/ROUTE_REDIRECT_MIGRATION_PLAN.md`.

## Param drift

Masterclass exam uses `:sessionId`; podcast and micro-learning use `:session_id`. Both are live in `app.routes.server.ts`. Do not normalise without fixing every consumer — deep links break silently.

## Adding a route — checklist

1. Where does it belong (top-level, feature, offering, admin)?
2. Does it need the locale prefix?
3. Lazy-load it — `loadComponent` / `loadChildren`.
4. Which guards, and in what order?
5. Does it need a route-scoped facade provider?
6. Which SSR render mode, and does it own SEO? (`seo` skill → `DYNAMIC_SLUG_PREFIXES`)
7. Verify: `pnpm build && pnpm serve:ssr:miles-masterclass-v3`, then load the URL directly — deep-link/hard-refresh is where route bugs surface.
