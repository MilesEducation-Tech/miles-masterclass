import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RequestOptions } from '../../models/caira/envelope.model';
import { environment } from '../../../../../environments/environment';

/**
 * The only HTTP entry point for CAIRA. Components call facades; facades call
 * this. Nothing in a feature injects `HttpClient` directly (AGENTS.md §3).
 *
 * Deliberately dumb — it resolves a URL and delegates. Auth headers, the
 * loading bar, token refresh and error classification all live in the
 * interceptor chain, so they apply uniformly and cannot be forgotten at a call
 * site. Response envelopes are unwrapped in the facade (AGENTS.md §5): CAIRA
 * has six of them and no reliable way to tell them apart from the body alone,
 * so guessing here would be worse than reading the right key there.
 *
 * The one documented exception to "everything goes through ApiClient" is a
 * non-CAIRA host — `blog-api.ts` injects `HttpClient` for WordPress because it
 * needs `observe: 'response'` for the `X-WP-Total` pagination headers.
 */
@Service()
export class ApiClient {
  private readonly http = inject(HttpClient);

  /**
   * Relative paths get `BASE_API_URL` prepended; absolute ones pass through
   * untouched so callers can hit S3, CloudFront or WordPress with the same API.
   */
  private resolveUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${environment.BASE_API_URL}${url}`;
  }

  get<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.get(this.resolveUrl(url), asHttpOptions(options)) as Observable<T>;
  }

  post<T>(url: string, body: unknown | null, options?: RequestOptions): Observable<T> {
    return this.http.post(this.resolveUrl(url), body, asHttpOptions(options)) as Observable<T>;
  }

  put<T>(url: string, body: unknown | null, options?: RequestOptions): Observable<T> {
    return this.http.put(this.resolveUrl(url), body, asHttpOptions(options)) as Observable<T>;
  }

  patch<T>(url: string, body: unknown | null, options?: RequestOptions): Observable<T> {
    return this.http.patch(this.resolveUrl(url), body, asHttpOptions(options)) as Observable<T>;
  }

  delete<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.delete(this.resolveUrl(url), asHttpOptions(options)) as Observable<T>;
  }

  /** Escape hatch for verbs the five above do not cover (HEAD, OPTIONS). */
  request<T>(method: string, url: string, options?: RequestOptions): Observable<T> {
    return this.http.request(method, this.resolveUrl(url), {
      body: options?.body,
      ...asHttpOptions(options),
    }) as Observable<T>;
  }

  /**
   * Absolute URL for a CAIRA path. Only for cases that legitimately bypass
   * `HttpClient` — an `<a href>` to a certificate, or a QR payload. Not a way
   * to hand-roll a fetch and skip the interceptors.
   */
  absoluteUrl(path: string): string {
    return this.resolveUrl(path);
  }
}

/**
 * `HttpClient`'s overloads are keyed on literal types for `observe` and
 * `responseType`, so a widened options object does not match any of them. The
 * old client cast each call site to `any`; casting once here keeps that off the
 * six public methods.
 */
function asHttpOptions(options?: RequestOptions): Record<string, unknown> {
  return (options ?? {}) as Record<string, unknown>;
}
