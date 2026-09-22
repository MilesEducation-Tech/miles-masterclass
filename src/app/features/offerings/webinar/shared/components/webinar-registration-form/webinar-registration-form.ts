import { Component, computed, input, output, signal } from '@angular/core';
import {
  form,
  FormField as AngularFormField,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';

import { AriaAutocomplete } from '@shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import { Forms } from '@shared/components/ui/forms/forms';
import { Otp } from '@shared/components/ui/otp/otp';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { CountryCodeOption, dialCodeWithLength } from '@core/constant/dial-code';
import { AutoCompleteOption } from '@core/models/form.model';

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

/** Public payload the form used to emit on a successful registration. */
export interface WebinarRegistrationFormValue {
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  phone: string;
  location: string;
  company_id: number | null;
}

/**
 * ponytail: design-only shell. The registration/OTP API calls, the Salesforce
 * lead push, analytics, the LMS-blocked routing dialog, the resend timer and
 * the login redirect were all removed — this is now the form's *look* plus its
 * client-side validation and step navigation, which is what makes the design
 * legible. `submit`/`verifyOtp`/`resendOtp` are inert; the company and
 * location autocompletes return nothing because both were API-backed.
 *
 * Re-wire by restoring the two POSTs (`webinar/registrations/`,
 * `webinar/registrations/verify-otp/`) behind `submit()` and `verifyOtp()`.
 */
@Component({
  selector: 'app-webinar-registration-form',
  imports: [AngularFormField, AriaAutocomplete, AriaInput, Button, Forms, Otp, Spinner],
  templateUrl: './webinar-registration-form.html',
  styleUrl: './webinar-registration-form.css',
})
export class WebinarRegistrationForm {
  /** Webinar context — kept so the hero's existing bindings still resolve. */
  readonly webinarId = input.required<number>();
  readonly webinarDateId = input.required<number>();
  readonly webinarTitle = input<string>('');
  /**
   * Opt-in multi-step wizard. When `true`, the REGISTER stage is split into two
   * sub-steps (1: identity → 2: contact) with Next/Back.
   */
  readonly multiStep = input(false);

  readonly submitted = output<WebinarRegistrationFormValue>();

  /**
   * REGISTER → fields step.
   * OTP      → email-OTP verification step.
   * DONE     → locked, post-submit state.
   */
  protected readonly step = signal<'REGISTER' | 'OTP' | 'DONE'>('REGISTER');

  /**
   * Active sub-step within the REGISTER stage when `multiStep` is on.
   * 1 = identity (name + email), 2 = contact (phone, location, company, terms).
   */
  protected readonly regStep = signal<1 | 2>(1);

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

  protected readonly resendSecondsLeft = signal(0);
  protected readonly canResend = computed(() => this.resendSecondsLeft() === 0);
  protected readonly resendDisplay = computed(() => {
    const total = this.resendSecondsLeft();
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  });

  // `dialCodeWithLength` lists one row per *country* (e.g. ~24 rows for +1),
  // but the dropdown only needs one option per *dial code*. Keep the first
  // occurrence of each code so the phone-length validator still gets sane
  // min/max bounds.
  protected readonly countryCodes = signal<CountryCodeOption[]>(
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

  // ponytail: both were API-backed (Google Places / company search). Inert.
  protected readonly locationQuery = signal('');
  protected readonly locationOptions = signal<AutoCompleteOption<string>[]>([]);
  protected readonly companySearchQuery = signal('');
  protected readonly companyOptions = signal<AutoCompleteOption<number>[]>([]);

  /**
   * Signal-forms schema. Client-side only — kept because the error states are
   * a visible part of the design.
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

  protected readonly step1Invalid = computed(
    () =>
      this.registrationForm.first_name().invalid() ||
      this.registrationForm.last_name().invalid() ||
      this.registrationForm.email().invalid(),
  );

  protected readonly emailDisplay = computed(() => this.model().email);

  /** Company autocomplete query sink — the search itself was API-backed. */
  protected onCompanySearch(query: string): void {
    this.companySearchQuery.set(query);
  }

  // ponytail: inert — these posted to the registration / OTP endpoints.
  protected submit(): void {
    // ponytail: inert
  }
  protected verifyOtp(): void {
    // ponytail: inert
  }
  protected resendOtp(): void {
    // ponytail: inert
  }
  protected goToLogin(): void {
    // ponytail: inert
  }

  /** Back link from OTP → REGISTER (e.g. wrong email). Keeps form values. */
  protected backToRegister(): void {
    this.step.set('REGISTER');
    this.regStep.set(1);
    this.otpModel.set({ otp: '' });
    this.error.set(null);
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
}
