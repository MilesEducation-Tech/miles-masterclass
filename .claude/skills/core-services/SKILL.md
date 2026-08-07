---
name: core-services
description: The app-wide singletons in src/app/shared/core/services — ApiClient, Auth, Storage, Dialog, Notification, Logger, Utils, Analytics, Loading, Network, GlobalSearch — plus the HTTP interceptors. Read before making an HTTP call, opening a dialog, showing a toast, reading storage, or touching auth state.
---

# Core services

`src/app/shared/core/services/`. All `providedIn: 'root'`. These are the app's shared machinery — use them instead of rebuilding a local equivalent.

## ApiClient — every HTTP call

`services/api-client/api-client.ts`

```ts
private readonly api = inject(ApiClient);

this.api.get<CommonResponse<Course>>('nano_learning/123')
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(res => this.course.set(res.data));
```

- `get` / `post` / `put` / `patch` / `delete` / `request`.
- Relative URLs get `environment.BASE_API_URL` prepended; absolute `http(s)://` URLs pass through untouched (used for WordPress and S3).
- **Never inject `HttpClient` in a feature.** Two files still do (`course-resources.ts`, `micro-learning-course.ts`) — that's known debt, not a pattern.
- Responses are wrapped in `CommonResponse<T>` (`models/http.model.ts`). Unwrap in the facade.

## Interceptors

`services/../interceptors/`, wired in `app.config.ts`:

| Interceptor             | Does                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `authInterceptor`       | Attaches the learner access token; refreshes on 401 via `Auth.refreshToken()`.                                   |
| `adminTokenInterceptor` | Attaches the **admin** token instead — only when the request carries the `IS_ADMIN_REQUEST` `HttpContext` token. |
| `appInterceptor`        | Logs errors and raises the error toast. Suppress per-request with the `SKIP_ERROR_NOTIFICATION` context flag.    |

Never hand-attach an `Authorization` header. If an admin call is going out with a learner token, the missing piece is the `IS_ADMIN_REQUEST` context token.

## Auth

`services/auth/auth.ts` — learner identity and token lifecycle.

| Member                                                                    |                                                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `currentUser: Signal<User \| null>`                                       | Profile.                                                                                  |
| `isAuthenticated` / `isLoggedIn: Signal<boolean>`                         | Computed from token validity.                                                             |
| `currentPlan: Signal<CurrentPlanData \| null>`                            | Subscription.                                                                             |
| `hasActivePlan: Signal<boolean>`                                          | Computed from `currentPlan`.                                                              |
| `hasActivePlanFromCookie()`                                               | Synchronous fallback for `activePlanGuard` on hard refresh, before the plan API resolves. |
| `fetchMyProfile()` / `fetchCurrentPlan()`                                 | Populate the signals.                                                                     |
| `storeTokens()` / `setAuthenticated()` / `clearAuth()` / `refreshToken()` | Token lifecycle.                                                                          |
| `accessTokenSubject` / `isRefreshing`                                     | Used by `authInterceptor` to queue requests during a refresh.                             |

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
