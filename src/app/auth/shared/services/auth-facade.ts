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
import { HttpContext } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { form, required, validate } from '@angular/forms/signals';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject, filter, interval, map, take, takeUntil } from 'rxjs';
import {
  AuthModel,
  CountryCodeOption,
  OtpModel,
  SSO_AUTH_ROUTES,
  SsoBlockedData,
  SsoIdentifyResult,
  SsoOtpChannel,
  SsoRateLimitData,
  SsoSendOtpRequest,
  SsoVerifyOtpRequest,
  User,
} from '../../../shared/core/models/auth.model';
import { RouteResponse, SKIP_ERROR_NOTIFICATION } from '../../../shared/core/models/http.model';
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
import { SalesforceLead } from '../../../shared/core/services/salesforce-lead/salesforce-lead';

type IdentifyResponse = RouteResponse<typeof SSO_AUTH_ROUTES.identify>;
type SendOtpResponse = RouteResponse<typeof SSO_AUTH_ROUTES.sendOtp>;
type VerifyOtpResponse = RouteResponse<typeof SSO_AUTH_ROUTES.verifyOtp>;

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
  private readonly salesforceLead = inject(SalesforceLead);

  // Loading and error states
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Seconds remaining before the user can request a fresh OTP. `0` ⇒ resendable.
   *
   * The server enforces a 60-second cooldown per identifier. A shorter UI timer
   * just invites a guaranteed 429, so this matches it — and a real 429 overrides
   * it with `retry_after_seconds`, because the cooldown is not the only limit
   * behind that status (hourly caps, per-IP, blocked country) and we must not
   * guess which one was hit.
   */
  private static readonly RESEND_TIMER_SECONDS = 60;

  /** Digits the OTP input renders. Mirrors `[length]` on `<app-otp>`. */
  private static readonly OTP_LENGTH = 6;
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

  /**
   * How the code was actually delivered, straight from the send response.
   *
   * Never inferred from the selected tab. An Indian phone number is routed by
   * WhatsApp, and a WhatsApp send the provider refuses is retried on SMS and
   * comes back as `sms` — so "check your SMS" would be wrong copy in both
   * directions if we guessed.
   */
  readonly otpChannel = signal<SsoOtpChannel | null>(null);

  /**
   * What `/auth/identify` said about this identifier.
   *
   * Null until the first submit. Held rather than discarded because it carries
   * the masked address (better than echoing what the user typed) and, once
   * enterprise SSO ships, the `saml` method that must not be rendered as an
   * OTP box.
   */
  readonly identifyResult = signal<SsoIdentifyResult | null>(null);

  /**
   * Whether SSO offers a one-time code for this identifier at all.
   *
   * Treated as true before we have asked, so the form is never disabled on a
   * missing answer. Only a definite "no OTP method" blocks the send.
   */
  readonly otpAvailable = computed(() => {
    const methods = this.identifyResult()?.methods;
    if (!methods?.length) return true;
    return methods.some((m) => m === 'email_otp' || m === 'phone_otp');
  });

  /** Where the code went, for the OTP screen: "Code sent by WhatsApp to …". */
  readonly otpChannelLabel = computed(() => {
    switch (this.otpChannel()) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'sms':
        return 'SMS';
      case 'email':
        return 'email';
      default:
        return '';
    }
  });

  /**
   * Offer "send by SMS instead" once a code has gone out over WhatsApp.
   *
   * A number with no WhatsApp account cannot be detected server-side — that
   * fails at delivery, after the send has already answered 200 — so this action
   * is the only way those users can receive a code at all.
   */
  readonly canFallbackToSms = computed(() => this.otpChannel() === 'whatsapp');

  /** The identifier as it should appear on the OTP confirmation screen. */
  readonly displayIdentifier = computed(() => {
    // Prefer the mask `/auth/identify` returned for the channel the code
    // actually went to. It is built from the stored address, so on an account
    // whose email differs from what was typed it shows where the code really
    // landed — which is the whole question the user has at this point.
    const identified = this.identifyResult();
    if (identified) {
      const masked =
        this.otpChannel() === 'email' ? identified.masked_email : identified.masked_phone;
      if (masked) return masked;
    }

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
    // `identifier` is deliberately NOT cleared: going back to LOGIN keeps what
    // the user typed, and a resend from there must post the same value.
    this.otpModel.update((m) => ({ ...m, otp: '' }));
    this.loginStep.set('LOGIN');
    this.otpChannel.set(null);
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
    identifier: '',
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
    // Must match `[length]` on `<app-otp>` in login.html. The two move
    // together: the input renders that many boxes, and a shorter minimum here
    // would enable Verify on a half-typed code.
    //
    // Miles SSO treats code length as a server-side setting and its API
    // accepts 4-10, so a single free-text field would survive a change to it
    // without a deploy. Adopting that means replacing the fixed box strip,
    // which is a login-page design change and deliberately out of scope here.
    validate(otpSchema.otp, ({ value }) => {
      const code = value();
      if (!code) return null;
      if (!/^\d+$/.test(code)) return { kind: 'pattern', message: 'Digits only' };
      if (code.length !== AuthFacade.OTP_LENGTH) {
        return { kind: 'minlength', message: `OTP must be ${AuthFacade.OTP_LENGTH} digits` };
      }
      return null;
    });
  });

  /**
   * Opts these two calls out of `authInterceptor`'s generic error toast.
   *
   * Send and verify have three failure modes the user must be able to tell
   * apart — blocked (403), rate limited (429), provider down (503) — and this
   * facade renders each one specifically. Without this, every failure would
   * also raise a second, vaguer toast beside it.
   */
  private authRequestContext(): HttpContext {
    return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
  }

  /**
   * Send a verification code to the typed email or phone.
   *
   * `channel` is only ever set from a deliberate user action ("send by SMS
   * instead") — an explicit channel is honoured exactly as sent and never
   * rerouted, so passing one by default would defeat the country routing.
   */
  sendOtp(channel?: 'sms' | 'whatsapp'): void {
    this.isLoading.set(true);
    this.error.set(null);

    const auth = this.authModel();
    const loginType = this.loginType();

    const payload: SsoSendOtpRequest = {
      ...(loginType === 'EMAIL'
        ? { email: auth.identifier }
        : { phone: auth.identifier, country_code: auth.country_code }),
      ...(channel ? { channel } : {}),
    };

    this.http
      .post<SendOtpResponse>(SSO_AUTH_ROUTES.sendOtp.path, payload, {
        context: this.authRequestContext(),
      })
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);

          if (!response.status || !response.data) {
            const errorMsg = response.message || 'Failed to send OTP';
            this.error.set(errorMsg);
            this.notification.error('Failed', errorMsg);
            return;
          }

          const { identifier, channel: deliveredChannel } = response.data;

          // The identifier the server actually used — a phone was normalised to
          // E.164 on the way in, and verify must be posted with the same value.
          this.otpModel.update((model) => ({ ...model, identifier }));
          this.otpChannel.set(deliveredChannel);

          this.notification.success(
            'OTP Sent',
            // Copy comes from the channel the server reports, never from the tab.
            deliveredChannel === 'email'
              ? 'Please check your inbox for the verification code.'
              : `Verification code sent by ${this.otpChannelLabel()}.`,
          );
          this.loginStep.set('OTP');
          this.startResendTimer();
          this.analytics.trackEvent('otp_requested', {
            method: this.loginType().toLowerCase(),
            channel: deliveredChannel,
          });
        },
        error: (err) => {
          this.isLoading.set(false);
          this.handleSendOtpError(err);
        },
      });
  }

  /**
   * Explicit "the WhatsApp code never arrived" fallback.
   *
   * A number with no WhatsApp account cannot be detected server-side: that
   * fails at delivery, long after the send returned 200. This action is the
   * only route those users have to a code.
   */
  resendOverSms(): void {
    if (this.isLoading()) return;
    this.stopResendTimer();
    this.sendOtp('sms');
  }

  /**
   * Send failures come in three flavours the UI must not conflate.
   */
  private handleSendOtpError(err: unknown): void {
    const status = (err as { status?: number })?.status;
    const body = (err as { error?: { message?: string; data?: unknown } })?.error;
    const message = body?.message;

    // 403 — a gate refused this learner before any code was sent. Render the
    // reason (the LMS migration prompt), not a login error.
    if (status === 403) {
      const data = body?.data as SsoBlockedData | undefined;
      if (data?.is_lms_access_blocked) {
        this.dialog.open(UtilsDialog, {
          data: CONTENT_MAP[data.lms_user_type ?? 'non_lms'],
        });
        return;
      }
    }

    // 429 — rate limited or locked out. The message is deliberately identical
    // for every cause (cooldown, hourly cap, per-IP, blocked country), so show
    // it as-is and count down from what the server gives us rather than
    // asserting "wait 60 seconds" when the real answer might be an hour.
    if (status === 429) {
      const retryAfter = (body?.data as SsoRateLimitData | undefined)?.retry_after_seconds;
      this.startResendTimer(retryAfter ?? AuthFacade.RESEND_TIMER_SECONDS);
      const errorMsg = message || 'Too many attempts. Please try again later.';
      this.error.set(errorMsg);
      this.notification.error('Please wait', errorMsg);
      return;
    }

    // 503 — the mail or SMS provider refused the send. Nothing arrived and
    // nothing will, so stay on this step: advancing to the code box would ask
    // the user to type a code that does not exist.
    if (status === 503) {
      const errorMsg =
        message ||
        'Unable to send a verification code right now. Please try again in a few minutes.';
      this.error.set(errorMsg);
      this.notification.error('Could not send code', errorMsg);
      return;
    }

    const errorMsg = message || 'An error occurred while sending OTP';
    this.error.set(errorMsg);
    this.logger.error('Send OTP error:', err);
  }

  /**
   * Redeem the code and complete sign-in.
   *
   * Also the sign-up path: an identifier SSO has never seen is registered
   * during this call, so a verified code always yields a usable account. Those
   * users come back with `onboarding_required: true`.
   */
  verifyOtp(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const otp = this.otpModel();

    const payload: SsoVerifyOtpRequest = {
      // The identifier the send step returned, not the raw field value — the
      // server normalised a phone to E.164 and verify has to match it.
      identifier: otp.identifier,
      code: otp.otp,
      browser_session_id: this.storage.getOrCreateBrowserSessionId(),
      utm_url: this.storage.getCookie(UTM_COOKIE_KEY) || undefined,
      // Reflects the consent checkbox from the login step, which is preserved
      // across the LOGIN -> OTP transition. Defaults to false.
      sms_consent: this.authModel().consent ?? false,
    };

    this.http
      .post<VerifyOtpResponse>(SSO_AUTH_ROUTES.verifyOtp.path, payload, {
        context: this.authRequestContext(),
      })
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);

          if (!response.status || !response.data) {
            const errorMsg = response.message || 'Failed to verify OTP';
            this.error.set(errorMsg);
            this.notification.error('Verification Failed', errorMsg);
            return;
          }

          const session = response.data;
          const user = session.user;

          // `expires_in` matters: the access token is short (15 min target), and
          // passing it here is what arms the proactive refresh so the user never
          // sees an expiry.
          this.auth.storeTokens(session.token, session.refreshtoken, session.expires_in);
          this.auth.setAuthenticated(user);

          // Register GA4 identity + user properties BEFORE the activation events.
          // The currentUser effect also identifies, but it runs asynchronously —
          // i.e. AFTER the synchronous events below — so without this the
          // `sign_up` / `account_create` hits would be sent before the user
          // properties are set.
          this.analytics.flushIdentity();

          // Activation event: brand-new account vs returning login. `is_signup`
          // is the server's own verdict, decided while resolving the identity —
          // more reliable than inferring it from the user payload.
          const isNewAccount =
            session.is_signup ??
            (user as { is_existing_user?: boolean })?.is_existing_user === false;

          this.analytics.trackEvent(isNewAccount ? 'sign_up' : 'login', {
            method: this.loginType().toLowerCase(),
          });

          if (isNewAccount) {
            // CPE-parity GA4 lifecycle: a brand-new account also emits
            // `account_create` with the shared user_properties.
            this.analytics.trackAccountCreate(user as User);
            // CRM lead — account creation only. A returning login must not create
            // a second lead, so this sits inside the same branch.
            this.salesforceLead.create({
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              phone: user.mobile,
              country_code: user.country_code,
            });
          }

          // Refresh `currentPlan` so the header (`hasActivePlan`) and the
          // engagement-dialog gating reflect the just-signed-in user immediately.
          // Fire-and-forget — navigation doesn't need to wait for it.
          this.auth.fetchCurrentPlan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

          this.notification.success('Login Successful', 'Welcome back!');

          const redirect = this.route.snapshot.queryParamMap.get('redirect');
          this.router.navigateByUrl(redirect || '/');
        },
        error: (err) => {
          this.isLoading.set(false);
          this.handleVerifyOtpError(err);
        },
      });
  }

  /**
   * Verify failures. A wrong or expired code is a 401 and is the common case;
   * a 403 means a gate refused this learner even though the code was fine.
   */
  private handleVerifyOtpError(err: unknown): void {
    const status = (err as { status?: number })?.status;
    const body = (err as { error?: { message?: string; data?: unknown } })?.error;
    const message = body?.message;

    if (status === 403) {
      const data = body?.data as SsoBlockedData | undefined;
      if (data?.is_lms_access_blocked) {
        this.dialog.open(UtilsDialog, {
          data: CONTENT_MAP[data.lms_user_type ?? 'non_lms'],
        });
        return;
      }
    }

    if (status === 429) {
      // Repeated wrong codes lock the identifier, which is a different state
      // from "wrong code" — the next attempt will fail no matter what is typed.
      const retryAfter = (body?.data as SsoRateLimitData | undefined)?.retry_after_seconds;
      this.startResendTimer(retryAfter ?? AuthFacade.RESEND_TIMER_SECONDS);
      const errorMsg = message || 'Too many attempts. Please try again later.';
      this.error.set(errorMsg);
      this.notification.error('Please wait', errorMsg);
      return;
    }

    const errorMsg =
      message ||
      (status === 401
        ? 'That code is incorrect or has expired.'
        : 'An error occurred while verifying OTP');
    this.error.set(errorMsg);
    this.logger.error('Verify OTP error:', err);
  }

  /**
   * Legacy method - calls sendOtp
   */
  /**
   * Login form submit: ask SSO how this person authenticates, then send a code.
   *
   * Rule one of the SSO contract — never hardcode "show the OTP box". Today the
   * answer is always an OTP method for a B2C account, so this looks redundant;
   * it is not. A B2B company can configure `password`, and when enterprise SSO
   * ships the same call starts answering `saml`. Reading `methods` means those
   * users hit a real message instead of a code that never arrives, and the day
   * SAML lands this client needs no change.
   *
   * Identify failing does **not** block the login: it is advisory, and a
   * degraded lookup should not stop a learner signing in the way that has
   * worked for years. The send below is the call that actually matters.
   */
  submitLogin(): void {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    this.error.set(null);

    const auth = this.authModel();
    const payload =
      this.loginType() === 'EMAIL'
        ? { email: auth.identifier }
        : { phone: auth.identifier, country_code: auth.country_code };

    this.http
      .post<IdentifyResponse>(SSO_AUTH_ROUTES.identify.path, payload, {
        context: this.authRequestContext(),
      })
      .subscribe({
        next: (response) => {
          const result = response.status ? (response.data ?? null) : null;
          this.identifyResult.set(result);

          if (result && !this.otpAvailable()) {
            // SSO knows this account and offers no one-time code for it —
            // sending anyway would mail nothing and leave the user staring at
            // an OTP box.
            this.isLoading.set(false);
            const msg =
              'This account signs in with a password. Please contact support to continue.';
            this.error.set(msg);
            this.notification.error('Different sign-in required', msg);
            return;
          }

          this.sendOtp();
        },
        error: (err) => {
          // Advisory only — fall through to the send rather than stranding the
          // user on a working login form.
          this.logger.warn('Identify failed; continuing to send OTP', err);
          this.identifyResult.set(null);
          this.sendOtp();
        },
      });
  }

  /** Re-request an OTP. Disabled until the existing timer has expired. */
  resendOtp(): void {
    if (!this.canResendOtp() || this.isLoading()) return;
    this.sendOtp();
  }

  /**
   * @param seconds Override for the default cooldown. Pass the `429`'s
   *   `retry_after_seconds` so the countdown reflects the limit that was
   *   actually hit — it is not always the 60-second cooldown.
   */
  private startResendTimer(seconds?: number): void {
    this.stopResendTimer();
    const total = Math.max(1, Math.ceil(seconds ?? AuthFacade.RESEND_TIMER_SECONDS));
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
      identifier: '',
      otp: '',
    });

    this.loginMethod.set('PHONE');
    this.loginStep.set('LOGIN');
    this.otpChannel.set(null);
    this.identifyResult.set(null);
    this.isLoading.set(false);
    this.error.set(null);
    this.stopResendTimer();
  }
}
