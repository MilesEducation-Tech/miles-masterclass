---
name: core-services
description: The app-wide singletons in src/app/shared/core/services — ApiClient, Auth, Storage, Dialog, Notification, Logger, Utils, Analytics, Loading, Network, GlobalSearch — plus the HTTP interceptors. Read before making an HTTP call, opening a dialog, showing a toast, reading storage, or touching auth state.
---

# Core services

`src/app/shared/core/services/`. All `@Service()` (auto-provided). These are the app's shared machinery — use them instead of rebuilding a local equivalent.

## ApiClient — every HTTP call

`services/api-client/api-client.ts`

```ts
private readonly api = inject(ApiClient);

this.api.get<TopSectionResponse>(CAIRA.topSection)
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(res => this.courses.set(res.data));
```

- `get` / `post` / `put` / `patch` / `delete` / `request` / `absoluteUrl`.
- Relative URLs get `environment.BASE_API_URL` prepended; absolute `http(s)://` URLs pass through untouched (used for WordPress and S3).
- **Never inject `HttpClient` in a feature.** The one legitimate exception is a non-CAIRA host — `blog-api.ts` does it for WordPress because it needs `observe: 'response'` to read `X-WP-Total`.
- Paths come from `core/http/caira.endpoints.ts`, never a string literal. **Trailing slashes are load-bearing**: Django's `APPEND_SLASH` 301s, and a 301 on a POST drops the body.
- **There is no `CommonResponse<T>`.** CAIRA has six success envelopes and no reliable way to tell them apart from the body alone, so each response gets its own interface in `models/caira/`. Unwrap in the facade, not the component.

## Error handling — `cairaError()`

`core/http/caira-error.ts` is the only place that knows CAIRA's five error vocabularies. It maps any failure onto a five-case `CairaFailure` union, and both `errorInterceptor` and your facade call it, so they always agree.

- **`kind: 'domain'`** (the body has a `reason`) is a UI state, not an error — `chapter_locked`, `cool_off_active`, `already_started_via_7dc`. **It never toasts.** Render it.
- **`kind: 'auth'`** arrives as **403 far more often than 401**: `USP/authentication.py` has no `authenticate_header()` override, so DRF downgrades every auth failure. Anything keying on 401 alone silently never refreshes.
- **`kind: 'unexpected'`** is the only bucket that raises a toast, and it shows generic copy — several CAIRA 500 handlers return `str(exc)` verbatim, so the raw text goes to `Logger` only.
- A wrong password is **401 `INVALID_CREDENTIALS`** and classifies as `domain`, not `auth`. Treating it as auth would fire a pointless refresh and clear a session the user is still creating.

## Interceptors

`services/../interceptors/`, wired in `app.config.ts`:

Registered as `withInterceptors([appInterceptor, errorInterceptor, authInterceptor])`. **The order is load-bearing** — requests run top-down, errors unwind bottom-up, so `errorInterceptor` sits _above_ `authInterceptor`. Reversing those two makes every request that a token refresh rescues toast an error first.

| Interceptor        | Does                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `appInterceptor`   | Loading bar + attaches `Authorization: Bearer`. Outermost, so `finalize` covers any retry.                                                |
| `errorInterceptor` | Classifies via `cairaError()`; toasts **only** `kind: 'unexpected'`, unless `SKIP_ERROR_NOTIFICATION` is set. Always re-throws unchanged. |
| `authInterceptor`  | Single-flight refresh on an **expired** token. Concurrent 403s queue on `accessTokenSubject` rather than firing N refreshes.              |

- Never hand-attach an `Authorization` header.
- The token is attached by **allowlist on `BASE_API_URL`** (`shouldAttachToken`), not by opt-out — a forgotten skip flag must not leak a CAIRA token to WordPress, S3 or Supabase.
- **No `adminTokenInterceptor` and no `IS_ADMIN_REQUEST`.** The admin panel authenticates against Supabase and never touches this API.
- Three `HttpContext` flags exist: `SKIP_AUTH_TOKEN`, `SKIP_ERROR_NOTIFICATION`, `SKIP_AUTH_REFRESH`. The last one guards the refresh call against refreshing itself — an explicit flag, because the old URL-substring guard (`req.url.includes('refresh_token')`) stopped matching when the path became `refresh` and silently died.

## Auth

`services/auth/auth.ts` — learner identity and token lifecycle.

