import { HttpContext } from '@angular/common/http';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  makeStateKey,
  PLATFORM_ID,
  Service,
  signal,
  TransferState,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { Storage } from '../storage/storage';
import { Logger } from '../logger/logger';
import { ApiClient } from '../api-client/api-client';
import { CAIRA } from '../../http/caira.endpoints';
import { SKIP_AUTH_REFRESH, SKIP_ERROR_NOTIFICATION } from '../../models/caira/envelope.model';
import {
  CairaUser,
  StatusResponse,
  isProfileComplete,
  toCairaUser,
} from '../../models/caira/auth.model';
import { environment } from '../../../../../environments/environment';

/** Survives the SSR→browser handover so the header doesn't flash logged-out. */
const USER_DATA_KEY = makeStateKey<CairaUser | null>(environment.AUTH.transferUserData);
const AUTH_STATUS_KEY = makeStateKey<boolean>(environment.AUTH.transferAuthStatus);

/**
 * Token lifecycle, the current user, and the signals every guard reads.
 *
 * ponytail: `fetchCurrentPlan` / `currentPlan` / `hasActivePlan` have **no
 * CAIRA counterpart at all** — there is no plan or subscription model in the
 * backend. Access is `User.enrolled` tag membership, surfaced per-course as
 * `course_is_locked`. They stay so `activePlanGuard` and the header keep
 * compiling; swapping them for an entitlement check is its own decision and is
 * tracked in the gap register.
 */
