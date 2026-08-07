import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { form, minLength, required, validate } from '@angular/forms/signals';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject, filter, interval, map, take, takeUntil } from 'rxjs';
import {
  AUTH_ROUTES,
  AuthModel,
  CountryCodeOption,
  OtpModel,
  SendOTPRequest,
  User,
  VerifyOTPRequest,
} from '../../../shared/core/models/auth.model';
import { RouteResponse } from '../../../shared/core/models/http.model';
import { Logger } from '../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../shared/core/services/notification/notification';
import { ApiClient } from '../../../shared/core/services/api-client/api-client';
import { Storage } from '../../../shared/core/services/storage/storage';
import { UTM_COOKIE_KEY } from '../../../shared/core/services/utm/utm';
import { Auth } from '../../../shared/core/services/auth/auth';
import { dialCodeWithLength } from '../../../shared/core/constant/dial-code';
import { Dialog } from '../../../shared/core/services/dialog/dialog';
import { UtilsDialog } from '../../../shared/components/dialog/utils-dialog/utils-dialog';
import { CONTENT_MAP } from '../../../shared/core/config/auth.config';
import { Analytics } from '../../../shared/core/services/analytics/analytics';

type SendOtpResponse = RouteResponse<typeof AUTH_ROUTES.sendOtp>;
type VerifyOtpResponse = RouteResponse<typeof AUTH_ROUTES.verifyOtp>;

@Injectable()
export class AuthFacade {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly analytics = inject(Analytics);

  // Loading and error states
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /** Seconds remaining before the user can request a fresh OTP. `0` ⇒ resendable. */
  private static readonly RESEND_TIMER_SECONDS = 30;
  readonly resendSecondsLeft = signal(0);
  readonly canResendOtp = computed(() => this.resendSecondsLeft() === 0);
  readonly resendTimerDisplay = computed(() => {
    const total = this.resendSecondsLeft();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  });
  /** Emits when the current timer should be cancelled (resend, leave OTP, clear). */
  private readonly resendCancel$ = new Subject<void>();

