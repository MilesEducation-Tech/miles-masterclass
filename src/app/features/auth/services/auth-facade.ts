import { environment } from '@env/environment';
import { Location } from '@angular/common';
import { DestroyRef, Service, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FieldTree,
  email,
  form,
  minLength,
  required,
  validate,
  validateHttp,
} from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';

import { CountryCodeOption, dialCodeWithLength } from '@core/constants/dial-code';
import {
  AUTH_ROUTES,
  AuthFailure,
  IdentifyResponse,
  OtpChannel,
  OtpContact,
  SessionResponse,
  isOtpMethod,
  isTerminalFailure,
  toAuthFailure,
} from '@core/models/auth.model';
import { CommonResponse } from '@core/models/http.model';
import { PASSWORD_MIN_LOGIN } from '@core/models/password.model';
import { apiUrl } from '@core/services/api-client/api-client';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { SUPPORT_EMAIL } from '@features/auth/constants/auth';
import { LoginView, PasswordLoginModel } from '@features/auth/models/sign-in.model';
import { HttpErrorResponse } from '@angular/common/http';

export interface AuthModel {
  /** Email or phone, whichever tab is showing. The SSO works out which. */
  identifier: string;
  country_code: string;
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

/**
 * How long the lockout countdown runs after a 429. The contract documents no
 * duration; 30 minutes is an assumption, not a server value.
 */
const LOCKOUT_FALLBACK_MS = 30 * 60 * 1000;

/** Used only until a send response tells us the real `cooldownSeconds`. */
const FALLBACK_COOLDOWN_SECONDS = 60;

/**
 * How long the identifier must sit still before `auth-identify/` is called.
 *
 * `l@e.co` is valid and so is `l@e.com` one keystroke later, so without this the
 * endpoint fires on nearly every keystroke past the first valid prefix. The
 * backend declares a 20/min intent for this route and — per the contract's own
 * measurement — does not currently enforce it, which makes restraint the
 * client's job rather than something a 429 will impose.
 */
const IDENTIFY_DEBOUNCE_MS = 400;

/** `?method=` → the code-flow tab it names, or `null` for the password view. */
function methodOf(param: string | null): 'PHONE' | 'EMAIL' | null {
  if (param === 'phone') return 'PHONE';
  if (param === 'email') return 'EMAIL';
  return null;
}

/**
 * The sign-in screen's own state.
 *
 * This is a facade because the login page is genuinely multi-step: the
 * password and code views, the LOGIN↔OTP steps, the resend cooldown, the
 * attempt tally and three form models are all state that must die when the
 * user leaves `/auth`. Hence `autoProvided: false` and `providers: [AuthFacade]`
 * on the `login` and `signup` routes — each gets its own — and anything
 * longer-lived belongs in `AuthSession`, which is where the session itself lives.
 *
 * Everything the template binds to is kept; `login.html` is the spec.
 */
@Service({ autoProvided: false })
export class AuthFacade {
  /**
   * How many boxes `<app-input-otp>` renders AND what the validator demands — one
   * value for both, so they cannot disagree.
   *
   * ponytail: the contract says the length is set server-side at the SSO, but
   * no route returns it, so it comes from `environment.AUTH.otpLength`. If
   * `auth-otp-send/` ever reports a length, read it into this and nothing else
   * changes.
   */
  readonly otpLength = environment.AUTH.otpLength;

  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  // Synchronous: the route's resolver merged the `auth.*` dictionary before this facade was created.
  private readonly transloco = inject(TranslocoService);
  private readonly t = (key: string, params?: Record<string, unknown>): string =>
    this.transloco.translate(key, params);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginStep = signal<'LOGIN' | 'OTP'>('LOGIN');

  /**
   * A terminal failure (`account_blocked` / `account_deactivated`) is not a
   * sign-in problem the user can retry their way out of, so the form is closed
   * off entirely rather than left inviting another attempt.
   */
  readonly isTerminal = signal(false);

  /** `/auth/signup`: the same card, code-only, with sign-up copy. Set by the page — see `start`. */
  readonly isSignup = signal(false);

