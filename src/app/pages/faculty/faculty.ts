import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  FormField as AngularFormField,
  disabled,
  form,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { Subject, interval, take, takeUntil } from 'rxjs';
import { NgIcon } from '@ng-icons/core';
import { RouterLink } from '@angular/router';

import { PlanScrollingGallery } from '../../features/payment/shared/components/plan-scrolling-gallery/plan-scrolling-gallery';
import { AriaAutocomplete } from '../../shared/components/ui/aria/aria-autocomplete/aria-autocomplete';
import { AriaInput } from '../../shared/components/ui/aria/aria-input/aria-input';
import { Button } from '../../shared/components/ui/button/button';
import { Forms } from '../../shared/components/ui/forms/forms';
import { Otp } from '../../shared/components/ui/otp/otp';
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import { dialCodeWithLength } from '../../shared/core/constant/dial-code';
import { placeSuggestions } from '../../shared/core/services/location-autocomplete/location-autocomplete';
import { logo, mcGrawHillLogo } from '../../shared/core/constant/icon';
import { CountryCodeOption, User, VerifyOTPResponse } from '../../shared/core/models/auth.model';
import { Analytics } from '../../shared/core/services/analytics/analytics';
import { ApiClient } from '../../shared/core/services/api-client/api-client';
import { Auth } from '../../shared/core/services/auth/auth';
import { Logger } from '../../shared/core/services/logger/logger';
import { NotificationService } from '../../shared/core/services/notification/notification';
import { SalesforceLead } from '../../shared/core/services/salesforce-lead/salesforce-lead';
import { Utils } from '../../shared/core/services/utils/utils';

const FACULTY_REGISTER_URL = 'v2/faculty/register/';
const FACULTY_VERIFY_URL = 'v2/faculty/verify/';
const RESEND_TIMER_SECONDS = 30;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Only emails carrying this marker are treated as institutional, and only those
 * get the full platform subscription activated — any other address still gets a
 * free account, just without the subscription.
 *
 * The backend is the authority on this; the check here only powers the live hint
 * under the email field so nobody submits a personal address by accident and
 * wonders why they didn't get access.
 */
const SUBSCRIPTION_EMAIL_MARKER = '.edu';

/**
 * Form state is keyed to match the API payload — both endpoints use the same
 * field names, except the two consent booleans and `location`, which the API
 * still calls `country`. See `buildProfilePayload`.
 */
interface FacultyFormState {
  first_name: string;
  last_name: string;
  email: string;
  institution: string;
  role: string;
  /** Free-text place, e.g. "Bengaluru, Karnataka, India". Sent as `country`. */
  location: string;
  country_code: string;
  phone: string;
  terms: boolean;
  sms_consent: boolean;
}

/**
 * The profile block both endpoints want. `verify` re-sends the whole thing
 * alongside the OTP rather than relying on the session alone, so this is built
 * once and spread into both requests.
 */
interface FacultyProfilePayload {
  first_name: string;
  last_name: string;
  email: string;
  institution: string;
  role: string;
  country: string;
  phone: string;
  country_code: string;
  /** Both consents are recorded server-side, not just gated in the UI. */
  terms_accepted: boolean;
  sms_consent: boolean;
}

interface FacultyRegisterRequest extends FacultyProfilePayload {
  /** Whether this submission needs email verification — see `otpRequired`. */
  otp_required: boolean;
}

interface FacultyVerifyRequest extends FacultyProfilePayload {
  /**
   * The address the code was sent to, echoed back from the register step.
   *
   * Replaces `session_id`: Miles SSO has no server-side OTP session, so the
   * identifier is what ties send to verify. Taken from the response rather than
   * rebuilt from the form so it is always the value the server actually used.
   */
  identifier: string;
  otp: string;
}

/**
 * Register response, e.g.
 * `{ status: true, message: 'OTP sent successfully',
 *    data: { otp_required: true, identifier: 'x@uni.edu', channel: 'email' } }`
 *
 * `data.otp_required` is the backend's own verdict on whether it dispatched a
 * code. It normally agrees with the flag we sent, but it wins when it doesn't —
 * it knows what it actually did. Every field is optional so a leaner payload on
 * the no-OTP path doesn't break parsing.
 */
