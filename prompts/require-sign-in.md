# Require sign-in for learner pages and webinar Join (MIL-62)

## Assumptions

1. **Ticket and branch.** This is Bug MIL-62, on `fix/MIL-62-require-sign-in` from `master` at `0aa0f8e`. It goes in as one
   commit: `fix(auth): require sign-in for learner pages and webinar Join`.
2. **The micro-learning course page stays public.** `micro-learning/:courseId/:courseTitle` is both that course's only
   detail page and its reel player. v3 let guests browse it in preview (the facade still carries `ponytail` notes where
   its guest checks were removed). Gating it is a product call, so it is left out here. Say if you want it gated, and it
   becomes one more `canMatch` line.
3. **New users still go to the questionnaire first.** After a code is verified, `AuthFacade` sends a `new_user` to
   `/auth/profile` and ignores `redirect`. Only returning users go straight back to the page they asked for. That is
   existing sign-in behaviour and is unchanged.
4. **A page already open is not closed when the session ends.** The guard runs on navigation. A learner whose token
   expires while a chapter is open keeps the page until they navigate. This is unchanged.

## Goal

A signed-out visitor cannot open a learner-only page or join a webinar.

- **Pages:** they land on `/auth/login?redirect=<the page>` and come back to it after signing in. The page's content
  never renders signed out, and its lazy chunk is never downloaded.
- **Join:** they get a "Sign in to join" prompt instead of the in-app room or Zoom, and come back to the webinar after
  signing in.

## What I read

- **The guard:** `core/guards/auth/auth-guard.ts`.
  - It is a `CanMatchFn`. It returns a `UrlTree` to `/auth/login` with `redirect` set from the in-flight navigation's
    `initialUrl`.
  - `AuthSession` hydrates from cookies, and reads them off the request on the server, so it answers the same during
    SSR.
  - It is used today only on webinar `:id/live` and `/auth/profile`.
- **Route files:**
  - `masterclass.routes.ts`, `podcast.routes.ts`, `micro-learning.routes.ts`, `webinar.routes.ts`
  - `features.routes.ts` (where `cpe-tracker` and `caira-tracker` are mounted), `payment.routes.ts`
  - No learner route has a sign-in check.
  - `paymentGuard` checks only the cart's contents, and returns `true` on the server.
- **Render modes:** `app.routes.server.ts`.
  - Client-rendered: the exams, both trackers, `payment/**` and webinar `/live`.
  - Everything else, including chapters, reports and feedback, is server-rendered. Nothing is prerendered.
- **Robots and sitemap:** `src/seo.ts`. `robots.txt` already disallows `chapter/`, `final-assessment/`, `feedback` and
  `payment` (except `payment/plan`), and the sitemap leaves them out. Guarding them costs no SEO.
- **Sign-in return:** `AuthFacade` (`features/auth/services/auth-facade.ts:440`) calls `navigateByUrl(redirect)` after
  a code is verified.
- **Webinar Join:**
  - `webinar-list.ts:66` and `webinar-detail.ts:99` each have an identical `onJoin`, which does
    `resolveJoinTarget` → `/live` (embedded), `window.open(join_url)` (Zoom), or a toast (unavailable).
  - Neither checks sign-in. `/live` is covered by its route guard; the Zoom link is not.
  - `WebinarFacade.register()` already stops a signed-out user with `promptSignIn()` ("Sign in to register") and
    returns them through the same `redirect` parameter.
- **How a signed-out user reaches Join:** the `pre_login` feed carries no `registration` block, so a signed-out
  visitor normally sees Register, not Join. Join reaches a signed-out user through stale data:
  - `detailResource` is keyed only on the webinar id, not on the sign-in state, so the detail row keeps the signed-in
    `registration` (with its `join_url`) after the user signs out.
  - The feed keeps its last good value through a refetch (`withPreviousValue`), including when that refetch fails.

## Locked decisions

1. **The existing `authGuard`, as `canMatch`, on each route.**
   - No new guard.
   - `canMatch` rather than `canActivate`, so the page's chunk is never fetched. It is the same choice `/live` and
     `/auth/profile` make.
   - Per route rather than a wrapper route, so each guarded page is visible where it is declared.