  /**
   * `?method=`. Read off the ROOT route, which is the one a route-provided service is given; query
   * params belong to the whole URL, so it carries them all the same.
   */
  private readonly methodParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('method'))),
    { requireSync: true },
  );

  /**
   * Email and password by default. `?method=phone|email` is the code flow on that tab, so the
   * "Login with OTP" buttons are real navigations: Back returns to the password view, and a link can
   * open either. Sign-up is code-only: the API creates an account when a code is verified.
   */
  readonly view = computed<LoginView>(() =>
    this.isSignup() || methodOf(this.methodParam()) ? 'OTP' : 'PASSWORD',
  );

  /**
   * Which login method the tab strip has selected: the URL's, else Email on sign-up (a password can
   * only be set on an account with a confirmed email), else Mobile. Writable, and kept in the URL by
   * `selectLoginMethod`, so the two can't disagree.
   */
  readonly loginMethod = linkedSignal<'PHONE' | 'EMAIL'>(
    () => methodOf(this.methodParam()) ?? (this.isSignup() ? 'EMAIL' : 'PHONE'),
  );

  /**
   * Tab values for `app-tabs` on the login form. They stay English because `selectLoginMethod`
   * keys off them; the template translates the visible label (`auth.login.tabs.<value>`).
   */
  readonly loginMethodTabs = ['Mobile', 'Email'] as const;

  /** The tab label that maps to the current `loginMethod`. */
  readonly selectedTabLabel = computed(() => (this.loginMethod() === 'PHONE' ? 'Mobile' : 'Email'));

  /** Just the dial code, so toggling consent cannot re-trigger identify. */
  private readonly countryCode = computed(() => this.authModel().country_code);

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
    this.isLockedOut() && this.loginMethod() === 'PHONE' ? 'email' : 'resend',
  );

  readonly resendTimerDisplay = computed(() => {
    const total = this.secondsLeft;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  /**
   * "Code sent by SMS to", ahead of the identifier. A whole phrase per channel, not a channel word
   * dropped into one sentence, so each language can place it where its grammar wants. `channel` is
   * open-ended (`OtpChannel`), so anything unknown gets the channel-free phrase, never a raw key.
   */
  readonly otpSentTo = computed(() => {
    const channel = this.channel();
    const known = channel === 'email' || channel === 'whatsapp' || channel === 'sms';
    return this.t(`auth.otp.sentTo.${known ? channel : 'other'}`);
  });

  readonly authModel = signal<AuthModel>({ identifier: '', country_code: '+1', consent: false });

  readonly otpModel = signal<OtpModel>({ identifier: '', otp: '' });

  /** The identifier as it should appear on the OTP confirmation screen. */
  readonly displayIdentifier = computed(() => {
    const model = this.authModel();
    if (this.loginMethod() === 'PHONE') {
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
    this.t(
      this.loginMethod() === 'PHONE' ? 'auth.login.consent.phone' : 'auth.login.consent.email',
    ),
  );

  /** Support address surfaced in the Mobile consent copy. */
  readonly supportEmail = SUPPORT_EMAIL;

  /**
   * Whether the identifier looks complete enough to ask the SSO about.
   *
   * Looser than validation on purpose, and value-only so it cannot depend on
   * the validity it contributes to.
   */
  private isWorthIdentifying(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (this.loginMethod() === 'EMAIL') return /.+@.+\..+/.test(trimmed);
    return /^\d+$/.test(trimmed) && trimmed.length >= this.minPhoneLength();
  }

  /** Shortest phone number the selected dial code accepts. */
  private minPhoneLength(): number {
    return this.countryCodes().find((c) => c.CountryCode === this.countryCode())?.phLengthMin ?? 7;
  }

  readonly loginForm = form<AuthModel>(this.authModel, (loginSchema) => {
    // Dynamic checks rather than `pattern`, which expects a static RegExp.
    validate(loginSchema.identifier, ({ value }) => {
      // Let `required` own the empty case so we don't surface "Must be digits"
      // on an untouched/empty Mobile field.
      if (!value()) return null;

      if (this.loginMethod() === 'PHONE') {
        if (!/^\d+$/.test(value())) {
          return { kind: 'pattern', message: this.t('auth.login.errors.digitsOnly') };
        }
        const selectedCode = this.countryCodes().find(
          (c) => c.CountryCode === this.authModel().country_code,
        );
        if (selectedCode) {
          const min = selectedCode.phLengthMin ?? 7;
          const max = selectedCode.phLengthMax ?? 18;
          if (value().length < min) {
            return { kind: 'minlength', message: this.t('auth.login.errors.minLength', { min }) };
          }
          if (value().length > max) {
            return { kind: 'maxlength', message: this.t('auth.login.errors.maxLength', { max }) };
          }
        }
      }
      return null;
    });

    // Built-in, and only while the Email tab is showing.
    email(loginSchema.identifier, {
      when: () => this.loginMethod() === 'EMAIL',
      message: this.t('auth.login.errors.invalidEmail'),
    });

    validate(loginSchema.country_code, ({ value }) => {
      if (this.loginMethod() !== 'PHONE') return null;
      if (!value()) {
        return { kind: 'required', message: this.t('auth.login.errors.countryCodeRequired') };
      }
      const selectedCode = this.countryCodes().find(
        (c) => c.CountryCode === this.authModel().country_code,
      );
      return selectedCode
        ? null
        : { kind: 'required', message: this.t('auth.login.errors.countryCodeInvalid') };
    });

    required(loginSchema.identifier, { message: this.t('auth.login.errors.identifierRequired') });

    /**
     * `auth-identify/` — "how does this person authenticate?" — as an async
     * validator on the identifier itself.
     *
     * This is the whole prefetch: `debounce` waits out the keystrokes, `when`
     * keeps it off a half-typed address, and the framework cancels a request
     * the user has already typed past. `valid()` is false while it is pending,
     * so the submit button waits for it without anything here saying so — which
     * is what makes "identify first, always" structural rather than a step
     * `submitLogin` has to remember.
     */
    validateHttp(loginSchema.identifier, {
      // Deliberately NOT `state.invalid()`: this validator feeds that signal,
      // so reading it here is a cycle ("Detected cycle in computations").
      //
      // It is also a different question. Validation asks "is this acceptable?";
      // this asks "is this worth a network round trip yet?", and a looser,
      // value-only answer is the right one.
      when: ({ value }) => this.isWorthIdentifying(value()),
      debounce: IDENTIFY_DEBOUNCE_MS,
      request: ({ value }) => ({
        url: apiUrl(AUTH_ROUTES.identify.path),
        method: 'POST',
        body: {
          identifier:
            this.loginMethod() === 'PHONE'
              ? `${this.countryCode()}${value()}`.replace(/\s+/g, '')
              : value().trim(),
        },
      }),
      onSuccess: (result) => {
        // The values are `email_otp`, `phone_otp`, `password` and later `saml` —
        // never a bare `otp`. An account with no `*_otp` method cannot be sent a
        // code at all, which today means enterprise SSO.
        const methods = (result as CommonResponse<IdentifyResponse>).data?.methods ?? [];
        if (methods.length && !methods.some(isOtpMethod)) {
          return {
            kind: 'sso_only',
            message: this.t('auth.login.errors.ssoOnly'),
          };
        }
        // Nothing positive is reported: identify answers identically for a known
        // and an unknown identifier, so any success signal would be an
        // account-existence oracle.
        return null;
      },
      // A background call must never put an error under a field the user is
      // still typing in. A failed identify simply does not block the send.
      onError: () => null,
    });
  });

  readonly otpForm = form<OtpModel>(this.otpModel, (otpSchema) => {
    required(otpSchema.otp, { message: this.t('auth.otp.errors.required') });
    // Must match `[length]` on `<app-input-otp>` in login.html — the input renders
    // that many boxes, and a shorter minimum here would enable Verify on a
    // half-typed code.
    validate(otpSchema.otp, ({ value }) => {
      const code = value();
      if (!code) return null;
      if (!/^\d+$/.test(code)) {
        return { kind: 'pattern', message: this.t('auth.otp.errors.digitsOnly') };
      }
      if (code.length !== this.otpLength) {
        return {
          kind: 'minlength',
          message: this.t('auth.otp.errors.length', { length: this.otpLength }),
        };
      }
      return null;
    });
  });

  // ── Password sign-in ──────────────────────────────────────────────────────

  readonly passwordModel = signal<PasswordLoginModel>({ email: '', password: '' });

  readonly passwordForm = form<PasswordLoginModel>(this.passwordModel, (schema) => {
    required(schema.email, { message: this.t('auth.login.password.errors.emailRequired') });
    email(schema.email, { message: this.t('auth.login.errors.invalidEmail') });
    required(schema.password, { message: this.t('auth.login.password.errors.required') });
    minLength(schema.password, PASSWORD_MIN_LOGIN, {
      message: this.t('auth.login.password.errors.min', { min: PASSWORD_MIN_LOGIN }),
    });
  });

  /** The password view's failure line, apart from the code flow's `error` so a view switch never
   *  carries one across. */
  readonly passwordError = signal<string | null>(null);

  /** After a 429 the account's PASSWORD sign-in is locked, but a code still works — so offer one. */
  readonly offerOtpInstead = signal(false);

  constructor() {
    // One interval for every countdown on the screen. Cleared with the facade,
    // which dies with the auth route.
    const ticker = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(ticker));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * The page calls this on every entry. This facade lives in the route's injector, which outlives the
   * page, and a route-provided service can't read its own route's `data` (it is given the root route).
   */
  start(signup: boolean): void {
    this.isSignup.set(signup);
  }

  /**
   * Sign in with the password view's email and password.
   *
   * Validated here rather than by disabling the button: a password manager can fill both fields
   * without an `input` event the form sees (Chrome withholds autofilled values until the page is
   * interacted with), and a button waiting on validity would sit dead over filled fields.
   */
  async loginWithPassword(): Promise<void> {
    if (this.isLoading() || this.isTerminal()) return;
    this.pickUpAutofill();
    this.passwordForm().markAsTouched();
    if (this.passwordForm().invalid()) return;

    this.isLoading.set(true);
    this.passwordError.set(null);
    this.offerOtpInstead.set(false);

    const { email, password } = this.passwordModel();
    try {
      // The email trimmed; the password exactly as typed (contract §2.6).
      const session = await this.auth.loginWithPassword({ identifier: email.trim(), password });
      await this.routeAfterSession(session);
    } catch (err) {
      this.renderPasswordFailure(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * The "Login with OTP" buttons: the code flow on that channel, from its first step. A navigation
   * (`?method=`), so Back returns to the password view. An email typed for the password carries over.
   */
  useOtp(method: 'PHONE' | 'EMAIL'): void {
    this.passwordError.set(null);
    this.offerOtpInstead.set(false);
    this.goBackToLogin();
    this.loginMethod.set(method);
    const typed = method === 'EMAIL' ? this.passwordModel().email.trim() : '';
    this.authModel.update((m) => ({ ...m, identifier: typed }));
    this.loginForm.identifier().reset();
    void this.router.navigate([], {
      queryParams: { method: method === 'PHONE' ? 'phone' : 'email' },
      queryParamsHandling: 'merge',
    });
  }

  /** Back to email and password — a navigation as well, so Back from there returns to the code flow. */
  usePassword(): void {
    this.goBackToLogin();
    void this.router.navigate([], { queryParams: { method: null }, queryParamsHandling: 'merge' });
  }

  /**
   * Who the code goes to, as send and verify want it: the email as typed, or
   * the national digits and the dial code apart. Identify still takes the
   * single E.164 string — see its request in `loginForm`.
   */
  private toContact(): OtpContact {
    const model = this.authModel();
    if (this.loginMethod() !== 'PHONE') return { email: model.identifier.trim() };
    return { mobile: model.identifier.replace(/\s+/g, ''), country_code: model.country_code };
  }

  /**
   * Send the code.
   *
   * `auth-identify/` is not called here. It is an async validator on the
   * identifier field (see `loginForm`), so the form is only valid once identify
   * has answered and offered an OTP method — which is what the submit button is
   * already gated on. "Identify first, always" is therefore structural rather
   * than a step this method has to remember.
   */
  async submitLogin(): Promise<void> {
    if (this.isLoading() || !this.canSendOtp()) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.send(this.toContact());
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
      const session = await this.auth.verifyOtp(this.toContact(), this.otpModel().otp);
      this.failedAttempts.set(0);
      await this.routeAfterSession(session);
    } catch (err) {
      const failure = this.renderFailure(err);
      if (failure.kind === 'bad_code') {
        this.failedAttempts.update((n) => n + 1);
      }
      if (failure.kind === 'retry_new_code') {
        // The code they used is spent. Send them back for a fresh one rather
        // than leaving them retyping one that can no longer work — and keep the
        // reason on screen, which `goBackToLogin()` would otherwise wipe.
        this.goBackToLogin();
        this.error.set(failure.message);
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
      await this.send(this.toContact());
    } catch (err) {
      this.renderFailure(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Where a fresh session goes, by code or by password alike. Rule 4: the milestone, not a token claim. */
  private async routeAfterSession(session: SessionResponse): Promise<void> {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (session.profile_status === 'new_user') {
      // The profile page returns to `redirect` once it is complete, so a new
      // learner who signed in to register for a webinar lands back on it.
      await this.router.navigate(['/auth/profile'], {
        queryParams: redirect ? { redirect } : {},
      });
    } else {
      await this.router.navigateByUrl(redirect ?? '/');
    }
  }

  /** A password sign-in's failure, onto the password view. */
  private renderPasswordFailure(err: unknown): void {
    const failure = toAuthFailure(
      err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }),
    );
    this.passwordError.set(failure.message);

    if (failure.kind === 'bad_code') {
      // A wrong password or no such account: the server says the same for both, and so do we. A
      // fresh field with the cursor in it makes the retry one keystroke away.
      this.passwordModel.update((m) => ({ ...m, password: '' }));
      this.passwordForm.password().reset();
      this.passwordForm.password().focusBoundControl();
    }
    if (failure.kind === 'locked') this.offerOtpInstead.set(true);
    if (isTerminalFailure(failure)) this.isTerminal.set(true);
  }

  /** What a password manager put in the fields, read straight off them — see `loginWithPassword`. */
  private pickUpAutofill(): void {
    const filled = (field: FieldTree<string>): string | undefined => {
      const element = field().formFieldBindings()[0]?.element;
      return element && 'value' in element ? String(element.value) : undefined;
    };
    const email = filled(this.passwordForm.email);
    const password = filled(this.passwordForm.password);
    this.passwordModel.update((m) => ({
      email: email ?? m.email,
      password: password ?? m.password,
    }));
  }

  private async send(contact: OtpContact): Promise<void> {
    const sent = await this.auth.sendOtp(contact);
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
      // The server owns the lock and the contract gives no duration, so this
      // countdown is OUR estimate — only a later 2xx proves the lock has lifted.
      this.now.set(Date.now());
      this.lockedUntil.set(Date.now() + LOCKOUT_FALLBACK_MS);
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
    // The tab is part of the URL, so a reload or a shared link opens this one. The entry is
    // rewritten in place, not navigated: a router navigation runs the app's view transition, which
    // cross-faded the whole page on every tab click. And Back leaves the code flow rather than
    // stepping through tabs.
    const tree = this.router.createUrlTree([], {
      queryParams: { method: method === 'PHONE' ? 'phone' : 'email' },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(tree));
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
    // The password must not outlive the page (contract §2.6: no persisted form state).
    this.passwordModel.set({ email: '', password: '' });
    this.passwordForm().reset();
    this.passwordError.set(null);
    this.offerOtpInstead.set(false);
  }
}
