# Global loading bar: visible, robust, skippable per request

Approved 2026-10-08. The second of two tickets from one request; the first is
`prompts/home-course-info.md` (MIL-40).

## Jira ticket

**Summary:** `fix(core): make the global loading bar visible and skippable per request`

**Issue type:** Bug
**Component / scope:** core
**Branch:** `fix/MIL-XXX-global-loading-bar`
**Links:** relates to MIL-40 · `prompts/global-loading-bar.md`

### Context

Every API call is meant to show a loading bar at the top of the page. In practice nobody can see it,
and calls that run in the background would flash it if they could be seen.

### Current behaviour

- `appInterceptor` (`core/interceptors/app/app-interceptor.ts`) counts every request in
  `LoadingService`, and `app.html` draws `<app-progress [value]="null">` while the count is above 0.
- The bar is a 4 px full-width `bg-primary` (`rgb(4,72,170)`) line on a near-black page. Its only
  animation is `animate-pulse` (a 2 s opacity cycle), and a page load shows it for about 100 ms, so
  nothing visibly moves.
- Background traffic drives it too:
  - the 15 s webinar heartbeats
  - video-progress (`myclassactivity`) posts
  - webinar status polling
  - global-search and location typeahead
  - the UTM capture post
  - token refresh
  - the boot-time `user-details` read
- The only opt-out is `IS_EXTERNAL_REQUEST`, which also strips auth.
- `loading.start()` runs before the rest of the chain is subscribed. A synchronous throw from a later
  interceptor would leak a count.

### Expected behaviour

- Every HttpClient request (`ApiClient`, `httpResource`, raw `HttpClient`) shows a visible,
  sliding top bar by default.
- A request opts out with `context: new HttpContext().set(SKIP_LOADING, true)`.
- Fast responses (< 150 ms) never flash it. Once shown, it stays at least 400 ms.

### Scope

- In: `SKIP_LOADING`, a dedicated `loadingInterceptor`, a rewritten `LoadingService`, the bar's
  visual, opt-outs on the background calls above, and one rule in AGENTS.md §4.2.
- Out (follow-up ticket): per-page loading UI.
  - the shared `Spinner`'s dynamic colour classes
  - the dead `/masterclass` hero skeleton
  - the podcast / micro-learning rail skeletons gated behind data
  - manual loading flags without `finalize`
- Out: native `fetch` (supabase-js, the update checker, blob downloads); router / lazy-chunk progress.

### Acceptance criteria

- [ ] A request slower than 150 ms shows a bright, sliding bar at the top. It stays at least 400 ms.
- [ ] A request faster than 150 ms never mounts the bar.
- [ ] A `SKIP_LOADING` request never mounts it. That covers the heartbeat, progress, polling, typeahead,
      UTM, refresh and `user-details` calls.
- [ ] Error, cancel and unsubscribe all release the count. The bar never sticks.
- [ ] The SSR HTML carries no bar.
- [ ] Reduced motion shows a static bar.
- [ ] `pnpm lint`, `pnpm build:prod` green (state the environment).

### How to verify

Run the production SSR build. Record `app-root`'s bar with a `MutationObserver` across:

- a client-side navigation
- a throttled navigation
- global-search typing

Then `curl` the SSR HTML for `app-progress`.

### Risks / assumptions / open questions

- `httpResource` reads that have their own skeletons also show the bar. This is the default by
  design.
- A request that never completes keeps the bar on, which is the truth. There is no timeout cap.

**Estimate:** M (100–400)

## Approach

1. `core/models/http.model.ts`: `SKIP_LOADING` (`HttpContextToken<boolean>`, default `false`).
2. `core/services/loading/loading.ts`:
   - browser-only (a no-op on the server)
   - a plain counter and one `visible` signal
   - `start()` returns an idempotent stop
   - a 150 ms show delay and a 400 ms minimum visible time, on one timer
3. `core/interceptors/loading/loading-interceptor.ts`:
   - skips `SKIP_LOADING` and `IS_EXTERNAL_REQUEST`
   - `defer` starts the count on subscribe
   - an inner `defer` plus `finalize` stops it on every exit, including a synchronous throw
4. `app.config.ts`: `loadingInterceptor` first, so the bar covers the token-refresh wait too.
5. `app-interceptor.ts`: drop the loading code.
6. `app.html`: `loading.visible()`; the `accent` variant; `pointer-events-none`; `ariaLabel`.
7. `shared/ui/progress/progress.ts`:
   - an `accent` variant
   - indeterminate is a sliding third: `animate-progress-indeterminate`, with the token in
     `styles.css` `@theme` and the keyframes in `animation.css`
   - reduced motion shows a static full bar
8. Opt-outs:
   - `auth-session.ts` refresh
   - `chapter-facade.ts` / `micro-learning-course-facade.ts` `trackActivity`
   - `meeting-session.ts` heartbeats
   - `webinar-registration.ts` polling
   - `global-search.ts`
   - `location-autocomplete.ts`
   - `utm.ts`
   - `account-api.ts` `user-details`
9. AGENTS.md §4.2: the rule.
