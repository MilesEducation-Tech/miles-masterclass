import { HttpContext, HttpContextToken, HttpHeaders, HttpParams } from '@angular/common/http';

/**
 * When set to `true` on a request's HttpContext, the global error interceptor
 * will NOT show a toast notification for that request's error.
 * Use this for background/silent requests that handle errors locally.
 */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);

/**
 * When set to `true` on a request's HttpContext, the request is treated as an
 * admin-panel call: the public-app auth interceptor skips its handling, and
 * the admin token interceptor attaches the Supabase access token instead.
 */
export const IS_ADMIN_REQUEST = new HttpContextToken<boolean>(() => false);

/**
 * When set to `true` on a request's HttpContext, NO `Authorization` header is
 * attached by any interceptor — neither the public-app JWT from cookies nor
 * the Supabase admin token. Use this for backend endpoints that do their own
 * auth (or are intentionally open) and where attaching an unrelated token
 * would cause a 401.
 */
export const SKIP_AUTH_TOKEN = new HttpContextToken<boolean>(() => false);

/**
 * When set to `true` on a request's HttpContext, an admin request is NOT
 * recorded in the admin audit log. Only for calls that would be pure noise —
 * polling, or a request the audit logger itself makes. Never set it on a
 * mutation: the point of the log is that writes cannot opt out quietly.
 */
export const SKIP_AUDIT_LOG = new HttpContextToken<boolean>(() => false);

/**
 * When set to `true` on a request's HttpContext, the request is treated as a
 * call to a FOREIGN origin (a third-party API, not the Miles backend). Every
 * app interceptor steps aside: no `x-app-type` / `x-platform` / `x-country-code`
 * headers, no `Authorization`, no global loading spinner, and no 401 token
 * refresh. Set it for any absolute third-party URL — the app headers would
 * otherwise force a CORS preflight the foreign host has no reason to allow, and
 * the bearer token would leak off-platform.
 */
export const IS_EXTERNAL_REQUEST = new HttpContextToken<boolean>(() => false);

export interface RequestOptions {
  body?: any;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  observe?: 'body' | 'events' | 'response';
  params?:
    HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  reportUploadProgress?: boolean;
  reportDownloadProgress?: boolean;
  responseType?: 'json' | 'arraybuffer' | 'blob' | 'text';
  withCredentials?: boolean;
}

/**
 * HTTP-related type definitions for API route configuration.
 * Provides type-safe route definitions with request/response type extraction.
 */

// HTTP Method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Route configuration interface with generic types for request, response, headers, and params.
 * Use this to define API routes with full type safety.
 *
 * @example
 * const myRoute = {
 *   path: 'api/users/:id',
 *   method: 'GET',
 * } as RouteConfig<void, User[], { 'X-API-Key': string }, { id: number }>;
 */
export interface RouteConfig<
  TRequest = unknown,
  TResponse = unknown,
  THeaders extends Record<string, string | string[]> = Record<string, string | string[]>,
  TParams extends Record<any, any> = Record<any, any>,
> {
  path: string;
  method: HttpMethod;
  headers?: THeaders;
  params?: Partial<TParams>;
  _requestType?: TRequest;
  _responseType?: TResponse;
  _headersType?: THeaders;
  _paramsType?: TParams;
}

/**
 * Utility type to extract the request type from a RouteConfig.
 *
 * @example
 * type MyRequest = RouteRequest<typeof SSO_AUTH_ROUTES.sendOtp>; // SsoSendOtpRequest
 */
export type RouteRequest<T extends RouteConfig> =
  T extends RouteConfig<infer R, unknown> ? R : never;

/**
 * Utility type to extract the response type from a RouteConfig.
 *
 * @example
 * type MyResponse = RouteResponse<typeof SSO_AUTH_ROUTES.sendOtp>; // CommonResponse<SsoSendOtpResult>
 */
export type RouteResponse<T extends RouteConfig> =
  T extends RouteConfig<unknown, infer R> ? R : never;

/**
 * Utility type to extract the headers type from a RouteConfig.
 *
 * @example
 * type MyHeaders = RouteHeaders<typeof API_ROUTES.protected>; // { 'Authorization': string }
 */
export type RouteHeaders<T extends RouteConfig> =
  T extends RouteConfig<any, any, infer H, any> ? H : never;

/**
 * Utility type to extract the params type from a RouteConfig.
 *
 * @example
 * type MyParams = RouteParams<typeof API_ROUTES.getCourse>; // { id: number }
 */
export type RouteParams<T extends RouteConfig> =
  T extends RouteConfig<any, any, any, infer P> ? P : never;

export interface PaginationData {
  total_count: number;
  current_page_number: number;
  next_page: string;
  previous_page: string;
}

export interface CommonResponse<T> {
  data: T;
  pagination_data?: PaginationData;
  status: boolean;
  message: string;
}
