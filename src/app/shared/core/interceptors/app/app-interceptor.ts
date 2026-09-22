import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, from, switchMap } from 'rxjs';
import { LoadingService } from '../../services/loading/loading';
import { AuthSession } from '../../services/auth-session/auth-session';
import { IS_ADMIN_REQUEST, IS_EXTERNAL_REQUEST, SKIP_AUTH_TOKEN } from '../../models/http.model';
import { AUTH_ROUTE_PATHS } from '../../models/auth.model';

/**
 * The five sign-in routes must never be preceded by a refresh: refreshing
 * before the call that MINTS the session is nonsense, and refreshing before the
 * refresh is recursion. Derived from `AUTH_ROUTES` so a renamed path cannot
 * drift out of this exclusion.
 */
function isAuthRoute(url: string): boolean {
  return AUTH_ROUTE_PATHS.some((path) => url.includes(path));
}

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  // Third-party origins get the request untouched: a bearer for this platform
  // must never leak off-platform, and a background call shouldn't drive the
  // global loading spinner either.
  if (req.context.get(IS_EXTERNAL_REQUEST)) return next(req);

  const loading = inject(LoadingService);
  const auth = inject(AuthSession);

  loading.start();

  // `x-app-type`, `x-platform` and `x-country-code` used to be set here. They
  // are gone deliberately: MilesCAIRA's `Access-Control-Allow-Headers` does not
  // list any of the three (verified against UAT on 2026-09-22), so every
  // preflighted request carrying them would fail CORS. The API reads none of
  // them either — there is no country or profession dimension behind it.

  // The admin panel authenticates against a different identity provider
  // entirely; `adminTokenInterceptor` owns those requests.
  const skipToken =
    req.context.get(SKIP_AUTH_TOKEN) || req.context.get(IS_ADMIN_REQUEST) || isAuthRoute(req.url);

  const send = skipToken
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

  return send.pipe(
    finalize(() => {
      // Stop loading indicator when request completes (success or error)
      loading.stop();
    }),
  );
};
