import { Injectable, computed, linkedSignal, signal } from '@angular/core';
import { form, required, validate } from '@angular/forms/signals';

import { CountryCodeOption, dialCodeWithLength } from '../../../shared/core/constant/dial-code';

export interface AuthModel {
  identifier: string;
  email: string;
  country_code: string;
  phone: string;
  /** Terms acceptance. Held true — the notice by the submit button implies it. */
  terms: boolean;
  /** Optional SMS/WhatsApp (or email) marketing consent. */
  consent: boolean;
}

export interface OtpModel {
  /** The email or E.164 phone the code would be sent to. */
  identifier: string;
  otp: string;
}

/**
 * ponytail: design-only shell.
 *
 * Everything that made this a real login was removed — the SSO send/verify
 * calls, token storage, the `Auth` session service, B2B SSO, analytics, the
 * Salesforce lead push, the rate-limit/lockout bookkeeping and the post-login
 * redirect. What survives is exactly the surface `login.html` binds to, plus
 * the client-side form validation and the LOGIN/OTP step toggle, so the login
 * design still renders and behaves like a form.
 *
 * `submitLogin`, `verifyOtp`, `resendOtp` and `resendOverSms` are inert — they
 * are the four re-wire points if this ever comes back.
 */
@Injectable()
export class AuthFacade {
  private static readonly OTP_LENGTH = 6;

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginStep = signal<'LOGIN' | 'OTP'>('LOGIN');

  /**
   * Which login method the tab strip has selected. Defaults to PHONE.
   * ponytail: was linked to the hidden QA login route; there is no such route
   * any more, so it is simply writable.
   */
  readonly loginMethod = linkedSignal<boolean, 'PHONE' | 'EMAIL'>({
    source: () => false,
    computation: () => 'PHONE',
  });

  /** Tab labels rendered by `app-tab-strip` on the login form. */
  readonly loginMethodTabs = ['Mobile', 'Email'] as const;

  /** The tab label that maps to the current `loginMethod`. */
  readonly selectedTabLabel = computed(() => (this.loginMethod() === 'PHONE' ? 'Mobile' : 'Email'));

  readonly loginType = computed<'EMAIL' | 'PHONE' | 'NONE'>(() => this.loginMethod());

  /** ponytail: the hidden QA login route went with the auth layer. */
  readonly isDevLogin = computed(() => false);

  // ── Inert OTP / rate-limit surface ────────────────────────────────────────
  // All of these were driven by the send/verify responses.
  readonly canSendOtp = computed(() => true);
  readonly isLockedOut = computed(() => false);
  readonly attemptsRemaining = computed<number | null>(() => null);
  readonly showUseLatestHint = computed(() => false);
  readonly resendAction = computed<'resend' | 'sms' | 'email'>(() => 'resend');
  readonly resendTimerDisplay = computed(() => '0:00');
  readonly otpDeliveryNote = computed(() => '');

  readonly authModel = signal<AuthModel>({
    identifier: '',
    email: '',
    country_code: '+1',
    phone: '',
    terms: true,
    consent: false,
  });

  readonly otpModel = signal<OtpModel>({ identifier: '', otp: '' });

  /**
   * Where the code *would* go, from the country code alone. Pre-send copy.
   * India (+91) is the one country routed over WhatsApp.
   */
  readonly expectedDeliveryNote = computed(() => {
    if (this.loginType() === 'EMAIL') return 'by email';
    return this.authModel().country_code === '+91' ? 'on WhatsApp' : 'by SMS';
  });

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
   * The identifier as the confirmation line should show it. Emails are shown
   * whole — masking an address the user typed thirty seconds ago hides the
   * typo they are looking for.
   */
  readonly maskedIdentifier = computed(() => {
    const identifier = this.otpModel().identifier || this.displayIdentifier();
    if (!identifier || identifier.includes('@')) return identifier;
    return `••••• ${identifier.slice(-4)}`;
  });

  // `dialCodeWithLength` lists one row per *country* (e.g. ~24 rows for +1),
  // but the dropdown only needs one option per *dial code*. Keep the first
  // occurrence of each code so the phone-length validator still gets sane
  // min/max bounds.
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

