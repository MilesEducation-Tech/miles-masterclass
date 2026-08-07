import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  form,
  FormField as AngularFormField,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { interval, Subject, take, takeUntil } from 'rxjs';

import { AriaAutocomplete } from '../../../../../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
// AriaCombobox replaced with AriaAutocomplete platform-wide for the company
// field — the combobox primitive wasn't propagating option clicks reliably.
import { AriaInput } from '../../../../../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../../../../../shared/components/ui/button/button';
import { UtilsDialog } from '../../../../../../shared/components/dialog/utils-dialog/utils-dialog';
import { Forms } from '../../../../../../shared/components/ui/forms/forms';
import { Otp } from '../../../../../../shared/components/ui/otp/otp';
import { Spinner } from '../../../../../../shared/components/ui/spinner/spinner';
import { CONTENT_MAP } from '../../../../../../shared/core/config/auth.config';
import { dialCodeWithLength } from '../../../../../../shared/core/constant/dial-code';
import { Router } from '@angular/router';
import { Analytics } from '../../../../../../shared/core/services/analytics/analytics';
import { Dialog } from '../../../../../../shared/core/services/dialog/dialog';
import { Logger } from '../../../../../../shared/core/services/logger/logger';
import { NotificationService } from '../../../../../../shared/core/services/notification/notification';
import { Storage } from '../../../../../../shared/core/services/storage/storage';
import { WebinarRegistrationDirectEnrolled, WebinarRegistrationRequest, WebinarRegistrationResult, WebinarRegistrationVerifyRequest, isWebinarRegistrationAccessBlocked } from '../../models/webinar-registration.model';

// ponytail: were RouteResponse/RouteParams aliases over PROFILE_ROUTES.

// ponytail: Django endpoint paths for webinar registration + OTP verification.
// Repoint at the new backend's routes.
const REGISTRATION_URL = '';
const VERIFY_OTP_URL = '';
const RESEND_TIMER_SECONDS = 30;

/** Public payload emitted on a successful end-to-end registration. */
export interface WebinarRegistrationFormValue {
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  phone: string;
  location: string;
  company_id: number | null;
  /** Discriminator from the backend so the parent can tailor messaging. */
  flow: WebinarRegistrationResult['flow'];
}

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  phone: string;
  location: string;
  company_id: number;
  terms: boolean;
}

interface OtpFormState {
  otp: string;
}

/**
 * Guest registration form rendered inside `WebinarHero` when the visitor
 * isn't signed in. Self-contained two-step flow:
 *
 *   1. REGISTER step — collects identity + contact info, posts to
 *      `POST /webinar/registrations/`.
 *   2. OTP step — when the API responds with `flow: 'otp_required'`, the
 *      same card swaps the registration fields for an `<app-otp>` input and
 *      posts to `POST /webinar/registrations/verify-otp/` on submit.
 *
 * On a `direct_enrolled` / `already_enrolled` / verified-OTP outcome the form
 * emits `(submitted)` with the form values + flow so the hero can flip into
 * the "Booked" state.
 */
