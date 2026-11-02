# Keep signed-in learners off the home page

Status: **approved and implemented (2026-10-28).** Ticket: MIL-148. Branch: `fix/MIL-148-signed-in-home-redirect`, off `master`.

## Goal

The home page (`/:country/:profession_type/home`) is the signed-out landing page. A signed-in learner who reaches it,
by any route, lands on the masterclass page in the same country and profession instead. Signed-out visitors are
unaffected.

## What I read

- **`features/features.routes.ts`:**
  - The `''` child always redirects to `home`, whatever the session, although `AuthSession.isAuthenticated()` is
    available to decide it.
  - The two `home` routes have no session check. The first (`canMatch: [uaeCairaMatchGuard]`) serves the UAE CAIRA
    page for `ae`; the second serves `Home`.
- **`core/guards/auth/`:**
  - `authGuard` and `guestGuard` are `CanMatchFn`s that read the boolean `AuthSession.isAuthenticated()`. It comes
    from the cookies, so they answer the same way during SSR.
  - `guestGuard` keeps signed-in learners off the sign-in pages. It returns to `redirect` or `/`.
- **`core/guards/uae-caira-match-guard.ts`:** reads the country and profession off the navigation's URL tree,
  because a `home` route's own `segments` are only `['home']`.
- **`app.routes.server.ts`:** `home` falls under the `**` Server render mode, so a guard runs on the server and the
  server answers with the redirect.
- **The ways a signed-in learner reaches home today:**
  - typing or bookmarking the URL;
  - signing in from home: Sign Up sends `redirect=/us/accounting/home`, and `AuthFacade.verifyOtp` returns there;
  - signing in with no `redirect`: `/` → `rootRedirectGuard` → `/<country>/accounting` → `home`;
  - the header logo (`routerLink="/"`), the same chain;
  - the bare domain: Express sends `/` to `/<country>/accounting/home` (`src/geo-country.ts`);
  - `CountryContext.use()` from outside the country tree navigates to `home`.
- **`layout/header/nav.config.ts`:** the signed-in nav has no Home item, and its first item is `masterclass`.

## Root cause

Nothing on the `home` routes checks the session, and the `''` redirect sends everyone to `home`, so every path above
ends on home.

## Locked decisions

1. **A `CanMatch` guard on the standard `home` route: `guestHomeGuard`** in `core/guards/auth/guest-home-guard.ts`, beside
   `guestGuard`.
   - Signed out, it returns `true`.
   - Signed in, it returns a `UrlTree` for `/<country>/<profession>/masterclass`. The country and profession are
     read off the navigation's URL tree, as `uaeCairaMatchGuard` reads them. The query string is kept, so campaign
     tags survive.
   - `CanMatch`, like `authGuard`, so the home chunk never downloads for a signed-in learner. It runs during SSR, so
     the server answers with a redirect and never renders home's HTML.
   - It's the one gate every path above goes through. Nothing in the header, the sign-in flow, `geo-country.ts` or
     `CountryContext` changes.
2. **`guestGuard` isn't reused.** It sends to `/`, and `/` takes the country from `CountryContext.current()`. During
   a cancelled first navigation that is the geo country, not the URL's, so `/in/accounting/home` could land on
   `/us/…`.
3. **The `''` redirect follows the session:**
   `redirectTo: () => (inject(AuthSession).isAuthenticated() ? 'masterclass' : 'home')`.
   - Without it everything still ends on masterclass, through an extra redirect (`home` → guard → `masterclass`).
   - With it, sign-in, the logo and `/` go straight there. Its comment is rewritten to say why.
4. **The UAE CAIRA route is left as it is.** It's matched first and only for `ae`, so `/ae/accounting/home` stays
   open to signed-in learners. Every other country falls through to the guarded standard route. See Assumption 2.
5. **No other change.**
   - The home page's signed-in code paths aren't removed. The bookmark icons on its track cards (MIL-129) now only
     ever show signed out, and a click there still goes to sign-in.
   - Pruning that is a separate change.

## Endpoint map

None. No API call is added or changed.

## Files

- `src/app/core/guards/auth/guest-home-guard.ts` (new, about 25 lines with its doc comment)
- `src/app/features/features.routes.ts`: the `''` redirect and the two `canMatch` arrays
- `docs/refactor/STATE.md`

About 40 changed lines.

## Security

This changes navigation only and grants nothing. The guard reads the same cookie-backed boolean as `authGuard`. The
target is built from the URL's own first two segments plus a fixed `masterclass`, never from a query parameter, so
it can't be steered off-site.

## Acceptance criteria

1. **Signed in, typed URL:** `/us/accounting/home` lands on `/us/accounting/masterclass`, and home never renders.
   The same holds for `/in/accounting/home` → `/in/accounting/masterclass`.
2. **Signed in, server:** a full page load of `/us/accounting/home` gets a redirect from the server (SSR), not
   home's HTML.
3. **Sign-in:**
   - Signing in from home (Sign Up, then OTP) ends on masterclass.
   - Signing in with no `redirect` ends on masterclass, with no stop on home.
4. **Signed in, other ways in:**
   - the header logo and `/` → masterclass;
   - a query string on the home URL survives the redirect.
5. **Signed out:**
   - `/us/accounting/home`, `/`, the logo and `/ae/accounting/home` render as today: Home, and the UAE CAIRA page.
   - Signing out lands on home.
6. **UAE:** signed in, `/ae/accounting/home` still shows the UAE CAIRA page (see Assumption 2). Signed in, `/` and
   the logo from `ae` still go to `/ae/accounting/masterclass`.

## Checks

`pnpm lint`, `pnpm format:fix`, `pnpm check:structure`, `pnpm build:prod`. Then:

- **Dev (`pnpm start`, 4101):** every criterion above, signed in and signed out.
- **SSR:** `pnpm build`, then start the built SSR server with the `serve:ssr` script in `package.json`.
  - With a signed-in cookie, `curl -sI http://localhost:4000/us/accounting/home` shows a 302 to
    `/us/accounting/masterclass`.
  - Without one, it answers 200.

## Risks

- **A cached redirect:** the server's answer for `home` now depends on the cookie, so a CDN that cached it by URL
  alone could hand a signed-in learner's 302 to a visitor. It can't happen here: `server.ts` sends every rendered
  answer with `Cache-Control: no-cache`, and `vercel.json` adds no shared cache rule for pages.

- **Expired session cookie:** while the access cookie is still present, `isAuthenticated()` is true, so home
  redirects even though the masterclass page will refresh or sign out. `authGuard` behaves the same way.
- **Campaign links to home** reach signed-in learners on masterclass. That's the intent, and the query string is
  kept.

## Assumptions (please confirm)

1. Signed-in learners land on **masterclass**, the first item of the signed-in nav.
2. **The UAE CAIRA page stays open to signed-in learners;** only the standard home is guarded. To keep them off it
   too, the guard also goes first on the UAE route (`canMatch: [guestHomeGuard, uaeCairaMatchGuard]`).