@Service()
export class Auth {
  private readonly storage = inject(Storage);
  private readonly logger = inject(Logger);
  private readonly api = inject(ApiClient);
  private readonly transferState = inject(TransferState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly isServer = isPlatformServer(this.platformId);

  /** Bumped on every auth mutation so `isAuthenticated` recomputes. */
  private readonly authStateChanged = signal(0);

  readonly isLoadingProfile = signal(false);

  readonly isAuthenticated = computed(() => {
    this.authStateChanged();
    return this.hasValidToken();
  });

  readonly currentUser = signal<CairaUser | null>(null);
  readonly currentPlan = signal<any | null>(null);

  readonly isLoggedIn = computed(() => this.isAuthenticated());

  /**
   * Whether the learner has enough profile to use the app. Drives
   * `isExistingUserGuard`.
   *
   * Derived from `v2/status`, **not** from a login response's `onboarding`
   * flag: #33 hardcodes that to `true`, so it would let an incomplete profile
   * straight through.
   */
  readonly isProfileComplete = computed(() => isProfileComplete(this.currentUser()));

  /** Whether the user currently holds an active subscription. */
  readonly hasActivePlan = computed(() => this.isPlanActive(this.currentPlan()));

  readonly accessTokenSubject = new BehaviorSubject<string | null>(null);

  readonly isRefreshing = signal(false);

  constructor() {
    this.initializeUserData();
  }

  /**
   * Bridge the user across the SSR→browser boundary.
   *
   * On the server `Storage` reads the incoming request's Cookie header, so an
   * authenticated SSR pass already knows who the user is; stashing that in
   * `TransferState` stops the browser from re-deriving it and flashing a
   * logged-out header before hydration.
   *
   * Course data deliberately does **not** use this — `withHttpTransferCacheOptions`
   * in `app.config.ts` already carries authenticated GETs over. Two mechanisms,
   * two jobs; don't unify them.
   */
  private initializeUserData(): void {
    if (this.isServer) {
      const userData = this.loadUserFromStorage();
      this.transferState.set(USER_DATA_KEY, userData);
      this.transferState.set(AUTH_STATUS_KEY, this.hasValidToken());
      if (userData) this.currentUser.set(userData);
      return;
    }

    if (!this.isBrowser) return;

    const transferred = this.transferState.get(USER_DATA_KEY, null);
    const transferredAuth = this.transferState.get(AUTH_STATUS_KEY, false);

    if (transferred || transferredAuth) {
      if (transferred) this.currentUser.set(transferred);
      // Read once, then drop — leaving them in inflates every subsequent
      // navigation's serialized state.
      this.transferState.remove(USER_DATA_KEY);
      this.transferState.remove(AUTH_STATUS_KEY);
      return;
    }

    const userData = this.loadUserFromStorage();
    if (userData) this.currentUser.set(userData);
  }

  private loadUserFromStorage(): CairaUser | null {
    const userData = this.storage.getLocal<CairaUser>(environment.AUTH.userData);
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

  /**
   * Load the signed-in user from `GET v2/status` (#42) into `currentUser`.
   *
   * Browser-only and fire-and-forget: the header and guards read the signal, so
   * nothing awaits this. The SSR pass is served by `TransferState` instead.
   *
   * Failure is swallowed to a log. A `v2/status` outage should not log the user
   * out — the token is still valid, and every other endpoint still works.
   */
  fetchMyProfile(): void {
    if (!this.isBrowser || !this.hasValidToken()) return;

    this.isLoadingProfile.set(true);
    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

    this.api
      .get<StatusResponse>(CAIRA.status, { context })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.data) this.setAuthenticated(toCairaUser(response.data));
          this.isLoadingProfile.set(false);
        },
        error: (error: unknown) => {
          this.logger.error('Failed to fetch profile', error);
          this.isLoadingProfile.set(false);
        },
      });
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

  /**
   * Exchange the stored refresh token for a new access token.
   *
   * Resolves to the new token, or `null` after clearing the session. Never
   * errors — `authInterceptor` treats `null` as "give up", so a caller does not
   * need a separate error path.
   *
   * Two CAIRA quirks shape this:
   *
   * - The refresh token travels in the **JSON body**, not an `Authorization`
   *   header. This is the only auth call that works that way.
   * - The response body is **fully opaque**: the reference notes that no field
   *   of it is named anywhere in the backend, because the view forwards the
   *   external SSO's JSON verbatim and only checks that it is a dict. So the
   *   token is looked for in the shapes the sibling login endpoints use rather
   *   than read from one fixed path, and a miss is treated as a failed refresh.
   */
  refreshToken(): Observable<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuth();
      return of(null);
    }

    const context = new HttpContext()
      // Without this the interceptor would try to refresh the refresh call.
      .set(SKIP_AUTH_REFRESH, true)
      // An expired session is not an error the user needs a toast about.
      .set(SKIP_ERROR_NOTIFICATION, true);

    return this.api.post<unknown>(CAIRA.refresh, { refresh_token: refreshToken }, { context }).pipe(
      map((response) => extractAccessToken(response)),
      tap((token) => {
        if (token) {
          this.storage.setCookie(environment.AUTH.accessToken, token, {
            expires: 1,
            path: '/',
            secure: environment.production,
            sameSite: 'Strict',
          });
          this.notifyAuthStateChange();
          // Releases every request queued in `authInterceptor`.
          this.accessTokenSubject.next(token);
        } else {
          this.logger.warn('Refresh returned no recognisable token; clearing session');
          this.clearAuth();
        }
      }),
      catchError((error: unknown) => {
        // `refresh` collapses every local failure to 400, so a bad token and
        // an unreachable SSO are indistinguishable here. Both mean the same
        // thing to us: the session is over.
        this.logger.error('Token refresh failed', error);
        this.clearAuth();
        return of(null);
      }),
    );
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

  setAuthenticated(user: CairaUser): void {
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

/**
 * Pull an access token out of the refresh response.
 *
 * The endpoint is documented as opaque — it forwards the SSO's body verbatim
 * and the backend reads none of its fields — so there is no single correct
 * path. These are the shapes the sibling login endpoints (#33, #35) are
 * documented to return, most specific first. Returning `null` is a valid
 * outcome, not a parse failure: it means the session cannot be renewed.
 *
 * P0 captures the real response against UAT; when it is known, collapse this to
 * that one path and delete the rest.
 */
function extractAccessToken(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) return null;
  const body = response as Record<string, unknown>;
  const result = (body['result'] ?? {}) as Record<string, unknown>;

  for (const candidate of [
    result['token'],
    result['access_token'],
    body['token'],
    body['access_token'],
  ]) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return null;
}