| Member                                                                    |                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentUser: Signal<CairaUser \| null>`                                  | Profile.                                                                                                                                                                                 |
| `isAuthenticated` / `isLoggedIn: Signal<boolean>`                         | Computed from token validity.                                                                                                                                                            |
| `currentPlan: Signal<any \| null>`                                        | **No CAIRA counterpart** — there is no subscription model. Always `null`; see the gap register.                                                                                          |
| `hasActivePlan: Signal<boolean>`                                          | Computed from `currentPlan`.                                                                                                                                                             |
| `hasActivePlanFromCookie()`                                               | Synchronous fallback for `activePlanGuard` on hard refresh, before the plan API resolves.                                                                                                |
| `fetchMyProfile()`                                                        | `GET v2/status`. Browser-only, fire-and-forget. Stays imperative: `setAuthenticated` bumps `authStateChanged`, so an `httpResource` keyed on auth state would re-fire on its own result. |
| `isProfileComplete: Signal<boolean>`                                      | Derived from v2/status — **not** from a login `onboarding` flag, which #33 hardcodes `true`.                                                                                             |
| `storeTokens()` / `setAuthenticated()` / `clearAuth()` / `refreshToken()` | Token lifecycle.                                                                                                                                                                         |
| `accessTokenSubject` / `isRefreshing`                                     | Used by `authInterceptor` to queue requests during a refresh.                                                                                                                            |

SSR: profile and auth status cross the boundary via **`TransferState`** (`AUTH.transferUserData` / `transferAuthStatus`). Course data does **not** — it rides the HTTP transfer cache.

`currentPlan` resets to `null` on every fetch, including cancellation, so `hasActivePlan` can never show a stale post-cancellation `true`. Don't add a "keep last known" branch.

Admin identity is a **separate** service — `services/admin-auth/admin-auth.ts`. See the `admin-panel` skill.

## Storage — the only way to touch persistence

`services/storage/storage.ts`. Wraps cookies (`ngx-cookie-service` / `-ssr`) and localStorage, and is **SSR-safe**: on the server it parses cookies off the request.

Never touch `document.cookie` or `localStorage` directly — it throws during SSR. Keys are centralised in `environment.AUTH` and `models/storage.model.ts`.

## Dialog

`services/dialog/dialog.ts` — imperative, component-based, SSR-guarded (a no-op on the server).

```ts
const ref = this.dialog.open<ShareDialog, boolean>(ShareDialog, {
  data: { url },
  environmentInjector: this.injector,   // pass when the dialog injects a route-scoped service
});
ref.afterClosed().subscribe(result => ...);
```

- `DialogRef` and `data` are injected onto the component instance.
- Pass `environmentInjector` when the dialog needs a **route-scoped** facade — otherwise it resolves against root and gets a different instance.
- Dialog components live in `shared/components/dialog/`, never in a feature folder.

## NotificationService — toasts

`services/notification/`. Success / error / info toasts, rendered by `shared/components/notification/`. HTTP errors already toast via `appInterceptor` — don't double-toast a failed request.

## Logger

`services/logger/`. Level-gated by `environment.LOGGER.LogLevel`. Use it instead of `console.log`; bare `console` calls trip lint.

## Utils

`services/utils/` — cross-feature helpers that need app state: bookmark toggle, add-to-cart, certificate download, share. It injects `FeatureFacade` to broadcast bookmark/profile changes (`applyBookmarkChange`, `refreshPersonalized`) into whatever offering page is currently rendered. That broadcast is why `FeatureFacade` must stay a single root instance.

## Analytics

`services/analytics/analytics.ts` — GTM / dataLayer event push, plus `utm/` for campaign attribution and `consent/` for the consent banner gate. Events fire only after consent. Plans and checklists: `docs/ANALYTICS_MEASUREMENT_PLAN.md`, `docs/GTM_SETUP_CHECKLIST.md`, `docs/NETCORE_CHECKLIST.md`.

## The rest

| Service                                                 | Owns                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `loading/`                                              | Global loading state → `ui/page-loading`, `ui/spinner`.         |
| `network/`                                              | Online/offline detection.                                       |
| `viewport/`                                             | Breakpoint signals — use these instead of a local `matchMedia`. |
| `scroll/` + `section-nav/`                              | Scroll position and in-page section navigation.                 |
| `global-search/`                                        | Search state behind `dialog/global-search-dialog`.              |
| `location/` + `location-autocomplete/` + `job-sectors/` | Country/profession context and profile pickers.                 |
| `language/`                                             | UI language selection.                                          |
| `engagement-dialog/` + `app-download-prompt/`           | Timed/behavioural prompts.                                      |
| `partner-code/`                                         | Partner code capture and redemption (see `partner-platform`).   |
| `enquiry/` + `feedback/`                                | Public enquiry and course feedback submission.                  |
| `html-to-pdf/`                                          | jsPDF + html2canvas-pro — certificates and invoices.            |
| `update-checker/` + `version/`                          | New-build detection → `dialog/version-update-dialog`.           |
| `consent/`                                              | Cookie consent — gates analytics.                               |
| `seo/`                                                  | See the `seo` skill.                                            |
| `supabase/` + `admin-auth/` + `ai-labs-auth/`           | See the `supabase` and `admin-panel` skills.                    |

## Rules

- Before writing a helper, grep `shared/core/services/` and `shared/utils/`. Most of it already exists.
- A service that only one feature uses belongs in that feature's `shared/services/`, not here.
- New core service → `providedIn: 'root'`, SSR-safe, and its cross-cutting reason stated in the prompt.
