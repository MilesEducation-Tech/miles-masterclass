import { HttpContext } from '@angular/common/http';
import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { Auth } from '../../../shared/core/services/auth/auth';
import { Logger } from '../../../shared/core/services/logger/logger';
import { ApiClient } from '../../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../../shared/core/http/caira.endpoints';
import { cairaError, userMessage } from '../../../shared/core/http/caira-error';
import {
  CairaFailure,
  SKIP_ERROR_NOTIFICATION,
} from '../../../shared/core/models/caira/envelope.model';
import {
  EmailPasswordLoginRequest,
  LoginResponse,
  OtpChannel,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  ssoUserToCairaUser,
} from '../../../shared/core/models/caira/auth.model';

/** Seconds before a fresh OTP can be requested. Client-side only — see below. */
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Delivery channel for the phone OTP.
 *
 * ponytail: product choice, not a technical one — flip to `WHATSAPP` if that is
 * the intended default. `5` (dev-OTP) is not in the union and #34 rejects it
 * outright, which is the whole reason web binds #34 rather than the mobile twin.
 */
const OTP_DELIVERY = OtpChannel.SMS;

/** What the login page needs to know beyond "it failed". */
export type LoginOutcome =
  | { kind: 'authenticated' }
  | { kind: 'otp-sent' }
  /** 403 — the learner must finish onboarding in the Miles One app first. */
  | { kind: 'profile-incomplete'; message: string }
  /** 409 — two accounts share this number; support has to merge them. */
  | { kind: 'multiple-accounts'; message: string }
  | { kind: 'error'; message: string };

/**
 * The login flows. Route-scoped, per `angular-conventions` — `providedIn: 'root'`
 * on a feature facade forks state in ways that are hard to debug.
 *
 * Every call sets `SKIP_ERROR_NOTIFICATION`: a login screen shows its failures
 * inline, next to the field that caused them. A toast for a wrong password
 * would be both redundant and easy to miss.
 */
@Service({ autoProvided: false })
export class AuthFacade {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** Set from #34's response and replayed to #35. */
  readonly sessionId = signal<string | number | null>(null);

  readonly resendSecondsLeft = signal(0);
  readonly canResendOtp = computed(() => this.resendSecondsLeft() === 0);

