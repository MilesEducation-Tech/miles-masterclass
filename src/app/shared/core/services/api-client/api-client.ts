import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RequestOptions } from '../../models/http.model';
import { environment } from '../../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiClient {
  constructor(private http: HttpClient) {}

  /**
   * Resolves URL by prepending BASE_API_URL if the URL is relative
   */
  private resolveUrl(url: string): string {
    // If URL is already absolute (starts with http:// or https://), use as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Otherwise, prepend the base API URL
    return `${environment.BASE_API_URL}${url}`;
  }

  get<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.get(this.resolveUrl(url), options as any) as Observable<T>;
  }

  post<T>(url: string, body: any | null, options?: RequestOptions): Observable<T> {
    return this.http.post(this.resolveUrl(url), body, options as any) as Observable<T>;
  }

  put<T>(url: string, body: any | null, options?: RequestOptions): Observable<T> {
    return this.http.put(this.resolveUrl(url), body, options as any) as Observable<T>;
  }

  patch<T>(url: string, body: any | null, options?: RequestOptions): Observable<T> {
    return this.http.patch(this.resolveUrl(url), body, options as any) as Observable<T>;
  }

  delete<T>(url: string, options?: RequestOptions): Observable<T> {
    return this.http.delete(this.resolveUrl(url), options as any) as Observable<T>;
  }

  /**
   * Generic request method to handle any HTTP method.
   * Useful for dynamic requests or less common methods (HEAD, OPTIONS, etc).
   */
  request<T>(method: string, url: string, options?: RequestOptions): Observable<T> {
    return this.http.request(method, this.resolveUrl(url), {
      body: options?.body,
      ...options,
    } as any) as Observable<T>;
  }
}
