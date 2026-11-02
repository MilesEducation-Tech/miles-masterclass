import { inject } from '@angular/core';
import { CanMatchFn, PRIMARY_OUTLET, Router } from '@angular/router';
import { AuthSession } from '@core/services/auth-session/auth-session';

/**
 * Keeps a signed-in learner off the home page, the signed-out landing page, and
 * sends them to the masterclass page in the same country and profession.
 *
 * Every way in passes through here: a typed URL, the sign-in `redirect` back to
 * the home page they signed up from, the bare domain's redirect, a country
 * switch. The query string is kept, so campaign tags survive.
 *
 * `CanMatch`, so the home chunk never downloads for them. The session comes from
 * the cookies, so on the server this answers with a redirect rather than home's
 * HTML.
 *
 * The locale is read off the navigation's URL tree, as in `uaeCairaMatchGuard`:
 * `:country/:profession_type` is matched by the parent route, so this route's own
 * `segments` are only `['home']`. Not `CountryContext.current()`, which still
 * holds the previous page's country while this navigation is being matched.
 */
export const guestHomeGuard: CanMatchFn = () => {
  if (!inject(AuthSession).isAuthenticated()) return true;

  const router = inject(Router);
  const url = router.currentNavigation()?.extractedUrl ?? router.parseUrl(router.url);
  const [country, profession] = url.root.children[PRIMARY_OUTLET]?.segments ?? [];
  if (!country || !profession) return true;

  return router.createUrlTree(['/', country.path, profession.path, 'masterclass'], {
    queryParams: url.queryParams,
  });
};