  private cooldownHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCooldown());
  }

  /** #33 · email + password. Authenticates in one step — there is no OTP leg. */
  loginWithPassword(email: string, password: string): Observable<LoginOutcome> {
    const body: EmailPasswordLoginRequest = { user_name: email.trim(), password };
    return this.run<LoginResponse>(
      this.api.post(CAIRA.loginWithEmailPassword, body, this.silent()),
      (res) => this.completeLogin(res),
    );
  }

  /** #34 · start the phone flow. Stores `session_id` for the verify step. */
  sendOtp(countryCode: string, phone: string): Observable<LoginOutcome> {
    const body: SendOtpRequest = {
      phone: phone.trim(),
      country_code: countryCode.trim(),
      communication_method: OTP_DELIVERY,
    };
    return this.run<SendOtpResponse>(
      this.api.post(CAIRA.loginWithPhoneOtp, body, this.silent()),
      (res) => {
        const sessionId = res?.result?.session_id;
        if (sessionId === undefined || sessionId === null || sessionId === '') {
          // The SSO answered 2xx without a session. Nothing to verify against.
          return { kind: 'error', message: 'Could not start sign-in. Please try again.' };
        }
        this.sessionId.set(sessionId);
        this.startCooldown();
        return { kind: 'otp-sent' };
      },
    );
  }

  /** #35 · exchange the OTP for a token pair. */
  verifyOtp(otp: string): Observable<LoginOutcome> {
    const sessionId = this.sessionId();
    if (sessionId === null) {
      return this.immediate({
        kind: 'error',
        message: 'Your sign-in expired. Please start again.',
      });
    }
    const body: VerifyOtpRequest = { session_id: sessionId, otp };
    return this.run<LoginResponse>(this.api.post(CAIRA.verifyOtp, body, this.silent()), (res) =>
      this.completeLogin(res),
    );
  }

  /** Re-send by replaying #34. The server issues a fresh `session_id`. */
  resendOtp(countryCode: string, phone: string): Observable<LoginOutcome> {
    return this.sendOtp(countryCode, phone);
  }

  reset(): void {
    this.sessionId.set(null);
    this.error.set(null);
    this.isLoading.set(false);
    this.stopCooldown();
  }

  // -------------------------------------------------------------------------

  /**
   * Persist the token pair and seed the user from the login payload.
   *
   * The seed is a stopgap so the header renders a name immediately; `v2/status`
   * replaces it with the real profile a moment later. Doing it this way avoids a
   * blocking request between "password accepted" and "page usable".
   */
  private completeLogin(res: LoginResponse | null): LoginOutcome {
    const token = res?.result?.token;
    if (!token) {
      this.logger.error('Login succeeded but no token was returned');
      return { kind: 'error', message: 'Sign-in failed. Please try again.' };
    }

    // ⚠️ #35's documented example omits `refresh_token` while #33's includes it.
    // An empty refresh token simply means the session ends when the access
    // token expires — `Auth.refreshToken` treats a missing one as "give up".
    this.auth.storeTokens(token, res?.result?.refresh_token ?? '');

    if (res?.result?.user) {
      this.auth.setAuthenticated(ssoUserToCairaUser(res.result.user));
    } else {
      this.auth.notifyAuthStateChange();
    }

    // Authoritative profile, including the fields the login payload never
    // carries (email, location, tags) that `isProfileComplete` needs.
    this.auth.fetchMyProfile();

    return { kind: 'authenticated' };
  }

  /**
   * Shared request plumbing: loading flag, error signal, and translating a
   * `CairaFailure` into an outcome the page can render.
   *
   * `takeUntilDestroyed` matters here — navigating away mid-request would
   * otherwise land a `setAuthenticated` on a destroyed page.
   */
  private run<T>(
    request: Observable<T>,
    onSuccess: (value: T) => LoginOutcome,
  ): Observable<LoginOutcome> {
    this.isLoading.set(true);
    this.error.set(null);

    return request.pipe(
      map(onSuccess),
      catchError((err: unknown) => of(this.toOutcome(err))),
      tap((outcome) => {
        this.isLoading.set(false);
        const succeeded = outcome.kind === 'authenticated' || outcome.kind === 'otp-sent';
        this.error.set(succeeded ? null : outcome.message);
      }),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /**
   * Map a failure onto something the form can show.
   *
   * The two branches that matter are the ones a generic error message would
   * destroy: `PROFILE_INCOMPLETE` needs to route the learner to onboarding, and
   * `MULTIPLE_ACCOUNTS` needs to point them at support. `cairaError` classifies
   * both as `domain` — a wrong password is a 401 but is *not* a token problem,
   * so it must never reach the refresh path either.
   */
  private toOutcome(err: unknown): LoginOutcome {
    const failure: CairaFailure = cairaError(err);

    if (failure.kind === 'domain') {
      switch (failure.reason) {
        case 'PROFILE_INCOMPLETE':
          return {
            kind: 'profile-incomplete',
            message:
              failure.message ?? 'Please complete your profile on the Miles One app to continue.',
          };
        case 'MULTIPLE_ACCOUNTS':
          return {
            kind: 'multiple-accounts',
            message:
              failure.message ??
              'Multiple accounts detected for this number. Please contact support.',
          };
        case 'throttled':
          return {
            kind: 'error',
            message: 'Too many attempts. Please wait a moment and try again.',
          };
        default:
          return { kind: 'error', message: failure.message ?? userMessage(failure) };
      }
    }

    this.logger.error('Login failed', failure);
    return { kind: 'error', message: userMessage(failure) };
  }

  private immediate(outcome: LoginOutcome): Observable<LoginOutcome> {
    this.error.set(outcome.kind === 'error' ? outcome.message : null);
    return of(outcome);
  }

  /** Login pages show failures inline; a toast on top of that is noise. */
  private silent() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /**
   * Client-side resend throttle.
   *
   * Cosmetic only — **#34 and #35 are both unthrottled server-side**, so this
   * stops accidental double-taps, not abuse. Rate limiting OTP send and verify
   * is a backend ask, recorded in the gap register.
   */
  private startCooldown(): void {
    this.stopCooldown();
    this.resendSecondsLeft.set(RESEND_COOLDOWN_SECONDS);
    this.cooldownHandle = setInterval(() => {
      this.resendSecondsLeft.update((n) => Math.max(0, n - 1));
      if (this.resendSecondsLeft() === 0) this.stopCooldown();
    }, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownHandle !== null) {
      clearInterval(this.cooldownHandle);
      this.cooldownHandle = null;
    }
  }
}
