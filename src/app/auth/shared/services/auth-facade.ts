import { DestroyRef, Service, computed, inject, linkedSignal, signal } from '@angular/core';
import { form, required, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';

import { CountryCodeOption, dialCodeWithLength } from '../../../shared/core/constant/dial-code';
import {
  AuthFailure,
  OtpChannel,
  isTerminalFailure,
  toAuthFailure,
} from '../../../shared/core/models/auth.model';
import { AuthSession } from '../../../shared/core/services/auth-session/auth-session';
import { HttpErrorResponse } from '@angular/common/http';

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
 * Five wrong codes lock the identifier server-side. Nothing in the 401 body
 * reports the tally, so it is counted here. It WARNS; it never blocks — the
 * server owns the lock and a 429 is what actually reports it.
 */
const MAX_ATTEMPTS = 5;

/** Used only until a send response tells us the real `cooldownSeconds`. */
const FALLBACK_COOLDOWN_SECONDS = 60;

/**
 * The sign-in screen's own state.
 *
 * This is a facade because the login page is genuinely multi-step: the
 * LOGIN↔OTP toggle, the resend cooldown, the attempt tally and two form models
 * are all state that must die when the user leaves `/auth`. Hence
 * `autoProvided: false` and `providers: [AuthFacade]` on the auth route —
 * anything longer-lived belongs in `AuthSession`, which is where the session
 * itself lives.
 *
 * Everything the template binds to is kept; `login.html` is the spec.
 */
@Service({ autoProvided: false })
export class AuthFacade {
  private static readonly OTP_LENGTH = 6;

  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginStep = signal<'LOGIN' | 'OTP'>('LOGIN');

  /**
   * A terminal failure (`account_blocked` / `account_deactivated`) is not a
   * sign-in problem the user can retry their way out of, so the form is closed
   * off entirely rather than left inviting another attempt.
   */
  readonly isTerminal = signal(false);

  /**
   * Which login method the tab strip has selected. Defaults to PHONE.
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

  // ── OTP delivery / rate-limit surface ─────────────────────────────────────

  /** `channel` from the send RESPONSE — never inferred from what was sent. */
  private readonly channel = signal<OtpChannel | null>(null);
  private readonly cooldownUntil = signal(0);
  private readonly lockedUntil = signal(0);
  private readonly failedAttempts = signal(0);
  private readonly sendCount = signal(0);
  /** Ticks once a second while a countdown is running; nothing else reads it. */
  private readonly now = signal(Date.now());

  private get secondsLeft(): number {
    const until = Math.max(this.cooldownUntil(), this.lockedUntil());
    return Math.max(0, Math.ceil((until - this.now()) / 1000));
  }

  readonly isLockedOut = computed(() => this.lockedUntil() > this.now());
  readonly canSendOtp = computed(() => !this.isLockedOut() && this.cooldownUntil() <= this.now());

  readonly attemptsRemaining = computed<number | null>(() => {
    const used = this.failedAttempts();
    if (used === 0 || this.isLockedOut()) return null;
    return Math.max(0, MAX_ATTEMPTS - used);
  });

  /**
   * Every resend invalidates the code already in flight, so the moment a second
   * one exists the user has to be told which to type.
   */
  readonly showUseLatestHint = computed(() => this.sendCount() > 1);

  /**
   * `'sms'` is deliberately never returned. `channel` is NOT an accepted input
   * on `auth-otp-send/` — the SSO takes it as an optional override but the route
   * does not declare it, so sending it is a 400. Offering "send by SMS instead"
   * would be offering something the API cannot do.
   */
  readonly resendAction = computed<'resend' | 'sms' | 'email'>(() =>
    this.isLockedOut() && this.loginType() === 'PHONE' ? 'email' : 'resend',
  );

  readonly resendTimerDisplay = computed(() => {
    const total = this.secondsLeft;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  readonly otpDeliveryNote = computed(() => {
    switch (this.channel()) {
      case 'email':
        return 'by email';
      case 'whatsapp':
        return 'on WhatsApp';
      case 'sms':
        return 'by SMS';
      default:
        return '';
    }
  });

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
   * Where the code *would* go, before any response has said so.
   *
   * Every country currently resolves to SMS at the SSO — WhatsApp routing is
   * off until delivery is proved end to end — so this no longer singles out
   * +91. Once the code is sent, `otpDeliveryNote` states what actually
   * happened, which is the only trustworthy source.
   */
  readonly expectedDeliveryNote = computed(() =>
    this.loginType() === 'EMAIL' ? 'by email' : 'by SMS',
  );

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

  constructor() {
    // One interval for every countdown on the screen. Cleared with the facade,
    // which dies with the auth route.
    const ticker = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(ticker));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * The identifier as the API wants it: one string, email as typed, phone as
   * E.164.
   *
   * ponytail: E.164 is an ASSUMPTION, not a verified fact — every `auth-*`
   * route on UAT answers 503 ("Sign-in is not configured on this environment")
   * as of 2026-09-22, so no live call could confirm the format. It is isolated
   * here so correcting it is a one-line change.
   */
  private toIdentifier(): string {
    const model = this.authModel();
    if (this.loginType() !== 'PHONE') return model.identifier.trim();
    return `${model.country_code}${model.identifier}`.replace(/\s+/g, '');
  }

  /**
   * `auth-identify/` then `auth-otp-send/`. Identify is the first call of any
   * login, always — it reports which methods this identifier can use, and it is
   * where SAML will appear when enterprise SSO ships.
   */
  async submitLogin(): Promise<void> {
    if (this.isLoading() || !this.canSendOtp()) return;

    const identifier = this.toIdentifier();
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const identity = await this.auth.identify(identifier);

      // Render what the SSO says is available rather than assuming an OTP box.
      // A client that reads this list needs no change when `saml` starts
      // appearing here; one that hardcoded the form needs a rewrite.
      if (identity.methods?.length && !identity.methods.includes('otp')) {
        this.error.set(
          'This account signs in through your organisation. Please use your company sign-in page.',
        );
        return;
      }

      await this.send(identifier);
      this.otpModel.set({ identifier: this.displayIdentifier(), otp: '' });
      this.loginStep.set('OTP');
    } catch (err) {
      this.renderFailure(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Exchange the code for a session and route on the milestone it reports. */
  async verifyOtp(): Promise<void> {
    if (this.isLoading() || this.isLockedOut()) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const session = await this.auth.verifyOtp(this.toIdentifier(), this.otpModel().otp);
      this.failedAttempts.set(0);

      // Rule 4: the milestone, not a token claim.
      const redirect = this.route.snapshot.queryParamMap.get('redirect');
      await this.router.navigateByUrl(
        session.profile_status === 'new_user' ? '/auth/profile' : (redirect ?? '/'),
      );
    } catch (err) {
      const failure = this.renderFailure(err);
      if (failure.kind === 'bad_code') {
        this.failedAttempts.update((n) => n + 1);
      }
      if (failure.kind === 'retry_new_code') {
        // The code they used is spent. Send them back for a fresh one rather
        // than leaving them retyping one that can no longer work.
        this.goBackToLogin();
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendOtp(): Promise<void> {
    if (this.isLoading() || !this.canSendOtp()) return;

    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.send(this.toIdentifier());
    } catch (err) {
      this.renderFailure(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async send(identifier: string): Promise<void> {
    const sent = await this.auth.sendOtp(identifier);
    this.channel.set(sent.channel ?? null);
    this.sendCount.update((n) => n + 1);
    // Read the cooldown off the response; never hardcode one.
    const seconds = sent.cooldownSeconds ?? FALLBACK_COOLDOWN_SECONDS;
    this.now.set(Date.now());
    this.cooldownUntil.set(Date.now() + seconds * 1000);
  }

  /** Maps an error onto the specific state the template renders for it. */
  private renderFailure(err: unknown): AuthFailure {
    const failure = toAuthFailure(
      err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }),
    );

    if (failure.kind === 'locked') {
      // The server owns the lock; 30 minutes is what the contract documents.
      this.now.set(Date.now());
      this.lockedUntil.set(Date.now() + 30 * 60 * 1000);
    }
    if (isTerminalFailure(failure)) {
      // Not a login problem. Show a permission message, not a login screen.
      this.isTerminal.set(true);
    }

    this.error.set(failure.message);
    return failure;
  }

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

  /**
   * Email is a DIFFERENT identifier, so it is not covered by a phone lockout —
   * which is exactly why this is offered as the way out of one.
   */
  signInWithEmailInstead(): void {
    this.lockedUntil.set(0);
    this.cooldownUntil.set(0);
    this.failedAttempts.set(0);
    this.selectLoginMethod('Email');
    this.goBackToLogin();
  }

  clear(): void {
    this.loginStep.set('LOGIN');
    this.isLoading.set(false);
    this.error.set(null);
    this.isTerminal.set(false);
    this.otpModel.set({ identifier: '', otp: '' });
  }
}