  auth_type = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.split('?')[0].split('/').pop()),
    ),
    { initialValue: this.router.url.split('?')[0].split('/').pop() },
  );

  /**
   * Source of truth for which login method the user picked via the tab strip.
   * Defaults to PHONE (the "Mobile" tab).
   */
  readonly loginMethod = signal<'PHONE' | 'EMAIL'>('PHONE');

  /** Tab labels rendered by `app-tab-strip` on the login form. */
  readonly loginMethodTabs = ['Mobile', 'Email'] as const;

  /** The tab label that maps to the current `loginMethod`. */
  readonly selectedTabLabel = computed(() => (this.loginMethod() === 'PHONE' ? 'Mobile' : 'Email'));

  // Driven by the tab selection. `NONE` is kept in the union for backwards
  // compatibility with existing comparisons but is never produced anymore.
  loginType = computed<'EMAIL' | 'PHONE' | 'NONE'>(() => this.loginMethod());

  /**
   * Switch between the Mobile/Email tabs. The typed identifier (and its
   * touched/dirty state) is cleared so a half-typed email isn't validated as a
   * phone number and vice-versa.
   */
  selectLoginMethod(label: string): void {
    const method = label === 'Mobile' ? 'PHONE' : 'EMAIL';
    if (method === this.loginMethod()) return;
    this.loginMethod.set(method);
    this.authModel.update((m) => ({ ...m, identifier: '' }));
    this.loginForm.identifier().reset();
    this.error.set(null);
  }

  loginStep = signal<'LOGIN' | 'OTP'>('LOGIN');

  /** The identifier as it should appear on the OTP confirmation screen. */
  readonly displayIdentifier = computed(() => {
    const model = this.authModel();
    if (this.loginType() === 'PHONE') {
      // Filter empty parts so we don't produce a leading space when
      // country_code is somehow missing.
      return [model.country_code, model.identifier].filter(Boolean).join(' ');
    }
    return model.identifier;
  });

  /**
   * Return to the LOGIN step from OTP without wiping the identifier the user typed.
   * Note: `terms` and `consent` are intentionally preserved — the user has already
   * made those choices once and shouldn't be made to re-check the boxes just because
   * they corrected their email/phone.
   */
  goBackToLogin(): void {
    this.otpForm().reset();
    this.otpModel.set({ session_id: '', otp: '' });
    this.loginStep.set('LOGIN');
    this.isLoading.set(false);
    this.error.set(null);
    this.stopResendTimer();
  }

  readonly countryCodes = signal<CountryCodeOption[]>(
    Array.from(
      dialCodeWithLength
        .reduce((acc, item) => {
          const code = item.CountryCode?.toString() ?? '';
          if (code && !acc.has(code)) {
            acc.set(code, { ...item, value: code, label: code });
          }
          return acc;
        }, new Map<string, CountryCodeOption>())
        .values(),
    ),
  );

  authModel = signal<AuthModel>({
    identifier: '',
    email: '',
    country_code: '+1', // default value
    phone: '',
    // Neither tab renders the mandatory terms checkbox any more: acceptance is implied
    // by the "By signing up or logging in…" notice above the submit button, so `terms`
    // is held accepted. Promotional consent stays an explicit opt-in — it must start
    // unchecked so `sms_consent` only ever reflects a deliberate user action.
    terms: true,
    consent: false,
  });

  /**
   * Marketing-consent text (feeds `sms_consent`). Adapts to the input type —
   * SMS/WhatsApp promotional messages for phone, promotional emails for email.
   *
   * The phone copy ends mid-sentence at "…or contact": the support mailto, the
   * "Consent is not a condition of purchase." sentence and the Privacy Policy /
   * Terms of Service links are rendered by the login template's `labelLink` slot,
   * which sits immediately after this text. The email copy has no inline links.
   */
  readonly consentLabel = computed(() =>
    this.loginType() === 'PHONE'
      ? 'I agree to receive recurring informational and promotional messages from Miles Masterclass via SMS and WhatsApp, including webinar registration confirmations, reminders, joining instructions, educational updates, course information and offers, sent using automated technology. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for assistance, or contact'
      : "I'd like to receive promotional and informational emails from Miles Masterclass, including invitations to upcoming events, program updates, and offers. I can unsubscribe at any time using the link in any email.",
  );

  /** Support address surfaced in the Mobile consent copy. */
  readonly supportEmail = 'support@milesmasterclass.com';

  /**
   * `supportEmail` split at the "@". The template renders these either side of a
   * `<wbr>` so the address can break at its natural point. Without a break
   * opportunity the browser moves the whole address to the next line — CSS
   * `overflow-wrap` does not help, since it only splits a word that cannot fit on
   * a line of its own — leaving a visible gap after "…or contact".
   */
  readonly supportEmailParts = {
    local: this.supportEmail.slice(0, this.supportEmail.indexOf('@') + 1),
    domain: this.supportEmail.slice(this.supportEmail.indexOf('@') + 1),
  };

  otpModel = signal<OtpModel>({
    session_id: '',
    otp: '',
  });

  loginForm = form<AuthModel>(this.authModel, (loginSchema) => {
    // We use 'validate' for dynamic checks because 'pattern' expects a static RegExp
    // and standard 'required' is unconditional.

    // 1. Identifier Validation (Phone vs Email)
    validate(loginSchema.identifier, ({ value }) => {
      const type = this.loginType();
      // Let `required` own the empty case so we don't surface "Must be digits"
      // on an untouched/empty Mobile field.
      if (!value()) return null;
      if (type === 'NONE') return null;

      if (type === 'PHONE') {
        // Must be digits
        if (!/^\d+$/.test(value())) {
          return { kind: 'pattern', message: 'Must be digits' };
        }

        // Length check based on country code
        const selectedCode = this.countryCodes().find(
          (c) => c.CountryCode === this.authModel().country_code,
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
      } else {
        // Email validation
        if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value())) {
          return { kind: 'email', message: 'Invalid Email Address' };
        }
      }
      return null;
    });

    // 2. Country Code Required (Only if Phone)
    validate(loginSchema.country_code, ({ value }) => {
      if (this.loginType() === 'PHONE' && !value()) {
        return { kind: 'required', message: 'Country code is required' };
      } else if (this.loginType() === 'PHONE' && value()) {
        const selectedCode = this.countryCodes().find(
          (c) => c.CountryCode === this.authModel().country_code,
        );
        return !selectedCode ? { kind: 'required', message: 'Invalid Country code' } : null;
      } else {
        return null;
      }
    });

    // We keep 'required' for identifier as a base message if empty,
    // but the dynamic validator handles the type-specific content.
    required(loginSchema.identifier, { message: 'Please enter your email or phone number' });

    // `terms` is no longer validated: the checkbox is not rendered on either tab, so a
    // false value could disable submit with no control available to fix it. Acceptance
    // is implied by the notice next to the submit button and the model holds it true.

    // `consent` (SMS/WhatsApp/email marketing) is optional — no validation.
    // Its value is forwarded to verify-otp as `sms_consent`.
  });

  otpForm = form<OtpModel>(this.otpModel, (otpSchema) => {
    required(otpSchema.otp, { message: 'Please enter the OTP' });
    minLength(otpSchema.otp, 6, { message: 'OTP must be 6 digits' });
  });

  /**
   * Send OTP to user's email or phone
   */
  sendOtp(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const auth = this.authModel();
    const loginType = this.loginType();

    // Build request payload based on login type
    const payload: SendOTPRequest =
      loginType === 'EMAIL'
        ? { email: auth.identifier }
        : { phone: auth.identifier, country_code: auth.country_code };

    this.http.post<SendOtpResponse>(AUTH_ROUTES.sendOtp.path, payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.data?.result?.is_lms_access_blocked) {
          this.dialog.open(UtilsDialog, {
            data: CONTENT_MAP[response.data.result.lms_user_type ?? 'non_lms'],
          });
          return;
        }

        if (response.status && response.data?.result) {
          const { session_id } = response.data.result;

          // Store session_id for OTP verification
          this.otpModel.update((model) => ({
            ...model,
            session_id: session_id.toString(),
          }));

          this.notification.success(
            'OTP Sent',
            'Please check your inbox for the verification code.',
          );
          this.loginStep.set('OTP');
          this.startResendTimer();
          this.analytics.trackEvent('otp_requested', { method: this.loginType().toLowerCase() });
        } else {
          const errorMsg = response.message || 'Failed to send OTP';
          this.error.set(errorMsg);
          this.notification.error('Failed', errorMsg);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err?.error?.message || 'An error occurred while sending OTP';
        this.error.set(errorMsg);
        this.logger.error('Send OTP error:', err);
      },
    });
  }

  /**
   * Verify OTP entered by user
   */
  verifyOtp(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const otp = this.otpModel();

    const payload: VerifyOTPRequest = {
      session_id: Number(otp.session_id),
      otp: otp.otp,
      browser_session_id: this.storage.getOrCreateBrowserSessionId(),
      utm_url: this.storage.getCookie(UTM_COOKIE_KEY) || undefined,
      // Reflects the consent checkbox state from the login step. `consent` is
      // preserved across the LOGIN → OTP transition, so it holds the value the
      // user had checked when requesting the OTP. Defaults to false.
      sms_consent: this.authModel().consent ?? false,
    };

    this.http.post<VerifyOtpResponse>(AUTH_ROUTES.verifyOtp.path, payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);

        if (response.status && response.data) {
          const { token, refreshtoken, user } = response.data;

          this.auth.storeTokens(token, refreshtoken);

          // Update auth state
          this.auth.setAuthenticated(user);
          // Register GA4 identity + user properties BEFORE the activation events.
          // The currentUser effect also identifies, but it runs asynchronously —
          // i.e. AFTER the synchronous events below — so without this the
          // `sign_up` / `account_create` hits would be sent before the user
          // properties are set.
          this.analytics.flushIdentity();
          // Activation event: brand-new account vs returning login.
          this.analytics.trackEvent(
            (user as { is_existing_user?: boolean })?.is_existing_user === false
              ? 'sign_up'
              : 'login',
            { method: this.loginType().toLowerCase() },
          );
          // CPE-parity GA4 lifecycle: a brand-new account also emits
          // `account_create` with the shared user_properties. current_plan isn't
          // part of the verify-otp payload, so subscription_status resolves to
          // "inactive" here (matches CPE-Masterclass).
          if ((user as { is_existing_user?: boolean })?.is_existing_user === false) {
            this.analytics.trackAccountCreate(user as User);
          }

          // Refresh `currentPlan` so the header (`hasActivePlan`) and the
          // engagement-dialog gating reflect the just-signed-in user
          // immediately — without this, the header keeps the pre-login
          // (null) plan until the next `fetchMyProfile` cycle, and the
          // subscription popup can fire on a user who's already subscribed.
          // Fire-and-forget — navigation doesn't need to wait for it.
          this.auth.fetchCurrentPlan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

          this.notification.success('Login Successful', 'Welcome back!');

          // Navigate to redirect URL or home
          const redirect = this.route.snapshot.queryParamMap.get('redirect');
          this.router.navigateByUrl(redirect || '/');
        } else {
          const errorMsg = response.message || 'Failed to verify OTP';
          this.error.set(errorMsg);
          this.notification.error('Verification Failed', errorMsg);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err?.error?.message || 'An error occurred while verifying OTP';
        this.error.set(errorMsg);
        this.logger.error('Verify OTP error:', err);
      },
    });
  }

  /**
   * Legacy method - calls sendOtp
   */
  submitLogin(): void {
    this.sendOtp();
  }

  /** Re-request an OTP. Disabled until the existing timer has expired. */
  resendOtp(): void {
    if (!this.canResendOtp() || this.isLoading()) return;
    this.sendOtp();
  }

  private startResendTimer(): void {
    this.stopResendTimer();
    const total = AuthFacade.RESEND_TIMER_SECONDS;
    this.resendSecondsLeft.set(total);
    // `takeUntil(resendCancel$)` cancels prior timers in place (no callback
    // accumulation on DestroyRef); `takeUntilDestroyed` is still the outer
    // safety net for facade tear-down.
    interval(1000)
      .pipe(take(total), takeUntil(this.resendCancel$), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resendSecondsLeft.update((s) => Math.max(0, s - 1)));
  }

  private stopResendTimer(): void {
    this.resendCancel$.next();
    this.resendSecondsLeft.set(0);
  }

  /**
   * Get current URL (SSR safe)
   */
  private getCurrentUrl(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return '';
    }
    return this.document.location.href;
  }

  clear(): void {
    // Reset local state
    this.loginForm().reset();
    this.otpForm().reset();
    this.authModel.set({
      identifier: '',
      email: '',
      country_code: '+91',
      phone: '',
      // Must mirror the `authModel` defaults — `clear()` runs when the login page is
      // destroyed, so these are the values the next visit starts from.
      terms: true,
      consent: false,
    });

    this.otpModel.set({
      session_id: '',
      otp: '',
    });

    this.loginMethod.set('PHONE');
    this.loginStep.set('LOGIN');
    this.isLoading.set(false);
    this.error.set(null);
    this.stopResendTimer();
  }
}
