import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AdminAuth } from '../services/admin-auth';
import { AuditLog } from '../services/audit-log';
import type { AuditCategory } from '../models/audit-log.model';
import { IS_ADMIN_REQUEST, SKIP_AUDIT_LOG, SKIP_AUTH_TOKEN } from '@core/models/http.model';

/** What, if anything, this admin request is worth recording. */
interface AuditIntent {
  category: AuditCategory;
  action: string;
}

/**
 * Every write is recorded, plus exports because they remove personal data from
 * the system. Ordinary reads are not: navigation rows already show where an
 * admin went, and a row per GET would bury the writes that matter.
 */
function auditIntent(req: HttpRequest<unknown>): AuditIntent | null {
  if (req.context.get(SKIP_AUDIT_LOG)) return null;
  const method = req.method.toUpperCase();
  if (method !== 'GET') return { category: 'api', action: method };
  if (/export|download/i.test(req.url)) return { category: 'export', action: method };
  return null;
}

/**
 * Split the API path into a resource and, when the URL ends in one, an id —
 * so the viewer can group by resource and filter to a single record.
 * `…/partners/superadmin/leads/57/` → `partners/superadmin/leads` + `57`.
 */
function describe(url: string): { entityType: string; entityId: string | null } {
  const path = url
    .split('?')[0]
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?api\//, '');
  const parts = path.split('/').filter(Boolean);
  const last = parts.at(-1) ?? '';
  const isId = /^\d+$/.test(last) || /^[0-9a-f-]{36}$/i.test(last);
  return {
    entityType: (isId ? parts.slice(0, -1) : parts).join('/'),
    entityId: isId ? last : null,
  };
}

/**
 * Admin Token Interceptor — for requests flagged with the IS_ADMIN_REQUEST
 * HttpContext token, attaches the Supabase access token. Public-site requests
 * pass through unchanged. SKIP_AUTH_TOKEN opts a request out entirely, as that
 * token's contract states ("no Authorization header from any interceptor").
 *
 * It also records admin API calls into the audit log. This is the only place
 * that sees every Django-backed admin call already discriminated from public
 * traffic, which is why the tap lives here. These rows are `source='client'`
 * and are best-effort by nature — a browser cannot audit itself. The
 * tamper-proof half is the Postgres triggers on the Supabase tables; the
 * durable fix for this half is logging inside the Django `partners/*` app.
 */
export const adminTokenInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (!req.context.get(IS_ADMIN_REQUEST) || req.context.get(SKIP_AUTH_TOKEN)) {
    return next(req);
  }

  const adminAuth = inject(AdminAuth);
  const audit = inject(AuditLog);
  const token = adminAuth.getAccessToken();

  const handled = token
    ? next(
        req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        }),
      )
    : next(req);

  const intent = auditIntent(req);
  if (!intent) return handled;

  const { entityType, entityId } = describe(req.urlWithParams);
  const base = { entityType, entityId };

  return handled.pipe(
    tap((event) => {
      // Only the final response — progress events would double-count.
      if (event instanceof HttpResponse) {
        void audit.record(intent.category, intent.action, {
          ...base,
          context: { url: req.urlWithParams, status: event.status, outcome: 'success' },
        });
      }
    }),
    catchError((err: unknown) => {
      // A rejected attempt is exactly what an audit trail should keep: the
      // triggers only ever see writes that succeeded.
      void audit.record(intent.category, intent.action, {
        ...base,
        context: {
          url: req.urlWithParams,
          status: err instanceof HttpErrorResponse ? err.status : 0,
          outcome: 'error',
        },
      });
      return throwError(() => err);
    }),
  );
};