  /**
   * Marketing-consent text. The phone copy ends mid-sentence at "…or contact":
   * the support mailto and the policy links are rendered by the login
   * template's `labelLink` slot, which sits immediately after this text.
   */
  readonly consentLabel = computed(() =>
    this.loginType() === 'PHONE'
      ? 'I agree to receive recurring informational and promotional messages from Miles Masterclass via SMS and WhatsApp, including webinar registration confirmations, reminders, joining instructions, educational updates, course information and offers, sent using automated technology. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for assistance, or contact'
      : "I'd like to receive promotional and informational emails from Miles Masterclass, including invitations to upcoming events, program updates, and offers. I can unsubscribe at any time using the link in any email.",
  );

  /** Support address surfaced in the Mobile consent copy. */
  readonly supportEmail = 'support@milesmasterclass.com';

  /**
   * `supportEmail` split at the "@". The template renders these either side of
   * a `<wbr>` so the address can break at its natural point.
   */
  readonly supportEmailParts = {
    local: this.supportEmail.slice(0, this.supportEmail.indexOf('@') + 1),
    domain: this.supportEmail.slice(this.supportEmail.indexOf('@') + 1),
  };

  readonly loginForm = form<AuthModel>(this.authModel, (loginSchema) => {
    // Dynamic checks rather than `pattern`, which expects a static RegExp.
    validate(loginSchema.identifier, ({ value }) => {
      const type = this.loginType();
      // Let `required` own the empty case so we don't surface "Must be digits"
      // on an untouched/empty Mobile field.
      if (!value()) return null;
      if (type === 'NONE') return null;

      if (type === 'PHONE') {
        if (!/^\d+$/.test(value())) {
          return { kind: 'pattern', message: 'Must be digits' };
        }
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
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value())) {
        return { kind: 'email', message: 'Invalid Email Address' };
      }
      return null;
    });

    validate(loginSchema.country_code, ({ value }) => {
      if (this.loginType() !== 'PHONE') return null;
      if (!value()) return { kind: 'required', message: 'Country code is required' };
      const selectedCode = this.countryCodes().find(
        (c) => c.CountryCode === this.authModel().country_code,
      );
      return selectedCode ? null : { kind: 'required', message: 'Invalid Country code' };
    });

    required(loginSchema.identifier, { message: 'Please enter your email or phone number' });
  });

  readonly otpForm = form<OtpModel>(this.otpModel, (otpSchema) => {
    required(otpSchema.otp, { message: 'Please enter the OTP' });
    // Must match `[length]` on `<app-otp>` in login.html — the input renders
    // that many boxes, and a shorter minimum here would enable Verify on a
    // half-typed code.
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

  selectLoginMethod(label: string): void {
    const method = label === 'Mobile' ? 'PHONE' : 'EMAIL';
    if (method === this.loginMethod()) return;
    this.loginMethod.set(method);
    this.authModel.update((m) => ({ ...m, identifier: '' }));
    this.loginForm.identifier().reset();
    this.error.set(null);
  }

  /**
   * Return to the LOGIN step from OTP without wiping the identifier the user
   * typed. `terms` and `consent` are intentionally preserved.
   */
  goBackToLogin(): void {
    this.otpForm().reset();
    this.otpModel.update((m) => ({ ...m, otp: '' }));
    this.loginStep.set('LOGIN');
    this.isLoading.set(false);
    this.error.set(null);
  }

  signInWithEmailInstead(): void {
    this.selectLoginMethod('Email');
    this.goBackToLogin();
  }

  // ponytail: the four re-wire points. Each hit the SSO API.
  submitLogin(): void {
    // ponytail: inert
  }
  verifyOtp(): void {
    // ponytail: inert
  }
  resendOtp(): void {
    // ponytail: inert
  }
  resendOverSms(): void {
    // ponytail: inert
  }

  clear(): void {
    this.loginStep.set('LOGIN');
    this.isLoading.set(false);
    this.error.set(null);
    this.otpModel.set({ identifier: '', otp: '' });
  }
}
