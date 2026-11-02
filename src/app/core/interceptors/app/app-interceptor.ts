import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { CountryContext } from '@core/services/country-context/country-context';
import { LanguageContext } from '@core/services/language-context/language-context';
import { IS_EXTERNAL_REQUEST, SKIP_AUTH_TOKEN } from '@core/models/http.model';
import { SESSION_MINTING_PATHS } from '@core/models/auth.model';

/** Which client is calling, sent on every platform request as `X-Platform` / `X-App-Type`. */
const CLIENT_PLATFORM = 'masterclass';
const CLIENT_APP_TYPE = 'WA';

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

  // `X-Accept-Language` is the visitor's language (`LanguageContext`), the one Django answers in.
  // It is our own header, not the browser's `Accept-Language`, which ignores the switcher's choice
  // and is absent on SSR calls from Node.
  //
  // `X-Country-Code` is the market that prices the catalogue, plans, cart and checkout: the
  // visitor's country (`CountryContext`, the same one the URL shows), upper-case ISO2. It is
  // client-controlled, so Django must re-derive the country at checkout rather than trust it.
  // `X-Platform` / `X-App-Type` say which client is calling.
  //
  // None of the four is CORS-safelisted, so every cross-origin request preflights, and each must be
  // in MilesCAIRA's `Access-Control-Allow-Headers` or the browser blocks the request outright.
  // As of 2026-10-13, UAT lists all but `x-accept-language`, so every browser request fails until
  // the backend adds it, and production `api.milescaira.com` lists none of them. SSR is unaffected,
  // because Node sends no preflight.
  const req = original.clone({
    setHeaders: {
      'X-Accept-Language': inject(LanguageContext).current,
      'X-Country-Code': inject(CountryContext).current().toUpperCase(),
      'X-Platform': CLIENT_PLATFORM,
      'X-App-Type': CLIENT_APP_TYPE,
    },
  });

  const auth = inject(AuthSession);

  const skipToken = req.context.get(SKIP_AUTH_TOKEN) || isSessionMintingRoute(req.url);

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
