import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  RequestOptions,
  RouteConfig,
  RouteParams,
  RouteRequest,
  RouteResponse,
} from '../../models/http.model';
import { environment } from '@env/environment';

/**
 * Resolves a path against `BASE_API_URL`, leaving absolute URLs alone.
 *
 * Exported as a free function because `httpResource` needs a URL string while
 * commands go through `ApiClient` — both must resolve the base identically, and
 * two copies of this rule would eventually disagree.
 */
export function apiUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${environment.BASE_API_URL}${url}`;
}

@Service()
export class ApiClient {
  private readonly http = inject(HttpClient);

  /**
   * Issue a request described by a `RouteConfig` entry.
   *
   * This is what makes a route registry load-bearing instead of decorative: the
   * path AND the verb come from the entry, and the body, params and response
   * are all typed off it. Passing the wrong body shape or a param the route
   * does not declare is a compile error rather than a 400 at runtime.
   *
   * Prefer this over the bare verb methods below for any endpoint that has a
   * registry entry.
   */
  call<R extends RouteConfig>(
    route: R,
    body?: RouteRequest<R>,
    options?: Omit<RequestOptions, 'body'> & { params?: Partial<RouteParams<R>> },
  ): Observable<RouteResponse<R>> {
    return this.http.request(route.method, apiUrl(route.path), {
      body: body ?? null,
      ...options,
    } as never) as Observable<RouteResponse<R>>;
  }

  get<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.get(apiUrl(url), options as never) as Observable<T>;
  }

  post<T>(url: string, body: unknown | null, options?: RequestOptions): Observable<T> {
    return this.http.post(apiUrl(url), body, options as never) as Observable<T>;
  }

  put<T>(url: string, body: unknown | null, options?: RequestOptions): Observable<T> {
    return this.http.put(apiUrl(url), body, options as never) as Observable<T>;
  }

  patch<T>(url: string, body: unknown | null, options?: RequestOptions): Observable<T> {
    return this.http.patch(apiUrl(url), body, options as never) as Observable<T>;
  }

  delete<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.delete(apiUrl(url), options as never) as Observable<T>;
  }

  /**
   * Generic request method to handle any HTTP method.
   * Useful for dynamic requests or less common methods (HEAD, OPTIONS, etc).
   */
  request<T>(method: string, url: string, options?: RequestOptions): Observable<T> {
    return this.http.request(method, apiUrl(url), {
      body: options?.body,
      ...options,
    } as never) as Observable<T>;
  }
}
