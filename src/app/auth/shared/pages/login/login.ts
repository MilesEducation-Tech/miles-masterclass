import { HttpContext } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  form,
  minLength,
  required,
  validate,
  FormField as AngularFormField,
} from '@angular/forms/signals';
import { Observable, Subject, catchError, defer, map, of, takeUntil, tap } from 'rxjs';
import { Button } from '../../../../shared/components/ui/button/button';
import { Forms } from '../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../shared/components/ui/aria/aria-input/aria-input';
import { AriaAutocomplete } from '../../../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { Otp } from '../../../../shared/components/ui/otp/otp';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMail, lucideQrCode, lucideSmartphone } from '@ng-icons/lucide';
import { Utils } from '../../../../shared/core/services/utils/utils';
import { Auth } from '../../../../shared/core/services/auth/auth';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { CAIRA } from '../../../../shared/core/http/caira.endpoints';
import { cairaError, userMessage } from '../../../../shared/core/http/caira-error';
import {
  CairaFailure,
  SKIP_ERROR_NOTIFICATION,
} from '../../../../shared/core/models/caira/envelope.model';
import {
  EmailPasswordLoginRequest,
  LoginResponse,
  OtpChannel,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  ssoUserToCairaUser,
} from '../../../../shared/core/models/caira/auth.model';
import { dialCodeWithLength } from '../../../../shared/core/constant/dial-code';

export type LoginMethod = 'EMAIL' | 'PHONE' | 'QR';

interface LoginMethodOption {
  id: LoginMethod;
  label: string;
  icon: string;
  /**
   * QR is designed but **not implementable**: the reference puts
   * `account/qr_login/crypto.py` out of scope, so the curve, KDF, AES mode and
   * `public_key` encoding of the `{epk, iv, ct}` blob are all unknown and the
   * browser cannot decrypt what `qr/confirm` returns. Rendered disabled rather
   * than hidden so the design is intact and the gap is visible. See G-04.
   */
  disabled?: boolean;
}

const LOGIN_METHODS: readonly LoginMethodOption[] = [
  { id: 'EMAIL', label: 'Login with Email', icon: 'lucideMail' },
  { id: 'PHONE', label: 'Login with phone', icon: 'lucideSmartphone' },
  { id: 'QR', label: 'Login with QR', icon: 'lucideQrCode', disabled: true },
];

/** Milliseconds before a fresh OTP can be requested. Client-side only — see below. */
const RESEND_COOLDOWN_MS = 30_000;

/**
 * Delivery channel for the phone OTP.
 *
 * ponytail: product choice, not a technical one — flip to `WHATSAPP` if that is
 * the intended default. `5` (dev-OTP) is not in the union and #34 rejects it
 * outright, which is the whole reason web binds #34 rather than the mobile twin.
 */
const OTP_DELIVERY = OtpChannel.SMS;

/** What ends a sign-in attempt. Local — nothing outside this screen reacts to it. */
type LoginOutcome =
  | { kind: 'authenticated' }
  | { kind: 'otp-sent' }
  /** 403 — the learner must finish onboarding in the Miles One app first. */
  | { kind: 'profile-incomplete'; message: string }
  /** 409 — two accounts share this number; support has to merge them. */
  | { kind: 'multiple-accounts'; message: string }
  | { kind: 'error'; message: string };

/** What the login form collects. The form's own shape, not a wire payload. */
interface AuthModel {
  identifier: string;
  email: string;
  /** Email method only. CAIRA has no email-OTP route, so email login is password-based. */
  password: string;
  country_code: string;
  phone: string;
  terms: boolean;
  consent: boolean;
}

interface OtpModel {
  session_id: string;
  otp: string;
}

