import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthSession } from '../../services/auth-session/auth-session';
import { LanguageContext } from '../../services/language-context/language-context';
import { IS_ADMIN_REQUEST, IS_EXTERNAL_REQUEST, SKIP_AUTH_TOKEN } from '../../models/http.model';
import { SESSION_MINTING_PATHS } from '../../models/auth.model';

/**
 * The four session-minting routes must never be preceded by a refresh:
 * refreshing before the call that MINTS the session is nonsense, and refreshing
 * before the refresh is recursion. Derived from `AUTH_ROUTES` so a renamed path
 * cannot drift out of this exclusion.
 *
 * Logout is NOT one of them: it requires the bearer, so it takes the normal
 * path below (refresh only if inside the skew, then attach the token).
 */
function isSessionMintingRoute(url: string): boolean {
  return SESSION_MINTING_PATHS.some((path) => url.includes(path));
}

export const appInterceptor: HttpInterceptorFn = (original, next) => {
  // Third-party origins get the request untouched: a bearer for this platform
  // must never leak off-platform. (`loadingInterceptor` skips them too.)
  if (original.context.get(IS_EXTERNAL_REQUEST)) return next(original);

  // Django answers in the visitor's language (`LanguageContext`): the browser's own header would
  // ignore the switcher's choice, and SSR calls from Node would send none at all. For a bare
  // language like `fr` this is a CORS-safelisted header, so it never costs a preflight.
  const req = original.clone({
    setHeaders: { 'Accept-Language': inject(LanguageContext).current },
  });

  const auth = inject(AuthSession);

  // `x-app-type`, `x-platform` and `x-country-code` used to be set here. They
  // are gone deliberately: MilesCAIRA's `Access-Control-Allow-Headers` does not
  // list any of the three (verified against UAT on 2026-09-22), so every
  // preflighted request carrying them would fail CORS. The API reads none of
  // them either — there is no country or profession dimension behind it.

  // The admin panel authenticates against a different identity provider
  // entirely; `adminTokenInterceptor` owns those requests.
  const skipToken =
    req.context.get(SKIP_AUTH_TOKEN) ||
    req.context.get(IS_ADMIN_REQUEST) ||
    isSessionMintingRoute(req.url);

  return skipToken
    ? next(req)
    : // Rule 2: rotate BEFORE the request, never as a retry after a 401/403.
      // The access token is short by design and cannot be revoked once issued,
      // and retrying would re-send a POST that has already taken effect.
      // `ensureFreshToken` is a no-op unless the token is inside its skew, and
      // it serialises concurrent callers onto one in-flight refresh (rule 3).
      from(auth.ensureFreshToken()).pipe(
        switchMap(() => {
          const token = auth.accessToken();
          return next(
            token
              ? req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) })
              : req,
          );
        }),
      );
};
