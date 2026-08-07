import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { Auth } from '../../services/auth/auth';
import { SKIP_AUTH_REFRESH } from '../../models/caira/envelope.model';
import { isPublicCairaRoute } from '../../http/caira.endpoints';
import { cairaError, isRefreshable } from '../../http/caira-error';

/**
 * Refreshes an expired access token once and replays the requests that were
 * waiting on it.
 *
 * The hard part on CAIRA is recognising the failure at all. `USP/authentication.py`
 * never overrides DRF's `authenticate_header()`, so `AuthenticationFailed` is
 * downgraded from 401 to **403** on the wire. The interceptor this replaces
 * keyed on `error.status === 401` and would therefore never have refreshed —
 * it would have shown a toast and left the user logged out-but-not-really.
 * `cairaError()` maps both statuses onto `kind: 'auth'`.
 *
 * `isRefreshable` narrows further to *expired* tokens. A malformed header or an
 * unknown user is not fixed by a new token, and retrying those doubles the load
 * for the same rejection.
 *
 * Must sit **inside** `errorInterceptor` in the chain, so a request that a
 * refresh rescues never reaches the toast.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!shouldAttemptRefresh(req, error)) {
        return throwError(() => error);
      }
      return refreshAndRetry(req, next, auth);
    }),
  );
};

function shouldAttemptRefresh(req: HttpRequest<unknown>, error: unknown): boolean {
  // The refresh call itself. An explicit context flag rather than a URL match:
  // the old guard was `req.url.includes('refresh_token')`, and CAIRA's path is
  // `refresh`, so it silently stopped matching and the loop guard was dead.
  if (req.context.get(SKIP_AUTH_REFRESH)) return false;

  // Pre-token routes — `web/login-*`, `web/verify-otp`, `qr/*`. Their 401s mean
  // "wrong password" or "wrong PIN", not "expired token".
  if (isPublicCairaRoute(req.url)) return false;

  // Nothing to refresh against if the request went out unauthenticated.
  if (!req.headers.has('Authorization')) return false;

  return isRefreshable(cairaError(error));
}

function refreshAndRetry(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: Auth,
): Observable<HttpEvent<unknown>> {
  // Already refreshing: queue on the subject instead of firing a second refresh.
  // Without this, N concurrent 403s produce N refreshes, and every one after the
  // first presents an already-rotated token.
  if (auth.isRefreshing()) {
    return auth.accessTokenSubject.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(withToken(req, token))),
    );
  }

  auth.isRefreshing.set(true);
  auth.accessTokenSubject.next(null);

  return auth.refreshToken().pipe(
    switchMap((token) => {
      auth.isRefreshing.set(false);
      if (!token) {
        // `Auth.refreshToken` has already cleared the session. Surface the
        // original failure rather than a synthetic one so the caller's
        // `cairaError()` still reports `kind: 'auth'`.
        return throwError(() => new Error('Token refresh failed'));
      }
      return next(withToken(req, token));
    }),
    catchError((refreshError: unknown) => {
      auth.isRefreshing.set(false);
      auth.clearAuth();
      return throwError(() => refreshError);
    }),
  );
}

function withToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}