@Component({
  selector: 'app-login',
  imports: [
    Forms,
    AriaInput,
    AriaAutocomplete,
    Otp,
    Button,
    AngularFormField,
    Spinner,
    NgIcon,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
  // `[name]` on <ng-icon> resolves against this map. Registered per-component
  // rather than globally, matching how `header.ts` does it.
  providers: [provideIcons({ lucideMail, lucideSmartphone, lucideQrCode })],
})
export class Login {
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** Set from #34's response and replayed to #35. */
  private readonly sessionId = signal<string | number | null>(null);

  /**
   * Cancels whatever request is in flight.
   *
   * Without this, `reset()` clears the signals but leaves the request running:
   * cancel an OTP mid-verify and the response still lands, stores the tokens
   * and navigates you into the app seconds after you asked it not to.
   */
  private readonly cancelled = new Subject<void>();

  /**
   * `OTP` is reachable from the phone method only. Email authenticates in one
   * step against `web/login-with-email-password` — **CAIRA has no email-OTP
   * endpoint**. (`otp/generate` / `otp/validate` exist but are post-login email
   * verification, not a login path.)
   */
  readonly loginStep = signal<'LOGIN' | 'OTP'>('LOGIN');

  /**
   * Source of truth for the sign-in method.
   *
   * Switched from the two buttons at the foot of the card rather than a tab
   * strip: the design carries three methods, and a three-tab strip crowds the
   * card while a "here are the other two" row scales.
   */
  readonly loginMethod = signal<LoginMethod>('EMAIL');
  readonly loginType = computed(() => this.loginMethod());

  /** The two methods that are *not* active — the bottom switcher's contents. */
  readonly otherMethods = computed(() => LOGIN_METHODS.filter((m) => m.id !== this.loginMethod()));

  /**
   * "Send OTP" is only honest on the phone method — email signs in directly
   * against #33 and never reaches the OTP step.
   */
  readonly submitLabel = computed(() => {
    if (this.loginStep() === 'OTP') return 'Verify OTP';
    return this.loginType() === 'EMAIL' ? 'Sign In' : 'Send OTP';
  });

  readonly countryCodes = signal<any[]>(
    Array.from(
      dialCodeWithLength
        .reduce((acc, item) => {
          const code = item.CountryCode?.toString() ?? '';
          if (code && !acc.has(code)) {
            acc.set(code, { ...item, value: code, label: code });
          }
          return acc;
        }, new Map<string, any>())
        .values(),
    ),
  );

  readonly authModel = signal<AuthModel>({
    identifier: '',
    email: '',
    password: '',
    country_code: '+1',
    phone: '',
    // Neither method renders a mandatory terms checkbox — acceptance is implied
    // by the notice above the submit button, so `terms` is held accepted.
    // Promotional consent stays an explicit opt-in and must start unchecked.
    terms: true,
    consent: false,
  });

  readonly otpModel = signal<OtpModel>({ session_id: '', otp: '' });

  readonly loginForm = form<AuthModel>(this.authModel, (loginSchema) => {
    // `validate` rather than `pattern` because the rule depends on the active
    // method, and `pattern` expects a static RegExp.
    validate(loginSchema.identifier, ({ value }) => {
      const type = this.loginType();
      // Let `required` own the empty case so an untouched Phone field doesn't
      // surface "Must be digits".
      if (!value()) return null;

      if (type === 'PHONE') {
        if (!/^\d+$/.test(value())) {
          return { kind: 'pattern', message: 'Must be digits' };
        }
        const selectedCode = this.countryCodes().find(
          (c: any) => c.CountryCode === this.authModel().country_code,
        );
        if (selectedCode) {
          const min = selectedCode.phLengthMin ?? 7;
          const max = selectedCode.phLengthMax ?? 18;
          if (value().length < min) {
            return { kind: 'minlength', message: `Minimum length is ${min}` };
          }
          if (value().length > max) {
            return { kind: 'maxlength', message: `Maximum length is ${max}` };
          }
        }
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value())) {
        return { kind: 'email', message: 'Invalid Email Address' };
      }
      return null;
    });

    validate(loginSchema.country_code, ({ value }) => {
      if (this.loginType() !== 'PHONE') return null;
      if (!value()) return { kind: 'required', message: 'Country code is required' };
      const selectedCode = this.countryCodes().find(
        (c: any) => c.CountryCode === this.authModel().country_code,
      );
      return selectedCode ? null : { kind: 'required', message: 'Invalid Country code' };
    });

    required(loginSchema.identifier, { message: 'Please enter your email or phone number' });

    // Password is Email-method only. `when` is the one option `required`
    // supports (every other validator needs `applyWhen`), which is exactly the
    // shape this rule needs.
    required(loginSchema.password, {
      message: 'Please enter your password',
      when: () => this.loginType() === 'EMAIL',
    });
  });

  readonly otpForm = form<OtpModel>(this.otpModel, (otpSchema) => {
    required(otpSchema.otp, { message: 'Please enter the OTP' });
    minLength(otpSchema.otp, 6, { message: 'OTP must be 6 digits' });
  });

  // ---------------------------------------------------------------------------
  // Resend cooldown
  //
  // Deadline-based, not tick-counting. Browsers throttle `setInterval` in
  // background tabs — Chrome to roughly once a minute — and reading the SMS is
  // exactly when this tab is in the background. Counting ticks would stretch a
  // 30-second wait into tens of minutes and strand the learner with a disabled
  // Resend and an OTP that has already expired. Deriving from the clock means a
  // throttled tick just jumps the countdown forward and self-corrects.
  //
  // Cosmetic in any case: **#34 and #35 are both unthrottled server-side**, so
  // this stops accidental double-taps, not abuse. Rate limiting them is a
  // backend ask (G-05).
  // ---------------------------------------------------------------------------

  private readonly cooldownUntil = signal(0);
  private readonly clock = signal(0);
  private cooldownHandle: ReturnType<typeof setInterval> | null = null;

  /** Seconds remaining before a fresh OTP can be requested. `0` ⇒ resendable. */
  readonly resendSecondsLeft = computed(() =>
    Math.max(0, Math.ceil((this.cooldownUntil() - this.clock()) / 1000)),
  );
  readonly canResendOtp = computed(() => this.resendSecondsLeft() === 0);
  readonly resendTimerDisplay = computed(() => {
    const total = this.resendSecondsLeft();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  /** The identifier as it should appear on the OTP confirmation screen. */
  readonly displayIdentifier = computed(() => {
    const model = this.authModel();
    if (this.loginType() === 'PHONE') {
      // Filter empty parts so a missing country_code can't produce a leading space.
      return [model.country_code, model.identifier].filter(Boolean).join(' ');
    }
    return model.identifier;
  });

  /**
   * Marketing-consent text.
   *
   * ⚠️ The checkbox this labels is collected and **never transmitted** — CAIRA's
   * #33/#34/#35 accept no consent field, and the old API's `sms_consent` has no
   * counterpart. Either wire it to a backend field or remove the control;
   * showing an opt-in and discarding the answer is the worst of the three.
   *
   * The phone copy ends mid-sentence at "…or contact": the support mailto, the
   * "Consent is not a condition of purchase." sentence and the policy links are
   * rendered by the template's `labelLink` slot immediately after.
   */
  readonly consentLabel = computed(() =>
    this.loginType() === 'PHONE'
      ? 'I agree to receive recurring informational and promotional messages from Miles Masterclass via SMS and WhatsApp, including webinar registration confirmations, reminders, joining instructions, educational updates, course information and offers, sent using automated technology. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for assistance, or contact'
      : "I'd like to receive promotional and informational emails from Miles Masterclass, including invitations to upcoming events, program updates, and offers. I can unsubscribe at any time using the link in any email.",
  );

  readonly supportEmail = 'support@milesmasterclass.com';

  /** Country/profession-scoped routes for the consent policy links. */
  readonly legalLinks = computed(() => {
    const { country, profession } = this.utils.getRouteParams();
    const base = `/${country?.toLowerCase()}/${profession}`;
    return {
      terms: `${base}/terms-of-service`,
      privacy: `${base}/privacy-policy`,
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCooldown();
      this.cancelled.complete();
    });
  }

  // ---------------------------------------------------------------------------
  // User actions
  // ---------------------------------------------------------------------------

  /**
   * Switch sign-in method. The typed identifier (and its touched/dirty state)
   * is cleared so a half-typed email isn't validated as a phone number and
   * vice-versa.
   */
  selectLoginMethod(method: LoginMethod): void {
    if (method === this.loginMethod()) return;
    // QR is rendered disabled; this is belt-and-braces against a programmatic
    // call, since selecting it would strand the user on a form that cannot
    // submit.
    if (LOGIN_METHODS.find((m) => m.id === method)?.disabled) return;

    this.loginMethod.set(method);
    this.loginStep.set('LOGIN');
    // Clear the password too — leaving a typed password in the model while the
    // phone method is active would send it nowhere, but it would sit in memory
    // and in any state snapshot for the rest of the session.
    this.authModel.update((m) => ({ ...m, identifier: '', password: '' }));
    this.loginForm.identifier().reset();
    this.loginForm.password().reset();
    this.reset();
  }

  /**
   * Return to the LOGIN step from OTP without wiping the identifier the user
   * typed. `terms` and `consent` are intentionally preserved.
   */
  goBackToLogin(): void {
    this.otpForm().reset();
    this.otpModel.set({ session_id: '', otp: '' });
    this.loginStep.set('LOGIN');
    // Drops the stored `session_id`, the cooldown, and — importantly — aborts
    // any verify still in flight.
    this.reset();
  }

  /**
   * Step one. Email authenticates outright (#33); phone sends an OTP (#34) and
   * advances to the OTP step.
   */
  submitLogin(): void {
    const { identifier, password, country_code } = this.authModel();

    const request =
      this.loginType() === 'EMAIL'
        ? this.loginWithPassword(identifier, password)
        : this.sendOtp(country_code, identifier);

    request.subscribe((outcome) => {
      if (outcome.kind === 'otp-sent') {
        this.loginStep.set('OTP');
        return;
      }
      this.handleTerminalOutcome(outcome);
    });
  }

  /** Step two, phone flow only (#35). */
  verifyOtp(): void {
    const sessionId = this.sessionId();
    if (sessionId === null) {
      this.fail('Your sign-in expired. Please start again.');
      return;
    }
    const body: VerifyOtpRequest = { session_id: sessionId, otp: this.otpModel().otp };
    this.run<LoginResponse>(this.api.post(CAIRA.verifyOtp, body, silent()), (res) =>
      this.completeLogin(res),
    ).subscribe((outcome) => this.handleTerminalOutcome(outcome));
  }

  /** Replays #34; the server issues a fresh `session_id`. */
  resendOtp(): void {
    if (!this.canResendOtp() || this.isLoading()) return;
    const { country_code, identifier } = this.authModel();
    this.sendOtp(country_code, identifier).subscribe();
  }

  onSubmit(): void {
    if (this.isLoading()) return;
    if (this.loginStep() === 'OTP') {
      if (this.otpForm().invalid()) return;
      this.verifyOtp();
    } else {
      if (this.loginForm().invalid()) return;
      this.submitLogin();
    }
  }

  // ---------------------------------------------------------------------------
  // Requests
  // ---------------------------------------------------------------------------

  /** #33 · email + password. Authenticates in one step — there is no OTP leg. */
  private loginWithPassword(email: string, password: string): Observable<LoginOutcome> {
    const body: EmailPasswordLoginRequest = { user_name: email.trim(), password };
    return this.run<LoginResponse>(
      this.api.post(CAIRA.loginWithEmailPassword, body, silent()),
      (res) => this.completeLogin(res),
    );
  }

  /** #34 · start the phone flow. Stores `session_id` for the verify step. */
  private sendOtp(countryCode: string, phone: string): Observable<LoginOutcome> {
    const body: SendOtpRequest = {
      phone: phone.trim(),
      country_code: countryCode.trim(),
      communication_method: OTP_DELIVERY,
    };
    return this.run<SendOtpResponse>(
      this.api.post(CAIRA.loginWithPhoneOtp, body, silent()),
      (res) => {
        const sessionId = res?.result?.session_id;
        // `=== null` rather than a truthiness test: a numeric session id of `0`
        // is valid, and the mobile twin's own truthiness bug is exactly this.
        if (sessionId === undefined || sessionId === null || sessionId === '') {
          return { kind: 'error', message: 'Could not start sign-in. Please try again.' };
        }
        this.sessionId.set(sessionId);
        this.startCooldown();
        return { kind: 'otp-sent' };
      },
    );
  }

  /**
   * Persist the token pair and seed the user from the login payload.
   *
   * Setting the access token is what loads the profile: `Auth` keys its
   * `v2/status` resource on the token signal, so `storeTokens` alone triggers
   * the fetch. There is deliberately no explicit profile call here — one would
   * be a no-op anyway, since `resource.reload()` returns false while the
   * resource is still idle.
   *
   * The user seed is a stopgap so the header renders a name immediately;
   * `v2/status` replaces it a moment later with the fields the login payload
   * never carries (email, location, tags) that `isProfileComplete` needs.
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
    }

    return { kind: 'authenticated' };
  }

  /**
   * Shared request plumbing: loading flag, error signal, cancellation, and
   * translating a `CairaFailure` into an outcome the page can render.
   *
   * `defer` matters — setting `isLoading` in the method body would flip it on a
   * call that is never subscribed, stranding the submit button behind a
   * permanent spinner.
   */
  private run<T>(
    request: Observable<T>,
    onSuccess: (value: T) => LoginOutcome,
  ): Observable<LoginOutcome> {
    return defer(() => {
      this.isLoading.set(true);
      this.error.set(null);
      return request;
    }).pipe(
      map(onSuccess),
      catchError((err: unknown) => of(this.toOutcome(err))),
      tap((outcome) => {
        this.isLoading.set(false);
        const succeeded = outcome.kind === 'authenticated' || outcome.kind === 'otp-sent';
        this.error.set(succeeded ? null : outcome.message);
      }),
      // Aborts the request when the user cancels or switches method, before the
      // response can store a token for an attempt they abandoned.
      takeUntil(this.cancelled),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /**
   * Map a failure onto something the form can show.
   *
   * The two branches that matter are the ones a generic message would destroy:
   * `PROFILE_INCOMPLETE` needs to route the learner to onboarding, and
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

  /**
   * Everything that ends the login attempt.
   *
   * `profile-incomplete` is a 403 from the web login gate: the token is
   * withheld, so there is nothing to route into the app with — the learner has
   * to finish onboarding in the Miles One app. It is shown as a message rather
   * than a redirect for that reason. `multiple-accounts` is a 409 that only
   * support can resolve. Both already populate `error`, so the template renders
   * them without extra wiring; the switch exists so a future redirect has an
   * obvious home and so a new outcome kind fails the type check.
   */
  private handleTerminalOutcome(outcome: LoginOutcome): void {
    switch (outcome.kind) {
      case 'authenticated':
        void this.router.navigate(['/']);
        return;
      case 'profile-incomplete':
      case 'multiple-accounts':
      case 'error':
      case 'otp-sent':
        return;
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Abort anything in flight and clear the attempt's state. */
  private reset(): void {
    this.cancelled.next();
    this.sessionId.set(null);
    this.error.set(null);
    this.isLoading.set(false);
    this.stopCooldown();
    this.cooldownUntil.set(0);
  }

  private fail(message: string): void {
    this.isLoading.set(false);
    this.error.set(message);
  }

  private startCooldown(): void {
    this.stopCooldown();
    this.cooldownUntil.set(Date.now() + RESEND_COOLDOWN_MS);
    this.clock.set(Date.now());
    this.cooldownHandle = setInterval(() => {
      this.clock.set(Date.now());
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

/** Login shows its failures inline, next to the field; a toast is noise on top. */
function silent() {
  return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
}
