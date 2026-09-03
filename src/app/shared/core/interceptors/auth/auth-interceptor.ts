import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '../../services/auth/auth';
import { NotificationService } from '../../services/notification/notification';
import {
  IS_ADMIN_REQUEST,
  IS_EXTERNAL_REQUEST,
  SKIP_ERROR_NOTIFICATION,
} from '../../models/http.model';
import { catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';

/**
 * 401s the API raises about the *account* rather than the access token, mapped
 * to the toast title they deserve. Refreshing these is pointless — there is no
 * stale token to renew, so `handle401Error` just clears the session and throws
 * `Refresh token failed`, swallowing the server's message before the user or
 * the calling facade ever sees it.
 *
 * Token problems keep the default refresh path: the API spells those
 * `authentication_failed`, and the gateway can 401 with no `error_code` at all.
 */
const ACCOUNT_401_TITLES: Record<string, string> = {
  account_blocked: 'Account Blocked',
};

/**
 * Auth Interceptor - handles token refresh and global error notifications
 * for the public-site Auth flow. Admin-panel requests (flagged via the
 * IS_ADMIN_REQUEST HttpContext token) bypass this interceptor — they are
 * handled by `adminTokenInterceptor` and use the Supabase JWT instead.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  // Admin-panel calls are handled by `adminTokenInterceptor`; third-party calls
  // must never trigger a Miles token refresh (a 401 from a foreign host says
  // nothing about our session) nor a global error toast.
  if (req.context.get(IS_ADMIN_REQUEST) || req.context.get(IS_EXTERNAL_REQUEST)) {
    return next(req);
  }

  const authService = inject(Auth);
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error) => {
      // Handle 401 — token refresh logic
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      // The refresh call itself must never trigger a refresh, or a dead refresh
      // token becomes an infinite loop. Matches the SSO refresh route.
      const isRefreshRequest =
        req.url.includes('sso/token/refresh') || req.url.includes('refresh_token');
      const accountErrorTitle = isUnauthorized
        ? ACCOUNT_401_TITLES[error.error?.error_code]
        : undefined;
      if (isUnauthorized && !isRefreshRequest && !accountErrorTitle) {
        return handle401Error(req, next, authService);
      }

      // Global error notification (skip for token-expiry 401s and opted-out
      // requests). Account 401s carry a message written for the user — the OTP
      // flow's blocked-account rejection is the case this exists for.
      const skipNotification = req.context.get(SKIP_ERROR_NOTIFICATION);
      if (!skipNotification && (!isUnauthorized || accountErrorTitle)) {
        const message = error?.error?.message || error?.message || 'Something went wrong';
        notification.error(accountErrorTitle ?? 'Error', message);
      }

      return throwError(() => error);
    }),
  );
};

// Helper function to handle 401 errors
const handle401Error = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: Auth,
): Observable<HttpEvent<unknown>> => {
  if (!authService.isRefreshing()) {
    authService.isRefreshing.set(true);
    authService.accessTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((token: string | null) => {
        authService.isRefreshing.set(false);

        if (token) {
          // Clone request with new token
          return next(addTokenHeader(req, token));
        } else {
          // Refresh failed (token is null), error already logged/handled in service
          return throwError(() => new Error('Refresh token failed'));
        }
      }),
    );
  } else {
    // Wait for the re-fresh to complete
    return authService.accessTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => {
        return next(addTokenHeader(req, token!));
      }),
    );
  }
};

const addTokenHeader = (request: HttpRequest<unknown>, token: string): HttpRequest<unknown> => {
  return request.clone({
    setHeaders: {
      Authorization: `bearer ${token}`,
    },
  });
};