interface FacultyRegisterResponse {
  status: boolean;
  message: string;
  data?: {
    otp_required?: boolean;
    /** Post this back on verify. Replaces the old `session_id`. */
    identifier?: string;
    /** How the code was actually delivered. Email-only on this page today. */
    channel?: 'email' | 'sms' | 'whatsapp';
    /** A server-side stopgap being withdrawn upstream. Never branch on it. */
    dev_code?: string;
    /** Returned on the no-OTP update path so we can refresh the cached user. */
    user?: User;
  };
}

/**
 * Institutional lead-capture page.
 *
 *   FORM → collects the faculty member's details, posts to
 *          `POST v2/faculty/register/`.
 *   OTP  → entered when `otpRequired()` is true, i.e. the address needs proving.
 *          `POST v2/faculty/verify/` finalises it AND returns the standard login
 *          payload, so verifying auto-logs the visitor in and redirects them to
 *          the locale home.
 *   DONE → the no-OTP path: an already-signed-in visitor who left their email
 *          alone. Nothing to verify and no login to perform, so we stay put and
 *          confirm.
 *
 * Signed-in visitors get their known details pre-filled and frozen; visitors
 * who already hold an active subscription see the whole form locked.
 */
@Component({
  selector: 'app-faculty',
  imports: [
    AngularFormField,
    AriaAutocomplete,
    AriaInput,
    Button,
    Forms,
    NgIcon,
    Otp,
    PlanScrollingGallery,
    RouterLink,
    Spinner,
  ],
  templateUrl: './faculty.html',
  styleUrl: './faculty.css',
})
export class Faculty {
  private readonly http = inject(ApiClient);
  private readonly salesforceLead = inject(SalesforceLead);
  private readonly auth = inject(Auth);
  private readonly analytics = inject(Analytics);
  private readonly logger = inject(Logger);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  /** Same Miles wordmark the site header renders. */
  protected readonly logoIcon = logo;
  protected readonly mcGrawHillIcon = mcGrawHillLogo;

  // Policy links have to stay inside the current `:country/:profession_type` tree.
  protected readonly country = this.utils.country;
  protected readonly profession = this.utils.profession;

  protected readonly step = signal<'FORM' | 'OTP' | 'DONE'>('FORM');

  protected readonly submitting = signal(false);
  protected readonly verifying = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Visitors who already bought don't need the faculty programme. */
  protected readonly locked = computed(() => this.auth.hasActivePlan());

  /**
   * Map the authenticated user onto the form shape. Wrapped in `linkedSignal`
   * so the form re-seeds if `currentUser()` lands after first render (SSR
   * hydration, or a profile fetch resolving) instead of staying stuck empty.
   */
  private mapUserToForm(user: User | null): FacultyFormState {
    return {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      // Seeded from the account email but left editable (see the `disabled`
      // rules below) — swapping it for a different institutional address is
      // exactly what makes the backend answer `otp_required`.
      email: user?.email || '',
      // Neither of these exists on the User model, so there's nothing to seed.
      institution: '',
      role: '',
      location: user?.location || '',
      country_code: user?.country_code || '',
      // The User model calls it `mobile`, the API calls it `phone`.
      phone: user?.mobile || '',
      // Neither consent is ever pre-ticked, even for a user whose profile
      // already carries `terms_accepted` — consent for this offer is given here.
      terms: false,
      sms_consent: false,
    };
  }

  protected readonly model = linkedSignal<FacultyFormState>(() =>
    this.mapUserToForm(this.auth.currentUser()),
  );

  protected readonly otpModel = signal<{ otp: string }>({ otp: '' });

  /**
   * Address the register step sent the code to, echoed back by the server.
   *
   * Replaces the old numeric session id: Miles SSO has no OTP session, so this
   * is what verify must be posted with. Empty = no code sent yet.
   */
  private readonly otpIdentifier = signal('');