2. **Guarded routes (17):**

   | File                       | Routes                                                                                      |
   | -------------------------- | ------------------------------------------------------------------------------------------- |
   | `masterclass.routes.ts`    | `chapter/…`, `final-assessment/…/exam`, `final-assessment/…/report`, `feedback`             |
   | `podcast.routes.ts`        | the same four                                                                               |
   | `micro-learning.routes.ts` | `final-assessment/…/exam`, `final-assessment/…/report`, `feedback`                          |
   | `webinar.routes.ts`        | `:courseId/:courseTitle/feedback`                                                           |
   | `features.routes.ts`       | `cpe-tracker`, `caira-tracker` (on the `loadChildren` mount, so it covers both badge pages) |
   | `payment.routes.ts`        | `invoice/:orderId`, `order-history`, and the `''` shell (cart, billing, review)             |

3. **Stays public:**
   - home and the offering landing pages
   - the masterclass and podcast course pages, and the micro-learning course page (Assumption 2)
   - the libraries, instructor pages, and the webinar list and detail
   - `payment/plan`, FAQ, legal, `connect-us`, `faculty` and the partner pages
4. **Join moves into `WebinarFacade.join(webinarId)`.**
   - **Signed out:** `promptSignIn('join')` and stop.
   - **Signed in:** pick the card the page shows (the detail row when it is this page's webinar, otherwise the feed
     row), then the same three outcomes as today. The embedded room is now an absolute path,
     `['/', country, profession, 'webinar', id, 'live']`, built the way home builds its webinar link, because a
     route-scoped facade has no `ActivatedRoute` for the page.
   - Both pages' `onJoin` become one-line calls into the facade, so their templates don't change. Any injections left
     unused are removed.
5. **The sign-in prompt's copy moves to `webinar/constants/sign-in-prompts.ts`.**
   - `promptSignIn(action: 'register' | 'join')` reads its title and body from there.
   - The Register copy is unchanged.
   - Join: title "Sign in to join". Body: "Joining a live webinar records your attendance for CPE credit, so we need
     to know who you are. Sign in and we will bring you straight back here."
6. **No API, model or backend change.**
7. **"Back to Home" on the sign-in page returns to the page sign-in was asked from, else home** (found in review,
   behaviour confirmed by the user).
   - `Auth.handleBackOrLogout()` navigated to `redirect`. That is now a guarded page, so a signed-out user bounced
     straight back to `/auth/login` and the button looked dead.
   - The shell records `currentNavigation().previousNavigation.finalUrl` when it opens, which is the last page that
     rendered. For example, the course page whose Watch Now hit a chapter, or the webinar page whose Join asked for
     sign-in.
   - Back goes there, or to `/` on a direct load. If that page needs a session too (theirs ran out on it), the
     guard sends them back to sign-in, and Back falls through to `/`.
   - `redirect` is used only after sign-in.

## Target architecture

```
Route  ──canMatch: [authGuard]──▶  signed in?  ── yes ─▶ load the page chunk
                                        └─ no ─▶ UrlTree /auth/login?redirect=<url>
                                                (server-rendered route: answered on the server;
                                                 client-rendered route: answered in the browser
                                                 before any page code loads)

join-cta ─(join)─▶ page.onJoin(id) ─▶ WebinarFacade.join(id)
                                        ├─ signed out ─▶ promptSignIn('join') ─▶ /auth/login?redirect=<url>
                                        └─ signed in ─▶ resolveJoinTarget(card) ─▶ /live | Zoom tab | toast
```

## Endpoint map

None. No request is added, removed or changed.

## Phases

One phase, one commit, about +120 / −60 lines.

1. Add `canMatch: [authGuard]` to the 17 routes in decision 2.
2. Add `constants/sign-in-prompts.ts`, and change `promptSignIn` to take the action.
3. Add `WebinarFacade.join()`, then reduce both pages' `onJoin` to a call into it.
4. Run the checks, then verify in the browser and against an SSR build.

## Files touched

