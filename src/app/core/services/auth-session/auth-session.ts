import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

import { environment } from '@env/environment';
import {
  AUTH_ROUTES,
  AuthFailure,
  IdentifyResponse,
  OtpSendResponse,
  ProfileStatus,
  SessionResponse,
  isSessionResponse,
  toAuthFailure,
} from '../../models/auth.model';
import { SKIP_ERROR_NOTIFICATION } from '../../models/http.model';
import { ApiClient } from '../api-client/api-client';
import { Storage } from '../storage/storage';
import { HttpContext } from '@angular/common/http';

/**
 * Renew this many seconds BEFORE the access token expires.
 *
 * Matches `token_refresh_skew_seconds` in the Postman environments, so the
 * collection and the app rotate on the same schedule and a token that works in
 * one works in the other.
 */
const REFRESH_SKEW_SECONDS = 120;

/** Errors here are rendered by the caller, never by a global toast. */
const QUIET = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

/**
 * The learner's session against the MilesCAIRA Accounts v1 API.
 *
 * The five `auth-*` routes are COMMANDS, not reads, so this is a plain service
 * over `ApiClient` rather than an `httpResource` layer — and `ensureFreshToken`
 * has to be awaitable and serialised, which a resource cannot express.
 *
 * Read `auth.model.ts` before changing anything here: the five contract rules
 * it documents are all load-bearing in this file.
 */
@Service()
export class AuthSession {
  private readonly api = inject(ApiClient);
  private readonly storage = inject(Storage);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── State ─────────────────────────────────────────────────────────────────

  private readonly _accessToken = signal<string>(this.readCookie(environment.AUTH.accessToken));
  private readonly _refreshToken = signal<string>(this.readCookie(environment.AUTH.refreshToken));
  private readonly _profileStatus = signal<ProfileStatus | null>(this.readProfileStatus());
  private readonly _isTestUser = signal<boolean>(false);

  readonly accessToken = this._accessToken.asReadonly();
  readonly profileStatus = this._profileStatus.asReadonly();
  readonly isTestUser = this._isTestUser.asReadonly();

  /**
   * A BOOLEAN, deliberately.
   *
   * Every `httpResource` in the app gates its request on this signal. If they
   * gated on the token string instead, each rotation would change the tracked
   * value and re-fire every read in the application. A boolean does not change
   * when the token rotates, so rotation stays invisible to them.
   */
  readonly isAuthenticated = computed(() => this._accessToken().length > 0);

  /**
   * Rule 4: branch on `profile_status`, never on the token's
   * `miles.onboarding_required` claim — they are different facts of opposite
   * polarity.
   */
  readonly needsOnboarding = computed(() => this._profileStatus() === 'new_user');

  // ── Commands ──────────────────────────────────────────────────────────────

  /**
   * "How does this person authenticate?" — the first call of any login, always.
   *
   * Do NOT build a "no such account" message from the result: an identifier the
   * SSO has never seen answers with the same `methods`, `defaultMethod` and
   * masks as a known one, by design.
   */
  identify(identifier: string): Promise<IdentifyResponse> {
    return firstValueFrom(this.api.call(AUTH_ROUTES.identify, { identifier }, { context: QUIET }));
  }

  /** Send a one-time code. Read `channel` and `cooldownSeconds` off the result. */
  sendOtp(identifier: string): Promise<OtpSendResponse> {
    return firstValueFrom(this.api.call(AUTH_ROUTES.sendOtp, { identifier }, { context: QUIET }));
  }

  /** Exchange the code for a session, and store it. */
  async verifyOtp(identifier: string, code: string): Promise<SessionResponse> {
    const session = await firstValueFrom(
      this.api.call(AUTH_ROUTES.verifyOtp, { identifier, code }, { context: QUIET }),
    );
    this.store(session);
    return session;
  }

  /**
   * End the session at the SSO.
   *
   * Local state is cleared ONLY on success. A logout that failed leaves a
   * session still live at the SSO, and blanking the tokens would hide that
   * behind a UI that merely looks signed out.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.call(AUTH_ROUTES.logout, undefined, { context: QUIET }));
      this.clear();
    } catch {
      // Deliberately keeps the session. The caller decides what to show.
    }
  }

  /**
   * Rotate unconditionally.
   *
   * Call this after `PATCH profile/` advances the milestone (rule 5): the
   * `miles.onboarding_required` claim is minted INTO the token, so completing
   * onboarding and not refreshing re-reads a stale value and bounces the user
   * straight back into the onboarding they just finished.
   */
  forceRefresh(): Promise<void> {
    return this.refreshOnce();
  }

  // ── Token freshness ───────────────────────────────────────────────────────

