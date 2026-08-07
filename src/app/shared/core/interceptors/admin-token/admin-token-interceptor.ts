import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminAuth } from '../../services/admin-auth/admin-auth';
import { IS_ADMIN_REQUEST, SKIP_AUTH_TOKEN } from '../../models/http.model';

/**
 * Admin Token Interceptor — for requests flagged with the IS_ADMIN_REQUEST
 * HttpContext token, attaches the Supabase access token. Public-site requests
 * pass through unchanged. SKIP_AUTH_TOKEN opts a request out entirely, as that
 * token's contract states ("no Authorization header from any interceptor").
 */
export const adminTokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (!req.context.get(IS_ADMIN_REQUEST) || req.context.get(SKIP_AUTH_TOKEN)) {
    return next(req);
  }

  const adminAuth = inject(AdminAuth);
  const token = adminAuth.getAccessToken();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        // 'X-Admin-Request': '1',
      },
    }),
  );
};