  protected readonly resendSecondsLeft = signal(0);
  protected readonly canResend = computed(() => this.resendSecondsLeft() === 0);
  protected readonly resendDisplay = computed(() => {
    const total = this.resendSecondsLeft();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });
  private readonly resendCancel$ = new Subject<void>();

  /** Address the OTP went to — shown on the OTP step. */
  protected readonly emailDisplay = computed(() => this.model().email);

  /**
   * Which offer the address they've typed so far qualifies for. Drives the live
   * hint under the email field — `'pending'` while it's empty or still being
   * typed, so we don't nag before there's anything to judge.
   */
  protected readonly emailTier = computed<'pending' | 'subscription' | 'account'>(() => {
    const email = this.model().email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return 'pending';
    return email.includes(SUBSCRIPTION_EMAIL_MARKER) ? 'subscription' : 'account';
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

  // Same location lookup the profile and webinar forms use — our own
  // `v2/locations/autocomplete/`, which proxies Google Places server-side.
  protected readonly locationQuery = signal('');
  protected readonly locationOptions = placeSuggestions(
    this.locationQuery,
    computed(() => this.model().location),
  );

  /**
   * Whether this submission has to be verified by email. Sent as `otp_required`
   * and it also drives the UI: true → the OTP step, false → straight to done.
   *
   * The one case that skips verification is a signed-in, non-subscribed visitor
   * submitting the address their account already uses — there's nothing new to
   * prove, so it's just a profile update. Everything else verifies: guests
   * (unknown address) and anyone swapping in a different institutional email.
   *
   * Defaults to requiring an OTP whenever we can't establish the safe case —
   * mid-hydration, say, when `currentUser()` hasn't landed yet. Erring towards
   * verification is the side that can't hand out access to an unproven address.
   */
  protected readonly otpRequired = computed(() => {
    if (!this.auth.isLoggedIn()) return true;
    if (this.auth.hasActivePlan()) return true;
    const accountEmail = (this.auth.currentUser()?.email || '').trim().toLowerCase();
    if (!accountEmail) return true;
    return this.model().email.trim().toLowerCase() !== accountEmail;
  });

  protected readonly facultyForm = form<FacultyFormState>(this.model, (s) => {
    required(s.first_name, { message: 'First Name is required' });
    required(s.last_name, { message: 'Last Name is required' });
    required(s.email, { message: 'Institutional Email is required' });
    required(s.institution, { message: 'Institution Name is required' });
    required(s.role, { message: 'Role is required' });
    required(s.location, { message: 'Location is required' });
    required(s.country_code, { message: 'Code is required' });
    required(s.phone, { message: 'Phone Number is required' });
    required(s.terms, { message: 'You must accept the terms and conditions' });
    // `sms_consent` is deliberately optional — it's marketing opt-in, not a gate.

    validate(s.email, ({ value }) => {
      const val = value();
      if (!val) return null;
      // Lightweight check — the backend is the source of truth for deliverability.
      return EMAIL_PATTERN.test(val) ? null : { kind: 'pattern', message: 'Enter a valid email' };
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

    // Two requirements collapse into one mechanism here: an active subscriber
    // has every field frozen, and a signed-in visitor has whichever fields we
    // already know frozen (someone with no saved location still gets to type a
    // country). Schema rules rather than a `<fieldset disabled>` wrapper because
    // native fieldset only reaches native controls and the country-code picker
    // is a custom listbox — and `[formField]`-bound controls reject a template
    // `[disabled]` binding outright (NG8022).
    disabled(s.first_name, { when: () => this.locked() || !!this.auth.currentUser()?.first_name });
    disabled(s.last_name, { when: () => this.locked() || !!this.auth.currentUser()?.last_name });
    disabled(s.country_code, {
      when: () => this.locked() || !!this.auth.currentUser()?.country_code,
    });
    disabled(s.phone, { when: () => this.locked() || !!this.auth.currentUser()?.mobile });
    disabled(s.location, { when: () => this.locked() || !!this.auth.currentUser()?.location });
    // Institutional fields are never on the User model → only the lock applies.
    disabled(s.email, { when: () => this.locked() });
    disabled(s.institution, { when: () => this.locked() });
    disabled(s.role, { when: () => this.locked() });
    disabled(s.terms, { when: () => this.locked() });
    disabled(s.sms_consent, { when: () => this.locked() });
  });

  protected readonly otpForm = form<{ otp: string }>(this.otpModel, (s) => {
    required(s.otp, { message: 'Please enter the OTP' });
    minLength(s.otp, 6, { message: 'OTP must be 6 digits' });
  });

  /** FORM step — register, then either verify by OTP or finish. */
  protected submit(): void {
    const formState = this.facultyForm();
    formState.markAsTouched();
    if (this.locked() || formState.invalid() || this.submitting()) return;
    this.error.set(null);
    this.submitting.set(true);

    // Snapshot the flag so the response handler branches on exactly what we
    // asked for, even if the model changes while the request is in flight.
    const otpRequired = this.otpRequired();

    this.http
      .post<FacultyRegisterResponse>(FACULTY_REGISTER_URL, this.buildRegisterPayload(otpRequired))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          if (!response.status) {
            const msg = response.message || 'Unable to submit. Please try again.';
            this.error.set(msg);
            this.notification.error('Submission failed', msg);
            return;
          }
          this.handleRegisterResult(response.data ?? {}, response.message, otpRequired);
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err?.error?.message || 'Something went wrong. Please try again.');
          this.logger.error('Faculty: register failed', err);
        },
      });
  }

