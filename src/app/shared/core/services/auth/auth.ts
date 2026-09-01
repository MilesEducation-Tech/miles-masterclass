import { HttpContext, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
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

/**
 * Token lifecycle and the current user.
 *
 * The **access token is the reactive root**. Everything else derives from it:
 * `isAuthenticated` is a computed over it, and the profile is an
 * `httpResource` keyed on it. Signing in or out changes one signal and the rest
 * follows, with no imperative fetch call and no state-syncing effect.
 *
 * Keying on the token rather than on "auth changed" is what makes this safe.
 * An earlier version bumped a counter inside `setAuthenticated`; a resource
 * keyed on that counter would have re-fired on its own result and looped
 * forever. The token does not change when the profile arrives, so it cannot.
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

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The reactive root. Seeded from the cookie — which `Storage` reads off the
   * incoming request during SSR, so an authenticated server render starts with
   * the token already in hand.
   */
  private readonly accessToken = signal<string | null>(
    this.storage.getCookie(environment.AUTH.accessToken) || null,
  );

  /**
   * Identity from the login response, available before `v2/status` resolves.
   * The login payload carries a name and avatar but no email, so this is a
   * stopgap that lets the header render immediately rather than the truth.
   */
  private readonly seededUser = signal<CairaUser | null>(null);

  /**
   * #42 · `GET v2/status`.
   *
   * Runs on the server too. That is deliberate: `httpResource` registers a
   * `PendingTasks` entry so SSR waits for it, and it participates in the HTTP
   * transfer cache (`includeRequestsWithAuthHeaders: true` in `app.config.ts`),
   * so the browser reuses the server's response instead of re-requesting.
   * That replaces the hand-rolled `TransferState` bridge this service used to
   * carry — same outcome, none of the code.
   */
  private readonly profile = httpResource<StatusResponse | undefined>(
    () => (this.accessToken() ? this.api.absoluteUrl(CAIRA.status) : undefined),
    { defaultValue: undefined },
  );

  readonly isLoadingProfile = this.profile.isLoading;

  /** True the moment a token exists — it does not wait for the profile. */
  readonly isAuthenticated = computed(() => !!this.accessToken());
  readonly isLoggedIn = this.isAuthenticated;

  /**
   * The authoritative profile once `v2/status` lands, the login seed before
   * that, and the last persisted copy on a cold start.
   */
  readonly currentUser = computed<CairaUser | null>(() => {
    // `error()` first — `value()` throws on an errored resource, and this
    // computed feeds the header on every page.
    const data = this.profile.error() ? undefined : this.profile.value()?.data;
    if (data) return toCairaUser(data);
    return this.seededUser();
  });

  /**
   * Whether the learner has enough profile to use the app. Drives
   * `isExistingUserGuard`.
   *
   * Derived from `v2/status`, **not** from a login response's `onboarding`
   * flag: #33 hardcodes that to `true`, so it would let an incomplete profile
   * straight through.
   */
  readonly isProfileComplete = computed(() => isProfileComplete(this.currentUser()));

  readonly currentPlan = signal<any | null>(null);
  readonly hasActivePlan = computed(() => this.isPlanActive(this.currentPlan()));

  readonly accessTokenSubject = new BehaviorSubject<string | null>(null);
  readonly isRefreshing = signal(false);

  constructor() {
    // Cold start with a token but no server round-trip yet (offline, or the
    // profile request still in flight): show the last known user rather than
    // an empty header.
    const cached = this.storage.getLocal<CairaUser>(environment.AUTH.userData);
    if (cached && this.accessToken()) this.seededUser.set(cached);
  }

  hasValidToken(): boolean {
    return !!this.accessToken();
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.storage.getCookie(environment.AUTH.refreshToken) || null;
  }

  /**
   * Force a profile re-read. Rarely needed — the resource refetches on its own
   * whenever the token changes — but a profile *save* changes the data without
   * changing the token, so that path asks explicitly.
   */
  fetchMyProfile(): void {
    if (this.isBrowser && this.accessToken()) this.profile.reload();
  }

  /**
   * ponytail: resolves to the locally-held plan (always `null`). Kept returning
   * an Observable because callers — payment-success handlers, the engagement
   * dialog — await it before reading the signal.
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

  isPlanActive(plan: any | null): boolean {
    return plan?.subscription_status?.toLowerCase() === 'active';
  }

  hasActivePlanFromCookie(): boolean {
    return this.storage.getCookie(environment.AUTH.activePlan) === 'true';
  }

  /**
   * Exchange the stored refresh token for a new access token.
   *
   * Resolves to the new token, or `null` after clearing the session. Never
   * errors — `authInterceptor` treats `null` as "give up".
   *
   * Two CAIRA quirks shape this:
   *
   * - The refresh token travels in the **JSON body**, not an `Authorization`
   *   header. This is the only auth call that works that way.
   * - The response is **fully opaque**: the view forwards the SSO's JSON and
   *   reads none of it, so the token is looked for in the shapes the sibling
   *   login endpoints use and a miss counts as a failed refresh.
   */
  refreshToken(): Observable<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuth();
      return of(null);
    }

    const context = new HttpContext()
      .set(SKIP_AUTH_REFRESH, true)
      .set(SKIP_ERROR_NOTIFICATION, true);

    return this.api.post<unknown>(CAIRA.refresh, { refresh_token: refreshToken }, { context }).pipe(
      map((response) => extractAccessToken(response)),
      tap((token) => {
        if (token) {
          this.writeAccessToken(token);
          // Releases every request queued in `authInterceptor`.
          this.accessTokenSubject.next(token);
        } else {
          this.logger.warn('Refresh returned no recognisable token; clearing session');
          this.clearAuth();
        }
      }),
      catchError((error: unknown) => {
        // `refresh` collapses every local failure to 400, so a bad token and an
        // unreachable SSO are indistinguishable. Both mean the session is over.
        this.logger.error('Token refresh failed', error);
        this.clearAuth();
        return of(null);
      }),
    );
  }

  /**
   * Persist the token pair. Cookies rather than localStorage so the token is
   * readable during SSR.
   */
  storeTokens(token: string, refreshToken: string): void {
    this.writeAccessToken(token);
    this.storage.setCookie(environment.AUTH.refreshToken, refreshToken, {
      expires: 7,
      path: '/',
      secure: environment.production,
      sameSite: 'Strict',
    });
  }

  /**
   * Seed the user from a login response. The profile resource overwrites this
   * as soon as `v2/status` answers.
   */
  setAuthenticated(user: CairaUser): void {
    this.seededUser.set(user);
    this.storage.setLocal(environment.AUTH.userData, user);
  }

  clearAuth(): void {
    this.seededUser.set(null);
    this.currentPlan.set(null);
    this.storage.deleteCookie(environment.AUTH.accessToken);
    this.storage.deleteCookie(environment.AUTH.refreshToken);
    this.storage.deleteCookie(environment.AUTH.activePlan);
    this.storage.removeLocal(environment.AUTH.userData);
    // Last: flipping the token to null re-runs `isAuthenticated` and aborts the
    // in-flight profile request.
    this.accessToken.set(null);
    this.accessTokenSubject.next(null);
  }

  private writeAccessToken(token: string): void {
    this.storage.setCookie(environment.AUTH.accessToken, token, {
      expires: 1,
      path: '/',
      secure: environment.production,
      sameSite: 'Strict',
    });
    this.accessToken.set(token);
  }
}

/**
 * Pull an access token out of the refresh response.
 *
 * The endpoint is documented as opaque — it forwards the SSO's body verbatim
 * and the backend reads none of its fields — so there is no single correct
 * path. These are the shapes the sibling login endpoints (#33, #35) return,
 * most specific first. `null` is a valid outcome: the session cannot be renewed.
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