  /**
   * Rules 2 and 3.
   *
   * Rule 2 — refresh BEFORE expiry, never on a 401/403 retry. The access token
   * is deliberately short (it is the window in which a suspended user keeps
   * access) and cannot be revoked once issued, so the documented client
   * behaviour is to rotate ahead of time. Retrying after a 401 would also mean
   * re-sending the original request, which is wrong for a POST that has already
   * taken effect.
   *
   * Rule 3 — refresh tokens rotate and the previous one dies about ten seconds
   * after use, so two concurrent refreshes invalidate the caller's own session.
   * `inFlight` is that serialisation: every caller awaits the same promise.
   */
  async ensureFreshToken(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!this.isAuthenticated() || !this._refreshToken()) return;

    const expiresAt = jwtExpiry(this._accessToken());
    if (expiresAt === null) return; // Not a JWT we can reason about; let the server judge.

    const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
    if (secondsLeft > REFRESH_SKEW_SECONDS) return;

    return this.refreshOnce();
  }

  private inFlight: Promise<void> | null = null;

  private refreshOnce(): Promise<void> {
    this.inFlight ??= this.doRefresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doRefresh(): Promise<void> {
    try {
      const session = await firstValueFrom(
        this.api.call(
          AUTH_ROUTES.refresh,
          { refreshToken: this._refreshToken() },
          { context: QUIET },
        ),
      );
      this.store(session);
    } catch {
      // A 401 here means the refreshed token would not resolve to a local row —
      // the account is gone or deactivated. Clear ONCE and let the guards send
      // them to sign-in; never retry, or this becomes a loop against a session
      // that can no longer exist.
      this.clear();
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * ponytail: access + refresh live in first-party JS-readable cookies so SSR
   * can read them out of the request headers and render the signed-in shell.
   * That makes them XSS-exposed — the same trade the pre-strip design made.
   *
   * The upgrade is the SSO's httpOnly `miles_sso_refresh` cookie plus
   * `withCredentials`, which `auth-token-refresh/` already supports (it accepts
   * an empty body for exactly that reason). It is not wired yet because the
   * cookie's `SameSite`/`Secure` attributes could not be observed: UAT answers
   * 503 "Sign-in is not configured on this environment" on every auth route as
   * of 2026-09-22. The CORS side is already in place — the API returns
   * `access-control-allow-credentials: true` with a non-wildcard origin.
   */
  private store(session: SessionResponse): void {
    if (!isSessionResponse(session)) {
      // Storing a malformed session is unrecoverable: it looks signed in and
      // every later request fails with no signal. Refuse it instead.
      this.clear();
      throw new Error('Sign-in response did not carry a usable session.');
    }

    this._accessToken.set(session.accessToken);
    // Rule 3: the ROTATED refresh token, every time. Keeping the old one works
    // exactly once and then fails against a value that still looks valid.
    this._refreshToken.set(session.refreshToken);
    this._profileStatus.set(session.profile_status);
    this._isTestUser.set(session.is_test_user);

    this.writeCookie(environment.AUTH.accessToken, session.accessToken);
    this.writeCookie(environment.AUTH.refreshToken, session.refreshToken);
    this.writeCookie(environment.AUTH.userData, session.profile_status);
  }

  clear(): void {
    this._accessToken.set('');
    this._refreshToken.set('');
    this._profileStatus.set(null);
    this._isTestUser.set(false);

    if (!this.isBrowser) return;
    this.storage.deleteCookie(environment.AUTH.accessToken);
    this.storage.deleteCookie(environment.AUTH.refreshToken);
    this.storage.deleteCookie(environment.AUTH.userData);
  }

  private readCookie(key: string): string {
    return this.storage.getCookie(key) ?? '';
  }

  private readProfileStatus(): ProfileStatus | null {
    const raw = this.readCookie(environment.AUTH.userData);
    return raw === 'new_user' || raw === 'onboard_completed' || raw === 'profile_completed'
      ? raw
      : null;
  }

  private writeCookie(key: string, value: string): void {
    if (!this.isBrowser) return;
    this.storage.setCookie(key, value, {
      path: '/',
      secure: environment.production,
      sameSite: 'Lax',
    });
  }

  /** Convenience for callers that want the typed failure rather than the raw error. */
  static failureOf(err: unknown): AuthFailure {
    return toAuthFailure(
      err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }),
    );
  }
}

/**
 * The `exp` claim in epoch seconds, or `null` if this is not a JWT.
 *
 * The signature is NOT checked and must not be: the server does that, and a
 * client that verifies its own token is only checking its own arithmetic.
 *
 * `atob` covers the browser and `Buffer` covers SSR; `typeof` on an undeclared
 * name is safe in JavaScript while a bare reference is not.
 */
function jwtExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';

  try {
    const json =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
    const claims: unknown = JSON.parse(json);
    const exp = (claims as Record<string, unknown>)?.['exp'];
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}