| File                                                                        | Change                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/app/features/offerings/masterclass/masterclass.routes.ts`              | 4 × `canMatch`                                        |
| `src/app/features/offerings/podcast/podcast.routes.ts`                      | 4 × `canMatch`                                        |
| `src/app/features/offerings/micro-learning/micro-learning.routes.ts`        | 3 × `canMatch`                                        |
| `src/app/features/offerings/webinar/webinar.routes.ts`                      | 1 × `canMatch`                                        |
| `src/app/features/features.routes.ts`                                       | 2 × `canMatch`                                        |
| `src/app/features/payment/payment.routes.ts`                                | 3 × `canMatch`                                        |
| `src/app/features/auth/auth.ts`                                             | Back → the page before sign-in, else `/` (decision 7) |
| `src/app/features/offerings/webinar/constants/sign-in-prompts.ts`           | new: Register and Join prompt copy                    |
| `src/app/features/offerings/webinar/services/webinar-facade.ts`             | `join()`; `promptSignIn(action)`                      |
| `src/app/features/offerings/webinar/pages/webinar-list/webinar-list.ts`     | `onJoin` → facade                                     |
| `src/app/features/offerings/webinar/pages/webinar-detail/webinar-detail.ts` | `onJoin` → facade                                     |

## Security

- **This is a UX gate, not the security boundary.** Every guarded page's data comes from APIs that already refuse a
  missing or bad token. The guard stops signed-out visitors seeing placeholder pages and firing requests that will 401.
- **The Zoom link stays behind sign-in.** A signed-out user can no longer open a stale `join_url` from the page.
- **No open redirect.** `redirect` is set by the guard from the router's own navigation and consumed with
  `navigateByUrl`, which only routes within the app.

## Acceptance criteria

1. **Each guarded route, signed out:**
   - A direct load lands on `/auth/login?redirect=<that url>`. Server-rendered routes answer with a redirect from the
     server, so no page HTML is sent.
   - An in-app navigation lands there too, and the page's chunk is never requested.
2. **Each guarded route, signed in:** the page loads as before.
3. **After signing in from that redirect:** a returning user lands back on the original URL.
4. **Join, signed out:** the "Sign in to join" prompt opens. Neither `/live` nor a Zoom tab opens. "Sign in" goes to
   `/auth/login?redirect=<the webinar page>`; "Not now" closes the prompt.
5. **Join, signed in:** unchanged. `/live` (where enabled), the Zoom tab, or the "not ready yet" toast.
6. **Public pages:** every page in decision 3 still opens signed out.
7. **Gates:**
   - `pnpm lint`: 0 errors.
   - `pnpm build:prod`: green with no new warnings.
   - The structure check passes.

## Checks

```bash
pnpm lint
pnpm format:fix
pnpm build:prod
pnpm build && pnpm serve:ssr:miles-masterclass-v3
```

Restart `pnpm start` after the builds; they leave a running dev server's Vite cache stale.

## How to verify

1. **Signed out, dev server (4101):**
   - Open each guarded route directly. Expect `/auth/login?redirect=…`.
   - Open each through an in-app link where one exists, e.g. a chapter from a course page. Check in the network panel
     that the page chunk is not requested.
2. **Signed out, public pages:** open every page in decision 3. Each loads.
3. **SSR (4000):**
   - `curl -sI` a chapter, a report and a feedback URL with no cookie. Expect a redirect to
     `/auth/login?redirect=…`.
   - Repeat with a dummy `ACCESS_TOKEN` cookie. Expect 200.
4. **Signed in:** a dummy `ACCESS_TOKEN` cookie on localhost (removed afterwards) passes the guard on every route;
   the pages' own API calls then answer 401, which is expected for a fake token.
5. **Join:**
   - On the webinar list and on a detail page, signed out, call the page's `onJoin(<id>)` from devtools (no code is
     added for this). Expect the "Sign in to join" prompt, and no `/live` navigation or Zoom tab.
   - "Sign in" lands on `/auth/login?redirect=<webinar page>`.

**Not verifiable here:**

- The real round trip after signing in (criterion 3). UAT stopped delivering OTP mail to the temp-mail domains on
  2026-10-10. The return itself uses the same `redirect` handling that was verified live under MIL-52.
- A signed-in Join against a real open session. That needs a registered account and a webinar inside its join window.

## Risks

- **Signed-out links into guarded pages now go to sign-in.** For example, a chapter clicked on a course page. That is
  the intended behaviour, but it is a visible change on public pages.
- **Unknown `payment/*` paths.** With the guard on the `''` shell, a signed-out visit to an unknown `payment/*` path
  goes to sign-in instead of the not-found page.
- **New users** go to the questionnaire, not back to the page (Assumption 3).

## Follow-ups (not in this change)

- **The plan page treats everyone as signed out.**
  - `payment/pages/plan/plan.ts:61` hardcodes `isLoggedIn = signal(false)`, with a `ponytail` note from the session
    rewrite.
  - So a signed-in learner who picks a plan is sent to `/auth/login`, and `guestGuard` bounces them away.
  - It should read `AuthSession.isAuthenticated()`. That needs its own ticket.
- **Micro-learning guest handling** (Assumption 2). If the page stays public, its facade still makes auth-only calls
  for guests (CPE-mode auto-init, activity tracking), which answer 401.
