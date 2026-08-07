import { Injectable, computed, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Storage } from '../storage/storage';
import { environment } from '../../../../../environments/environment';

/**
 * ponytail: local-only auth stub. The Django token lifecycle (profile fetch,
 * current-plan fetch, refresh-token rotation, SSR TransferState hydration) was
 * removed with the backend strip. The public surface below is unchanged, so
 * every guard, the layout header and `user-avatar-menu` keep compiling and the
 * logged-in design is still reachable by setting the access-token cookie.
 *
 * To reconnect: reinstate `fetchMyProfile` / `fetchCurrentPlan` / `refreshToken`
 * against the new backend and have them call `setAuthenticated` / `setCurrentPlan`.
 */
@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly storage = inject(Storage);

  /** Bumped on every auth mutation so `isAuthenticated` recomputes. */
  private readonly authStateChanged = signal(0);

  readonly isLoadingProfile = signal(false);

  readonly isAuthenticated = computed(() => {
    this.authStateChanged();
    return this.hasValidToken();
  });

  readonly currentUser = signal<any | null>(null);
  readonly currentPlan = signal<any | null>(null);

  readonly isLoggedIn = computed(() => this.isAuthenticated());

  /** Whether the user currently holds an active subscription. */
  readonly hasActivePlan = computed(() => this.isPlanActive(this.currentPlan()));

  readonly accessTokenSubject = new BehaviorSubject<string | null>(null);

  readonly isRefreshing = signal(false);

  constructor() {
    const userData = this.loadUserFromStorage();
    if (userData) {
      this.currentUser.set(userData);
    }
  }

  private loadUserFromStorage(): any | null {
    const userData = this.storage.getLocal<any>(environment.AUTH.userData);
    return userData && this.hasValidToken() ? userData : null;
  }

  hasValidToken(): boolean {
    const token = this.storage.getCookie(environment.AUTH.accessToken);
    return !!token && token.length > 0;
  }

  getAccessToken(): string | null {
    return this.storage.getCookie(environment.AUTH.accessToken) || null;
  }

  getRefreshToken(): string | null {
    return this.storage.getCookie(environment.AUTH.refreshToken) || null;
  }

  /** ponytail: no-op until the new backend exposes a profile endpoint. */
  fetchMyProfile(): void {
    // intentionally empty
  }

  /**
   * ponytail: resolves to the locally-held plan (always `null` until something
   * calls `setAuthenticated`). Kept returning an Observable because callers —
   * payment-success handlers, the engagement dialog — await it before reading
   * the signal.
   */
  fetchCurrentPlan(): Observable<any | null> {
    return of(this.currentPlan());
  }

  /**
   * Set the `currentPlan` signal and mirror its active status to a cookie.
   *
   * The cookie is what makes the synchronous `activePlanGuard` survive a hard
   * refresh, since the signal starts as `null` on every reload.
   */
  setCurrentPlan(plan: any | null): void {
    this.currentPlan.set(plan);
    this.storage.setCookie(environment.AUTH.activePlan, this.isPlanActive(plan) ? 'true' : 'false');
  }

  /**
   * Whether a plan payload represents an active subscription. Single source of
   * truth for the "active" check, shared by the cookie mirror and consumers.
   */
  isPlanActive(plan: any | null): boolean {
    return plan?.subscription_status?.toLowerCase() === 'active';
  }

  /**
   * Read the cached active-plan flag from the cookie. SSR-safe (reads the
   * incoming request's Cookie header on the server). Used by `activePlanGuard`
   * when the `currentPlan` signal hasn't been hydrated yet.
   */
  hasActivePlanFromCookie(): boolean {
    return this.storage.getCookie(environment.AUTH.activePlan) === 'true';
  }

  /** ponytail: no refresh endpoint to call — resolves to the current token. */
  refreshToken(): Observable<string | null> {
    return of(this.getAccessToken());
  }

  /**
   * Persist the access/refresh token pair.
   *
   * Cookies rather than localStorage so `hasValidToken()` can read them during
   * SSR.
   */
  storeTokens(token: string, refreshToken: string): void {
    this.storage.setCookie(environment.AUTH.accessToken, token, {
      expires: 1, // 1 day
      path: '/',
      secure: environment.production,
      sameSite: 'Strict',
    });

    this.storage.setCookie(environment.AUTH.refreshToken, refreshToken, {
      expires: 7, // 7 days
      path: '/',
      secure: environment.production,
      sameSite: 'Strict',
    });
  }

  setAuthenticated(user: any): void {
    this.currentUser.set(user);
    this.storage.setLocal(environment.AUTH.userData, user);
    this.notifyAuthStateChange();
  }

  clearAuth(): void {
    this.currentUser.set(null);
    this.currentPlan.set(null);
    this.storage.deleteCookie(environment.AUTH.accessToken);
    this.storage.deleteCookie(environment.AUTH.refreshToken);
    this.storage.deleteCookie(environment.AUTH.activePlan);
    this.storage.removeLocal(environment.AUTH.userData);
    this.notifyAuthStateChange();
    this.accessTokenSubject.next(null);
  }

  notifyAuthStateChange(): void {
    this.authStateChanged.update((v) => v + 1);
  }
}