@Component({
  selector: 'app-webinar-registration-form',
  imports: [AngularFormField, AriaAutocomplete, AriaInput, Button, Forms, Otp, Spinner],
  templateUrl: './webinar-registration-form.html',
  styleUrl: './webinar-registration-form.css',
})
export class WebinarRegistrationForm {
  // ponytail: ApiClient was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly http: any = {

  };
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly storage = inject(Storage);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly analytics = inject(Analytics);

  /** Webinar context — required so we can submit `webinar_id` + `webinar_date_id`. */
  readonly webinarId = input.required<number>();
  readonly webinarDateId = input.required<number>();
  readonly webinarTitle = input<string>('');
  /**
   * Opt-in multi-step wizard. When `true`, the REGISTER stage is split into two
   * sub-steps (1: identity → 2: contact) with Next/Back, then proceeds to the
   * existing OTP/DONE steps. Defaults to `false` so every other consumer (hero,
   * registration dialog) keeps the single-panel layout unchanged.
   */
  readonly multiStep = input(false);

  readonly submitted = output<WebinarRegistrationFormValue>();

  /**
   * REGISTER → fields step.
   * OTP      → email-OTP verification step.
   * DONE     → backend confirmed enrollment but didn't auto-login the user.
   *            Fields stay visible (so the visitor can see what they submitted)
   *            but the form is locked and the CTA becomes "Log in".
   */
  protected readonly step = signal<'REGISTER' | 'OTP' | 'DONE'>('REGISTER');

  /**
   * Active sub-step within the REGISTER stage when `multiStep` is on.
   * 1 = identity (name + email), 2 = contact (phone, location, company, terms).
   * Ignored when `multiStep` is `false`.
   */
  protected readonly regStep = signal<1 | 2>(1);

  /** REGISTER form state — guests have no `currentUser()` to seed from. */
  protected readonly model = signal<FormState>({
    first_name: '',
    last_name: '',
    email: '',
    country_code: '',
    phone: '',
    location: '',
    company_id: 0,
    terms: false,
  });

  protected readonly otpModel = signal<OtpFormState>({ otp: '' });

  protected readonly submitting = signal(false);
  protected readonly verifying = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal<string | null>(null);

  /** OTP session returned by the registration endpoint when flow=otp_required. */
  private readonly otpSessionId = signal(0);

  protected readonly resendSecondsLeft = signal(0);
  protected readonly canResend = computed(() => this.resendSecondsLeft() === 0);
  protected readonly resendDisplay = computed(() => {
    const total = this.resendSecondsLeft();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  });
  private readonly resendCancel$ = new Subject<void>();

  // `dialCodeWithLength` lists one row per *country* (e.g. ~24 rows for +1),
  // but the dropdown only needs one option per *dial code*. Keep the first
  // occurrence of each code so the phone-length validator still gets sane
  // min/max bounds.
  protected readonly countryCodes = signal<any[]>(
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

  // ponytail: `placeSuggestions` came from the deleted LocationAutocomplete
  // service, which proxied Google Places through the backend. Point this at the
  // new backend's place search and the autocomplete works unchanged.
  protected readonly locationQuery = signal('');
  protected readonly locationOptions = signal<any[]>([]);

  // ponytail: was a debounced company search against PROFILE_ROUTES. Point this
  // at the new backend's company search — the autocomplete needs no changes.
  protected readonly companySearchQuery = signal('');
  protected readonly companyOptions = signal<any[]>([]);

  /**
   * Signal-forms schema. Required-field + phone/country-code validators
   * lifted from the profile schema so the user experience stays identical
   * across the auth and webinar flows.
   */
  protected readonly registrationForm = form<FormState>(this.model, (s) => {
    required(s.first_name, { message: 'First Name is required' });
    required(s.last_name, { message: 'Last Name is required' });
    required(s.email, { message: 'Email is required' });
    required(s.country_code, { message: 'Code is required' });
    required(s.phone, { message: 'Mobile Number is required' });
    required(s.location, { message: 'Location is required' });
    required(s.terms, { message: 'You must accept the terms and conditions' });

    validate(s.email, ({ value }) => {
      const val = value();
      if (!val) return null;
      // Lightweight check — backend is the source of truth for deliverability.
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
        ? null
        : { kind: 'pattern', message: 'Enter a valid email' };
    });

    validate(s.country_code, ({ value }) => {
      const val = value();
      if (!val) return null;
      const selected = this.countryCodes().find((c) => c.CountryCode === val);
      return selected ? null : { kind: 'required', message: 'Invalid Country code' };
    });

    validate(s.phone, ({ value }) => {
      const val = value();
      if (!val) return null;
      if (!/^\d+$/.test(val)) return { kind: 'pattern', message: 'Must be digits' };
      const selected = this.countryCodes().find((c) => c.CountryCode === this.model().country_code);
      if (selected) {
        const min = selected.phLengthMin ?? 7;
        const max = selected.phLengthMax ?? 18;
        if (val.length < min) return { kind: 'minlength', message: `Minimum length is ${min}` };
        if (val.length > max) return { kind: 'maxlength', message: `Maximum length is ${max}` };
      }
      return null;
    });
  });

  protected readonly otpForm = form<OtpFormState>(this.otpModel, (s) => {
    required(s.otp, { message: 'Please enter the OTP' });
    minLength(s.otp, 6, { message: 'OTP must be 6 digits' });
  });

  /**
   * Validity of the identity sub-step (step 1) — gates the "Next" button in
   * multi-step mode so the visitor can't advance with an empty/invalid name or
   * email. The contact sub-step + final submit stay governed by the whole-form
   * `registrationForm().invalid()`.
   */
  protected readonly step1Invalid = computed(
    () =>
      this.registrationForm.first_name().invalid() ||
      this.registrationForm.last_name().invalid() ||
      this.registrationForm.email().invalid(),
  );

  protected onCompanySearch(search: string): void {
    this.companySearchQuery.set(search);
  }

  /** Submit the registration form. Branches on the API's `flow` field. */
  protected submit(): void {
    // Multi-step: the identity sub-step's CTA (and Enter) submits the <form>,
    // so intercept it and advance to the contact step instead of registering.
    if (this.multiStep() && this.regStep() === 1) {
      this.goToContactStep();
      return;
    }
    if (this.registrationForm().invalid() || this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);

    this.http
      .post(REGISTRATION_URL, this.buildRegistrationPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.submitting.set(false);
          if (this.maybeOpenLmsBlockedDialog(response.data)) return;
          if (!response.status || !response.data) {
            const msg = response.message || 'Unable to register. Please try again.';
            this.error.set(msg);
            this.notification.error('Registration failed', msg);
            return;
          }
          this.handleRegistrationResult(response.data, response.message);
        },
        error: (err: any) => {
          this.submitting.set(false);
          if (this.maybeOpenLmsBlockedDialog(err?.error?.data)) return;
          const msg = err?.error?.message || 'Something went wrong. Please try again.';
          this.error.set(msg);
          this.logger.error('WebinarRegistrationForm: register failed', err);
        },
      });
  }

  /** Submit the OTP form (`OTP` step). */
  protected verifyOtp(): void {
    if (this.otpForm().invalid() || this.verifying()) return;
    this.error.set(null);
    this.verifying.set(true);

    const payload: WebinarRegistrationVerifyRequest = {
      session_id: this.otpSessionId(),
      otp: this.otpModel().otp,
      utm_url: this.storage.getCookie('utm') || undefined,
    };

    this.http
      .post(VERIFY_OTP_URL, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.verifying.set(false);
          if (!response.status) {
            const msg = response.message || 'Invalid OTP. Please try again.';
            this.error.set(msg);
            return;
          }
          const data = response.data;
          const flow = data?.flow ?? 'direct_enrolled';
          // A new account created during OTP-verified registration returns a
          // populated `user` → fire account_create + onboarding.
          if (data?.flow === 'direct_enrolled') this.maybeTrackNewAccount(data);
          // OTP verified for the `otp_required` flow = the booking is now
          // confirmed → count it regardless of the returned flow label.
          this.trackWebinarRegister();
          this.notification.success(
            flow === 'already_enrolled' ? 'Already registered' : 'Registration confirmed',
            response.message || `You're booked for "${this.webinarTitle() || 'this webinar'}".`,
          );
          this.emitResult(flow);
          // `auto_login` only exists on the `direct_enrolled` variant; for
          // `already_enrolled` (and any malformed payload) default to "no
          // auto-login" so the visitor sees the Log-in CTA.
          const autoLogin = data?.flow === 'direct_enrolled' && data.auto_login === true;
          if (!autoLogin) this.step.set('DONE');
        },
        error: (err: any) => {
          this.verifying.set(false);
          const msg = err?.error?.message || 'Failed to verify OTP. Please try again.';
          this.error.set(msg);
          this.logger.error('WebinarRegistrationForm: verify failed', err);
        },
      });
  }

  /** Re-send the OTP by re-submitting the registration call. */
  protected resendOtp(): void {
    if (!this.canResend() || this.resending()) return;
    this.resending.set(true);
    this.error.set(null);

    this.http
      .post(REGISTRATION_URL, this.buildRegistrationPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.resending.set(false);
          if (this.maybeOpenLmsBlockedDialog(response.data)) return;
          if (!response.status || !response.data) {
            this.error.set(response.message || 'Could not resend OTP.');
            return;
          }
          // If the backend short-circuited (e.g. user verified elsewhere
          // in another tab), honour the new flow instead of staying on OTP.
          this.handleRegistrationResult(response.data, response.message);
        },
        error: (err: any) => {
          this.resending.set(false);
          if (this.maybeOpenLmsBlockedDialog(err?.error?.data)) return;
          this.error.set(err?.error?.message || 'Could not resend OTP.');
          this.logger.error('WebinarRegistrationForm: resend failed', err);
        },
      });
  }

  /** DONE-step CTA — sends the visitor to the login page with a return URL. */
  protected goToLogin(): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { redirect: this.router.url },
    });
  }

  /** Back link from OTP → REGISTER (e.g. wrong email). Keeps form values. */
  protected backToRegister(): void {
    this.step.set('REGISTER');
    this.regStep.set(1);
    this.otpModel.set({ otp: '' });
    this.otpSessionId.set(0);
    this.error.set(null);
    this.stopResendTimer();
  }

  /** Multi-step: advance identity (1) → contact (2) once step 1 is valid. */
  protected goToContactStep(): void {
    if (this.step1Invalid()) return;
    this.regStep.set(2);
    this.error.set(null);
  }

  /** Multi-step: return contact (2) → identity (1). */
  protected backToDetails(): void {
    this.regStep.set(1);
    this.error.set(null);
  }

  protected readonly emailDisplay = computed(() => this.model().email);

  /**
   * Routing dialog for LMS-blocked emails (CAIRA / enrolled / alumni).
   *
   * Today the backend returns HTTP 403 with `{ data: { is_lms_access_blocked,
   * lms_user_type } }`, so this is called from the `error:` branch with
   * `err?.error?.data`. It's also called from the `next:` branch defensively
   * in case the backend ever flips to a 200 with `status: false`.
   *
   * Returns `true` when the dialog was opened so callers can short-circuit
   * the rest of their handler.
   */
  private maybeOpenLmsBlockedDialog(data: unknown): boolean {
    if (!isWebinarRegistrationAccessBlocked(data)) return false;
    this.dialog.open(UtilsDialog, {
      data: CONTENT_MAP[data.lms_user_type ?? 'non_lms'],
    });
    return true;
  }

  private handleRegistrationResult(data: WebinarRegistrationResult, message: string): void {
    switch (data.flow) {
      case 'direct_enrolled':
        // A populated `user` here means the backend just created the account as
        // part of registration → fire the account_create + onboarding events.
        this.maybeTrackNewAccount(data);
        this.trackWebinarRegister();
        this.notification.success(
          'Registration confirmed',
          message || `You're booked for "${this.webinarTitle() || 'this webinar'}".`,
        );
        this.emitResult('direct_enrolled');
        // Backend created/found an account but didn't auto-login → freeze the
        // form and offer a Log-in CTA so the visitor can pick up their seat.
        if (!data.auto_login) this.step.set('DONE');
        return;
      case 'already_enrolled':
        this.notification.info(
          'Already registered',
          message || 'You are already registered for this session.',
        );
        this.emitResult('already_enrolled');
        // Existing account, definitely not auto-logged-in → same DONE state.
        this.step.set('DONE');
        return;
      case 'otp_required':
        this.otpSessionId.set(data.session_id);
        // Dev-only autofill — backend omits `otp_dev` in prod.
        if (data.otp_dev) {
          this.otpModel.set({ otp: String(data.otp_dev) });
        } else {
          this.otpModel.set({ otp: '' });
        }
        this.step.set('OTP');
        this.startResendTimer();
        this.notification.info(
          'OTP sent',
          message || `We've sent a verification code to ${this.model().email}.`,
        );
        return;
    }
  }

  /**
   * Fire `webinar_register` for a completed booking. Called at the two
   * mutually-exclusive completion points — direct enrollment (no OTP) and a
   * successful OTP verification (the `otp_required` path) — so it counts once.
   */
  private trackWebinarRegister(): void {
    this.analytics.trackEvent('webinar_register', {
      course_id: this.webinarId(),
      course_name: this.webinarTitle(),
      course_type: 'webinar',
    });
  }

  private emitResult(flow: WebinarRegistrationResult['flow']): void {
    const v = this.model();
    this.submitted.emit({
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      country_code: v.country_code,
      phone: v.phone,
      location: v.location,
      company_id: v.company_id > 0 ? v.company_id : null,
      flow,
    });
  }

  /**
   * Fire the GA4 account-lifecycle events when registration created a brand-new
   * account. The backend returns a populated `data.user` ONLY in that case
   * (existing users carry no `user` payload here), so its presence is the signal.
   *
   * Two events fire, mirroring the standard signup → onboarding sequence:
   *   - `account_create` — the account was just created.
   *   - `onboarding`     — this same form also collects the onboarding profile
   *                        fields, so the user is onboarded in one step (this
   *                        flips the `onboarding` user property to "true").
   *
   * The webinar user object has `id` + name fields but no `miles_user_id`, so the
   * Analytics service applies the id→uuid fallback; sector/job_role aren't
   * collected here, so the onboarding_question_* properties stay empty.
   */
  private maybeTrackNewAccount(data: WebinarRegistrationDirectEnrolled): void {
    const raw = data.user;
    if (!raw) return;
    const user = raw as unknown as any;
    this.analytics.trackAccountCreate(user);
    this.analytics.trackOnboarding(user);
  }

  private buildRegistrationPayload(): WebinarRegistrationRequest {
    const v = this.model();
    return {
      email: v.email,
      first_name: v.first_name,
      last_name: v.last_name,
      mobile: v.phone,
      country_code: v.country_code,
      location: v.location,
      webinar_id: this.webinarId(),
      webinar_date_id: this.webinarDateId(),
      company_id: v.company_id > 0 ? v.company_id : null,
      browser_session_id: this.storage.getOrCreateBrowserSessionId(),
      utm_url: this.storage.getCookie('utm') || undefined,
    };
  }

  private startResendTimer(): void {
    this.stopResendTimer();
    this.resendSecondsLeft.set(RESEND_TIMER_SECONDS);
    interval(1000)
      .pipe(
        take(RESEND_TIMER_SECONDS),
        takeUntil(this.resendCancel$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.resendSecondsLeft.update((s) => Math.max(0, s - 1)));
  }

  private stopResendTimer(): void {
    this.resendCancel$.next();
    this.resendSecondsLeft.set(0);
  }
}
