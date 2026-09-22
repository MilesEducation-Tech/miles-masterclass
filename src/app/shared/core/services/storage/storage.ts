import { Injectable, PLATFORM_ID, REQUEST, inject } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { CookieService } from 'ngx-cookie-service';
import { CookieOptions } from '../../models/storage.model';
import { environment } from '@env/environment';
import { generateUUID } from '@shared/utils/uuid';

/**
 * Unified Storage Service for managing cookies, localStorage, and sessionStorage.
 * SSR-safe implementation using ngx-cookie-service for cookies.
 * On the server, cookies are read from the incoming HTTP request headers.
 */
@Injectable({
  providedIn: 'root',
})
export class Storage {
  private readonly cookieService = inject(CookieService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly request = inject(REQUEST, { optional: true });

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private get isServer(): boolean {
    return isPlatformServer(this.platformId);
  }

  // ==================== COOKIE METHODS ====================

  /**
   * Get a cookie value by key.
   * On the server, reads from the incoming request's Cookie header.
   */
  getCookie(key: string): string {
    if (this.isServer && this.request) {
      return this.getServerCookie(key);
    }
    return this.cookieService.get(key);
  }

  /**
   * Parse cookies from the server request headers
   */
  private getServerCookie(key: string): string {
    const cookieHeader = this.request?.headers?.get('cookie') || '';
    const cookies = this.parseCookies(cookieHeader);
    return cookies[key] || '';
  }

  /**
   * Parse a cookie header string into an object
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name) {
        cookies[name] = decodeURIComponent(rest.join('='));
      }
    });

    return cookies;
  }

  /**
   * Get all cookies as an object
   */
  getAllCookies(): Record<string, string> {
    return this.cookieService.getAll();
  }

  /**
   * Check if a cookie exists.
   * On the server, checks the incoming request's Cookie header.
   */
  hasCookie(key: string): boolean {
    if (this.isServer && this.request) {
      return !!this.getServerCookie(key);
    }
    return this.cookieService.check(key);
  }

  /**
   * Set a cookie
   */
  setCookie(key: string, value: string, options: CookieOptions = {}): void {
    this.cookieService.set(
      key,
      value,
      options.expires,
      options.path ?? '/',
      options.domain,
      options.secure,
      options.sameSite ?? 'Lax',
    );
  }

  /**
   * Delete a cookie
   */
  deleteCookie(key: string, path = '/', domain?: string): void {
    this.cookieService.delete(key, path, domain);
  }

  /**
   * Delete all cookies
   */
  deleteAllCookies(path = '/', domain?: string): void {
    this.cookieService.deleteAll(path, domain);
  }

  // ==================== LOCAL STORAGE METHODS ====================

  /**
   * Get an item from localStorage
   */
  getLocal<T>(key: string): T | null {
    if (!this.isServer) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      }
    }
    return null;
  }

  /**
   * Set an item in localStorage
   */
  setLocal<T>(key: string, value: T): void {
    if (!this.isServer) {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
    }
  }

  /**
   * Remove an item from localStorage
   */
  removeLocal(key: string): void {
    if (!this.isServer) {
      localStorage.removeItem(key);
    }
  }

  /**
   * Check if an item exists in localStorage
   */
  hasLocal(key: string): boolean {
    if (!this.isServer) {
      return localStorage.getItem(key) !== null;
    }
    return false;
  }

  /**
   * Clear all localStorage
   */
  clearLocal(): void {
    if (!this.isServer) {
      localStorage.clear();
    }
  }

  // ==================== SESSION STORAGE METHODS ====================

  /**
   * Get an item from sessionStorage
   */
  getSession<T = string>(key: string): T | null {
    if (!this.isBrowser) return null;

    const value = sessionStorage.getItem(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  /**
   * Set an item in sessionStorage
   */
  setSession<T>(key: string, value: T): void {
    if (!this.isBrowser) return;

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    sessionStorage.setItem(key, serialized);
  }

  /**
   * Get (or lazily create + persist) the browser session id used to tie a
   * signup back to its UTM campaign. Stored in session storage under the env
   * key so the id is stable across the landing (UTM), auth, and webinar
   * registration flows within a session. Returns a fresh uuid on the server
   * (no session storage) — callers only send it from browser-side flows.
   */
  getOrCreateBrowserSessionId(): string {
    const key = environment.AUTH.browserSessionId;
    let sessionId = this.getSession<string>(key);
    if (!sessionId) {
      sessionId = generateUUID();
      this.setSession(key, sessionId);
    }
    return sessionId;
  }

  /**
   * Remove an item from sessionStorage
   */
  removeSession(key: string): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(key);
  }

  /**
   * Check if an item exists in sessionStorage
   */
  hasSession(key: string): boolean {
    if (!this.isBrowser) return false;
    return sessionStorage.getItem(key) !== null;
  }

  /**
   * Clear all sessionStorage
   */
  clearSession(): void {
    if (!this.isBrowser) return;
    sessionStorage.clear();
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clear all storage (cookies, localStorage, sessionStorage)
   */
  clearAll(cookiePath = '/', cookieDomain?: string): void {
    this.deleteAllCookies(cookiePath, cookieDomain);
    this.clearLocal();
    this.clearSession();
  }
}