  /** OTP step — verify the code, then auto-login and head home. */
  protected verifyOtp(): void {
    if (this.otpForm().invalid() || this.verifying()) return;
    this.error.set(null);
    this.verifying.set(true);

    // `verify` re-sends the whole profile alongside the OTP, not just the session.
    const payload: FacultyVerifyRequest = {
      ...this.buildProfilePayload(),
      identifier: this.otpIdentifier(),
      otp: this.otpModel().otp,
    };

    this.http
      .post<VerifyOTPResponse>(FACULTY_VERIFY_URL, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.verifying.set(false);
          if (!response.status || !response.data) {
            this.error.set(response.message || 'Invalid OTP. Please try again.');
            return;
          }
          const { token, refreshtoken, expires_in, user } = response.data;
          this.completeAutoLogin(token, refreshtoken, user, expires_in);
          this.notification.success(
            'Verified',
            response.message || "You're all set — we'll be in touch shortly.",
          );
          this.stopResendTimer();
          // Locale-scoped home (e.g. /in/cpa) rather than '/' so the visitor
          // keeps their country/profession context.
          this.router.navigateByUrl(this.utils.localePath());
        },
        error: (err) => {
          this.verifying.set(false);
          this.error.set(err?.error?.message || 'Failed to verify OTP. Please try again.');
          this.logger.error('Faculty: verify OTP failed', err);
        },
      });
  }

  /**
   * Re-send the OTP by re-registering. Hard-codes `otp_required: true` — we only
   * get here from the OTP step, so a code is unambiguously wanted regardless of
   * what the model looks like now.
   */
  protected resendOtp(): void {
    if (!this.canResend() || this.resending()) return;
    this.resending.set(true);
    this.error.set(null);

    this.http
      .post<FacultyRegisterResponse>(FACULTY_REGISTER_URL, this.buildRegisterPayload(true))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.resending.set(false);
          if (!response.status) {
            this.error.set(response.message || 'Could not resend OTP.');
            return;
          }
          this.handleRegisterResult(response.data ?? {}, response.message, true);
        },
        error: (err) => {
          this.resending.set(false);
          this.error.set(err?.error?.message || 'Could not resend OTP.');
          this.logger.error('Faculty: resend OTP failed', err);
        },
      });
  }

  /** Back link from OTP → FORM (e.g. wrong email). Keeps the entered values. */
  protected backToForm(): void {
    this.step.set('FORM');
    this.otpModel.set({ otp: '' });
    this.otpIdentifier.set('');
    this.error.set(null);
    this.stopResendTimer();
  }

  /**
   * `requestedOtp` is the flag we sent, snapshotted before the call — it can't
   * be re-read here because `data.user` triggers `setAuthenticated`, which
   * re-seeds the model and would flip `otpRequired` mid-handler.
   *
   * The backend's own `data.otp_required` wins when present: it reports what it
   * actually did, so if it decided to verify an address we thought was settled
   * (or vice versa) we follow it rather than stranding the visitor on the wrong
   * screen. Our flag is the fallback for a response that omits it.
   */
  private handleRegisterResult(
    data: NonNullable<FacultyRegisterResponse['data']>,
    message: string,
    requestedOtp: boolean,
  ): void {
    const otpRequired = data.otp_required ?? requestedOtp;

    if (otpRequired) {
      // Fall back to the typed email only if the server somehow omitted it —
      // it normally echoes the exact value it used.
      this.otpIdentifier.set(data.identifier ?? this.model().email ?? '');
      this.otpModel.set({ otp: data.dev_code ?? '' });
      this.step.set('OTP');
      this.startResendTimer();
      this.notification.info(
        'OTP sent',
        message || `We've sent a verification code to ${this.model().email}.`,
      );
      return;
    }

    // Signed in with an unchanged email, so there's nothing to verify and no
    // login to perform. Refresh the cached user so the header reflects whatever
    // the backend just saved.
    if (data.user) {
      this.auth.setAuthenticated(data.user);
    } else {
      this.auth.fetchMyProfile();
    }
    this.notification.success('Details saved', message || "We'll be in touch shortly.");
    // Deliberately swapping the form for a confirmation panel: `model` is a
    // linkedSignal over `currentUser()`, so the refresh above re-seeds it and
    // would blank the institution/role the visitor just typed.
    this.step.set('DONE');
  }

  /**
   * Post-verification login, mirroring `AuthFacade.verifyOtp` so both entry
   * points leave identical auth + analytics state behind.
   */
  private completeAutoLogin(
    token: string,
    refreshToken: string,
    user: User,
    expiresIn?: number,
  ): void {
    // `expiresIn` arms the proactive refresh. Miles SSO access tokens are short
    // (15 min target), so a session stored without it expires mid-use.
    this.auth.storeTokens(token, refreshToken, expiresIn);
    this.auth.setAuthenticated(user);
    // Identify BEFORE the activation events — the `currentUser` effect also
    // identifies, but asynchronously, i.e. after the synchronous hits below.
    this.analytics.flushIdentity();
    const isNewAccount = (user as { is_existing_user?: boolean })?.is_existing_user === false;
    this.analytics.trackEvent(isNewAccount ? 'sign_up' : 'login', { method: 'email' });
    if (isNewAccount) {
      this.analytics.trackAccountCreate(user);
      // CRM lead — account creation only. This is the sole path on which a
      // faculty submission creates an account; the no-OTP `DONE` branch is an
      // already-signed-in visitor, so it never mints a lead. Identity comes
      // from the form, which holds the institutional email the visitor typed.
      const lead = this.model();
      this.salesforceLead.create({
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        country_code: lead.country_code,
      });
    }
    // Refresh `currentPlan` so the header's `hasActivePlan` reflects the
    // just-signed-in user. Fire-and-forget — navigation doesn't wait for it.
    this.auth.fetchCurrentPlan().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /** Shared by `register` and `verify` — both take the full profile block. */
  private buildProfilePayload(): FacultyProfilePayload {
    const v = this.model();
    return {
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      institution: v.institution,
      role: v.role,
      // The form collects a free-text location; the API field is still `country`.
      country: v.location,
      phone: v.phone,
      country_code: v.country_code,
      terms_accepted: v.terms,
      sms_consent: v.sms_consent,
    };
  }

  private buildRegisterPayload(otpRequired: boolean): FacultyRegisterRequest {
    return { ...this.buildProfilePayload(), otp_required: otpRequired };
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
