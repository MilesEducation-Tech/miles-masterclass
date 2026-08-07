import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  form,
  minLength,
  required,
  validate,
  FormField as AngularFormField,
} from '@angular/forms/signals';
import { Button } from '../../../../shared/components/ui/button/button';
import { Forms } from '../../../../shared/components/ui/forms/forms';
import { AriaInput } from '../../../../shared/components/ui/aria/aria-input/aria-input';
import { AriaAutocomplete } from '../../../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { Otp } from '../../../../shared/components/ui/otp/otp';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { TabStrip } from '../../../../shared/components/ui/tab-strip/tab-strip';
import { Utils } from '../../../../shared/core/services/utils/utils';
import { dialCodeWithLength } from '../../../../shared/core/constant/dial-code';
import { AuthFacade, LoginOutcome } from '../../services/auth-facade';

/** What the login form collects. The form's own shape, not a wire payload. */
interface AuthModel {
  identifier: string;
  email: string;
  /** Email tab only. CAIRA has no email-OTP route, so email login is password-based. */
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
    TabStrip,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly utils = inject(Utils);
  private readonly router = inject(Router);
  private readonly facade = inject(AuthFacade);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The template binds to `authFacade.*` throughout. The form model and its
   * validation live here — they are design, not transport — while the network
   * half lives in `AuthFacade`. Keeping the alias means the template did not
   * have to change when the backend came back.
   */
  readonly authFacade = this;

  readonly isLoading = this.facade.isLoading;
  readonly error = this.facade.error;

  /**
   * `OTP` is reachable from the Mobile tab only. The Email tab authenticates in
   * one step against `web/login-with-email-password` — **CAIRA has no
   * email-OTP endpoint**. (`otp/generate` / `otp/validate` exist but are
   * post-login email verification, not a login path.)
   */
  readonly loginStep = signal<'LOGIN' | 'OTP'>('LOGIN');

  /** Source of truth for the login method picked via the tab strip. */
  readonly loginMethod = signal<'PHONE' | 'EMAIL'>('PHONE');
  readonly loginMethodTabs = ['Mobile', 'Email'] as const;
  readonly selectedTabLabel = computed(() => (this.loginMethod() === 'PHONE' ? 'Mobile' : 'Email'));
  readonly loginType = computed(() => this.loginMethod());

  /**
   * "Send OTP" is only honest on the Mobile tab — the Email tab signs in
   * directly against #33 and never reaches the OTP step.
   */
  readonly submitLabel = computed(() => {
    if (this.loginStep() === 'OTP') return 'Verify OTP';
    return this.loginType() === 'EMAIL' ? 'Log In' : 'Send OTP';
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
    // Neither tab renders a mandatory terms checkbox — acceptance is implied by
    // the notice above the submit button, so `terms` is held accepted.
    // Promotional consent stays an explicit opt-in and must start unchecked.
    terms: true,
    consent: false,
  });

  readonly otpModel = signal<OtpModel>({ session_id: '', otp: '' });

