import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import { TransferState } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Storage } from '../storage/storage';
import { ApiClient } from '../api-client/api-client';
import { environment } from '../../../../../environments/environment';
import {
  AUTH_ROUTES,
  SSO_AUTH_ROUTES,
  SsoSessionData,
  User,
  CurrentPlanData,
} from '../../models/auth.model';
import { HttpContext } from '@angular/common/http';
import { RouteRequest, RouteResponse, SKIP_ERROR_NOTIFICATION } from '../../models/http.model';
import { Logger } from '../logger/logger';

// Type aliases for cleaner usage
type MyProfileResponse = RouteResponse<typeof AUTH_ROUTES.myProfile>;
type CurrentPlanResponse = RouteResponse<typeof AUTH_ROUTES.currentPlan>;
type RefreshTokenRequest = RouteRequest<typeof SSO_AUTH_ROUTES.refreshToken>;
type RefreshTokenResponse = RouteResponse<typeof SSO_AUTH_ROUTES.refreshToken>;

/** TransferState key for user data */
const USER_DATA_KEY = makeStateKey<User | null>(environment.AUTH.transferUserData);
const AUTH_STATUS_KEY = makeStateKey<boolean>(environment.AUTH.transferAuthStatus);

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly storage = inject(Storage);
  private readonly logger = inject(Logger);
  private readonly apiClient = inject(ApiClient);
  private readonly transferState = inject(TransferState);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly isServer = isPlatformServer(this.platformId);

  /**
   * How long the token cookies live. Matches the SSO web refresh-token window
   * (7 days), which is the real upper bound on a session — the access token's
   * own 15-minute life is enforced by the server, not by this cookie.
   */
  private static readonly REFRESH_TOKEN_DAYS = 7;

  /** Handle for the pending proactive refresh, so it can be replaced/cancelled. */
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  // Internal signal to track auth state changes
  private readonly authStateChanged = signal(0);

  // Loading state for profile fetch
  readonly isLoadingProfile = signal(false);

  /**
   * Computed signal that checks if user is authenticated
   * Reads access token from cookies (SSR-safe)
   */
  readonly isAuthenticated = computed(() => {
    // Trigger re-computation when auth state changes
    this.authStateChanged();
    return this.hasValidToken();
  });

  /**
   * Signal to store current user data
   */
  readonly currentUser = signal<User | null>(null);
  readonly currentPlan = signal<CurrentPlanData | null>(null);

  /**
   * Computed signal for quick user checks
   */
  readonly isLoggedIn = computed(() => this.isAuthenticated());

  /** Whether the user currently holds an active subscription. */
  readonly hasActivePlan = computed(() => this.isPlanActive(this.currentPlan()));

  /**
   * Internal subject to queue requests while refreshing
   */
  readonly accessTokenSubject = new BehaviorSubject<string | null>(null);

  /**
   * Signal to indicate if a refresh token request is in progress
   */
  readonly isRefreshing = signal(false);

  constructor() {
    // Initialize user data - use TransferState for SSR/client sync
    this.initializeUserData();
  }

  /**
   * Initialize user data from TransferState or localStorage
   * On server: Load from localStorage (via Storage service) and store in TransferState
   * On client: Load from TransferState first, then fallback to localStorage
   */
  private initializeUserData(): void {
    if (this.isServer) {
      // Server: Read user data and store in TransferState for client
      const userData = this.loadUserFromStorage();
      const isAuth = this.hasValidToken();

      // Store in TransferState for client hydration
      this.transferState.set(USER_DATA_KEY, userData);
      this.transferState.set(AUTH_STATUS_KEY, isAuth);

      if (userData) {
        this.currentUser.set(userData);
      }
    } else if (this.isBrowser) {
      // Browser: Check TransferState first
      const transferredUser = this.transferState.get(USER_DATA_KEY, null);
      const transferredAuth = this.transferState.get(AUTH_STATUS_KEY, false);

      if (transferredUser || transferredAuth) {
        // Use transferred state and remove it
        if (transferredUser) {
          this.currentUser.set(transferredUser);
        }
        this.transferState.remove(USER_DATA_KEY);
        this.transferState.remove(AUTH_STATUS_KEY);
      } else {
        // No transferred state, load from localStorage
        const userData = this.loadUserFromStorage();
        if (userData) {
          this.currentUser.set(userData);
        }
      }
    }
  }

  /**
   * Load user data from localStorage
   */
  private loadUserFromStorage(): User | null {
    const userData = this.storage.getLocal<User>(environment.AUTH.userData);
    if (userData && this.hasValidToken()) {
      return userData;
    }
    return null;
  }

  /**
   * Check if a valid access token exists
   */
  hasValidToken(): boolean {
    const token = this.storage.getCookie(environment.AUTH.accessToken);
    return !!token && token.length > 0;
  }

  /**
   * Get the access token
   */
  getAccessToken(): string | null {
    const token = this.storage.getCookie(environment.AUTH.accessToken);
    return token || null;
  }

  /**
   * Get the refresh token
   */
  getRefreshToken(): string | null {
    const token = this.storage.getCookie(environment.AUTH.refreshToken);
    return token || null;
  }

  /**
   * Fetch user profile from API
   */
  fetchMyProfile(): void {
    if (!this.isBrowser || !this.hasValidToken()) {
      return;
    }

    this.isLoadingProfile.set(true);

    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    this.apiClient
      .get<MyProfileResponse>(AUTH_ROUTES.myProfile.path, { context })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.status_code && response.data) {
            this.setAuthenticated(response.data);
            // Fetch current plan after profile. `fetchCurrentPlan` now returns
            // an Observable (so callers can await/refresh); fire-and-forget
            // here is fine — `takeUntilDestroyed` keeps it bounded.
            this.fetchCurrentPlan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
          }
          this.isLoadingProfile.set(false);
        },
        error: (error) => {
          this.logger.error('Failed to fetch profile', error);
          this.isLoadingProfile.set(false);
        },
      });
  }

  /**
   * Fetches the current plan and propagates it to the `currentPlan` signal.
   * The signal is **always** reset based on the response — including to
   * `null` when the API returns no plan — so consumers (e.g. the header
   * `hasActivePlan` computed) can't end up showing stale post-cancellation
   * or post-expiry data.
   *
   * Returns an Observable so callers (payment-success handlers, the
   * engagement-dialog re-check before opening, etc.) can await the refresh
   * before reading the signal. Errors are swallowed (logged) and resolve to
   * `null` so the caller never has to wire a separate error path.
   */
  fetchCurrentPlan(): Observable<CurrentPlanData | null> {
    if (!this.hasValidToken()) {
      this.setCurrentPlan(null);
      return of(null);
    }

    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    return this.apiClient.get<CurrentPlanResponse>(AUTH_ROUTES.currentPlan.path, { context }).pipe(
      map((response) => response?.data ?? null),
      tap((plan) => this.setCurrentPlan(plan)),
      catchError((err) => {
        this.logger.error('Failed to fetch current plan', err);
        return of<CurrentPlanData | null>(null);
      }),
    );
  }

  /**
   * Set the `currentPlan` signal and mirror its active status to a cookie.
   *
   * The cookie is what makes the synchronous `activePlanGuard` survive a hard
   * refresh: on reload the signal starts as `null` (it's only repopulated by
   * the async `fetchCurrentPlan` that runs after `fetchMyProfile`), so without
   * a persisted snapshot the guard would wrongly bounce an active subscriber
   * back to the plan page. Called on every current-plan API resolution, so the
   * cookie stays in sync with the latest server response.
   */
  private setCurrentPlan(plan: CurrentPlanData | null): void {
    this.currentPlan.set(plan);
    this.storage.setCookie(environment.AUTH.activePlan, this.isPlanActive(plan) ? 'true' : 'false');
  }

  /**
   * Whether a plan payload represents an active subscription. Single source of
   * truth for the "active" check, shared by the cookie mirror and consumers.
   */
  isPlanActive(plan: CurrentPlanData | null): boolean {
    return plan?.subscription_status?.toLowerCase() === 'active';
  }

  /**
   * Read the cached active-plan flag from the cookie. SSR-safe (reads the
   * incoming request's Cookie header on the server). Used as a fallback by
   * `activePlanGuard` when the `currentPlan` signal hasn't been hydrated yet
   * (e.g. immediately after a hard refresh).
   */
  hasActivePlanFromCookie(): boolean {
    return this.storage.getCookie(environment.AUTH.activePlan) === 'true';
  }

  /**
   * Attempt to refresh the access token
   * Returns an Observable of the new access token
   */
  refreshToken(): Observable<string | null> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearAuth();
      return of(null);
    }

    const body: RefreshTokenRequest = {
      refresh_token: refreshToken,
    };

    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    return this.apiClient
      .post<RefreshTokenResponse>(SSO_AUTH_ROUTES.refreshToken.path, body, { context })
      .pipe(
        tap((response) => {
          if (response.status && response.data) {
            this.handleRefreshSuccess(response.data);
          } else {
            this.clearAuth();
          }
        }),
        map((response) => response.data?.token || null),
        catchError((error) => {
          this.logger.error('Token refresh failed', error);
          this.clearAuth();
          return of(null);
        }),
      );
  }

  /**
   * Handle successful token refresh.
   *
   * Both tokens are re-stored, not just the access token. Miles SSO **rotates
   * refresh tokens**: the one we just spent dies within seconds, so keeping
   * the original would make the *next* refresh fail and silently end the
   * session. This is the single most important line in this file.
   */
  private handleRefreshSuccess(session: SsoSessionData): void {
    this.storeTokens(session.token, session.refreshtoken, session.expires_in);

    if (session.user) {
      this.setAuthenticated(session.user);
    }

    // Release any requests queued behind this refresh. The next proactive
    // refresh is already armed by `storeTokens` above.
    this.accessTokenSubject.next(session.token);
  }

  /**
   * Persist the access/refresh token pair after a successful verification.
   *
   * Cookies rather than localStorage so `hasValidToken()` can read them during
   * SSR. Shared by every surface that can log a user in — the login flow
   * (`AuthFacade.verifyOtp`) and the faculty page's OTP auto-login — so the
   * expiry/`secure`/`sameSite` options stay identical across both.
   */
  storeTokens(token: string, refreshToken: string, expiresIn?: number): void {
    // The access token cookie deliberately outlives the token itself. It is a
    // transport for the value, not an expiry mechanism — `hasValidToken()` only
    // asks "do we have something to send", and the server is what decides
    // whether it is still good. A cookie that expired first would log the user
    // out mid-session with a perfectly refreshable session in hand.
    this.storage.setCookie(environment.AUTH.accessToken, token, {
      expires: Auth.REFRESH_TOKEN_DAYS,
      path: '/',
      secure: environment.production,
      sameSite: 'Strict',
    });

    this.storage.setCookie(environment.AUTH.refreshToken, refreshToken, {
      expires: Auth.REFRESH_TOKEN_DAYS,
      path: '/',
      secure: environment.production,
      sameSite: 'Strict',
    });

    if (expiresIn) {
      this.scheduleProactiveRefresh(expiresIn);
    }
  }

  /**
   * Refresh shortly *before* the access token expires.
   *
   * The token is short on purpose — 15 minutes is the target — so waiting for a
   * 401 means every user eats a failed request and a retry at least four times
   * an hour. Refreshing early makes expiry invisible.
   *
   * Only one timer is ever outstanding; each success replaces it. Browser only:
   * there is nothing to keep alive during SSR.
   */
  private scheduleProactiveRefresh(expiresIn: number): void {
    if (!this.isBrowser || !expiresIn) return;

    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // A minute of headroom, and never less than 30s away — a very short token
    // must not put us in a refresh loop.
    const delayMs = Math.max(expiresIn - 60, 30) * 1000;

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (!this.hasValidToken() || this.isRefreshing()) return;

      this.isRefreshing.set(true);
      // Park the queue before the request goes out. Without this, a call that
      // 401s mid-refresh sees `isRefreshing` true, waits on the subject, and is
      // handed the *old* token that is still sitting in it — so it retries with
      // the credential that just failed.
      this.accessTokenSubject.next(null);
      this.refreshToken()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.isRefreshing.set(false),
          error: () => this.isRefreshing.set(false),
        });
    }, delayMs);
  }

  /**
   * Update auth state after login
   */
  setAuthenticated(user: User): void {
    this.currentUser.set(user);
    this.storage.setLocal(environment.AUTH.userData, user);
    this.notifyAuthStateChange();
  }

  /**
   * Clear auth state on logout
   */
  clearAuth(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.currentUser.set(null);
    this.currentPlan.set(null);
    this.storage.deleteCookie(environment.AUTH.accessToken);
    this.storage.deleteCookie(environment.AUTH.refreshToken);
    this.storage.deleteCookie(environment.AUTH.activePlan);
    this.storage.removeLocal(environment.AUTH.userData);
    this.notifyAuthStateChange();
    this.accessTokenSubject.next(null);
  }

  /**
   * Trigger re-evaluation of auth state
   */
  notifyAuthStateChange(): void {
    this.authStateChanged.update((v) => v + 1);
  }
}
