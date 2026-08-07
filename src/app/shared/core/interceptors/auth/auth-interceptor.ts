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
import { IS_ADMIN_REQUEST, SKIP_ERROR_NOTIFICATION } from '../../models/http.model';
import { catchError, filter, Observable, switchMap, take, throwError } from 'rxjs';

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
  if (req.context.get(IS_ADMIN_REQUEST)) {
    return next(req);
  }

  const authService = inject(Auth);
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error) => {
      // Handle 401 — token refresh logic
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const isRefreshRequest = req.url.includes('refresh_token');
      if (isUnauthorized && !isRefreshRequest) {
        return handle401Error(req, next, authService);
      }

      // Global error notification (skip for 401 and opted-out requests)
      const skipNotification = req.context.get(SKIP_ERROR_NOTIFICATION);
      if (!skipNotification && !isUnauthorized) {
        const message = error?.error?.message || error?.message || 'Something went wrong';
        notification.error('Error', message);
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