  readonly loginForm = form<AuthModel>(this.authModel, (loginSchema) => {
    // `validate` rather than `pattern` because the rule depends on the active
    // tab, and `pattern` expects a static RegExp.
    validate(loginSchema.identifier, ({ value }) => {
      const type = this.loginType();
      // Let `required` own the empty case so an untouched Mobile field doesn't
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

    // Password is Email-tab only. `when` is the one option `required` supports
    // (every other validator needs `applyWhen`), which is exactly the shape
    // this rule needs.
    required(loginSchema.password, {
      message: 'Please enter your password',
      when: () => this.loginType() === 'EMAIL',
    });
  });

  readonly otpForm = form<OtpModel>(this.otpModel, (otpSchema) => {
    required(otpSchema.otp, { message: 'Please enter the OTP' });
    minLength(otpSchema.otp, 6, { message: 'OTP must be 6 digits' });
  });

  /** Seconds remaining before a fresh OTP can be requested. `0` ⇒ resendable. */
  readonly resendSecondsLeft = this.facade.resendSecondsLeft;
  readonly canResendOtp = this.facade.canResendOtp;
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
   * Marketing-consent text (feeds `sms_consent`). The phone copy ends
   * mid-sentence at "…or contact": the support mailto, the "Consent is not a
   * condition of purchase." sentence and the policy links are rendered by the
   * template's `labelLink` slot immediately after.
   */
  readonly consentLabel = computed(() =>
    this.loginType() === 'PHONE'
      ? 'I agree to receive recurring informational and promotional messages from Miles Masterclass via SMS and WhatsApp, including webinar registration confirmations, reminders, joining instructions, educational updates, course information and offers, sent using automated technology. Message frequency may vary. Message and data rates may apply. Reply STOP to opt out or HELP for assistance, or contact'
      : "I'd like to receive promotional and informational emails from Miles Masterclass, including invitations to upcoming events, program updates, and offers. I can unsubscribe at any time using the link in any email.",
  );

  readonly supportEmail = 'support@milesmasterclass.com';

  /**
   * `supportEmail` split at the "@" so the template can place a `<wbr>` between
   * the parts — without a break opportunity the browser moves the whole address
   * to the next line, leaving a visible gap after "…or contact".
   */
  readonly supportEmailParts = {
    local: this.supportEmail.slice(0, this.supportEmail.indexOf('@') + 1),
    domain: this.supportEmail.slice(this.supportEmail.indexOf('@') + 1),
  };

  /** Country/profession-scoped routes for the consent policy links. */
  readonly legalLinks = computed(() => {
    const { country, profession } = this.utils.getRouteParams();
    const base = `/${country?.toLowerCase()}/${profession}`;
    return {
      terms: `${base}/terms-of-service`,
      privacy: `${base}/privacy-policy`,
    };
  });

  /**
   * Switch between the Mobile/Email tabs. The typed identifier (and its
   * touched/dirty state) is cleared so a half-typed email isn't validated as a
   * phone number and vice-versa.
   */
  selectLoginMethod(label: string): void {
    const method = label === 'Mobile' ? 'PHONE' : 'EMAIL';
    if (method === this.loginMethod()) return;
    this.loginMethod.set(method);
    // Clear the password too — leaving a typed password in the model while the
    // Mobile tab is active would send it nowhere, but it would sit in memory
    // and in any state snapshot for the rest of the session.
    this.authModel.update((m) => ({ ...m, identifier: '', password: '' }));
    this.loginForm.identifier().reset();
    this.loginForm.password().reset();
    this.facade.reset();
  }

  /**
   * Return to the LOGIN step from OTP without wiping the identifier the user
   * typed. `terms` and `consent` are intentionally preserved.
   */
  goBackToLogin(): void {
    this.otpForm().reset();
    this.otpModel.set({ session_id: '', otp: '' });
    this.loginStep.set('LOGIN');
    // Drops the stored `session_id` and the resend cooldown — going back means
    // the next attempt starts a fresh OTP session, not a replay of the old one.
    this.facade.reset();
  }

  /**
   * Step one. Email authenticates outright (#33); phone sends an OTP (#34) and
   * advances to the OTP step.
   */
  submitLogin(): void {
    const { identifier, password, country_code } = this.authModel();

    const request =
      this.loginType() === 'EMAIL'
        ? this.facade.loginWithPassword(identifier, password)
        : this.facade.sendOtp(country_code, identifier);

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
    this.facade.verifyOtp(this.otpModel().otp).subscribe((outcome) => {
      this.handleTerminalOutcome(outcome);
    });
  }

  /** Replays #34; the server issues a fresh `session_id`. */
  resendOtp(): void {
    if (!this.canResendOtp() || this.isLoading()) return;
    const { country_code, identifier } = this.authModel();
    this.facade.resendOtp(country_code, identifier).subscribe();
  }

  /**
   * Everything that ends the login attempt.
   *
   * `profile-incomplete` is a 403 from the web login gate: the token is
   * withheld, so there is nothing to route into the app with — the learner has
   * to finish onboarding in the Miles One app. It is shown as a message rather
   * than a redirect for that reason. `multiple-accounts` is a 409 that only
   * support can resolve. Both already populate `facade.error`, so the template
   * renders them without extra wiring; the switch exists so a future redirect
   * has an obvious home and so a new outcome kind fails the type check.
   */
  private handleTerminalOutcome(outcome: LoginOutcome): void {
    switch (outcome.kind) {
      case 'authenticated':
        void this.router.navigate(['/']);
        return;
      case 'profile-incomplete':
      case 'multiple-accounts':
      case 'error':
        return;
      case 'otp-sent':
        return;
    }
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
}
