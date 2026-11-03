import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Service, computed, inject, linkedSignal, signal } from '@angular/core';
import { form, required, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { environment } from '@env/environment';
import { PasswordFailure, toPasswordFailure } from '@core/models/password.model';
import { AccountApi } from '@core/services/account-api/account-api';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { Logger } from '@core/services/logger/logger';
import { NotificationService } from '@core/services/notification/notification';
import { PasswordApi } from '@core/services/password-api/password-api';
import { PASSWORD_RETRY_FALLBACK_SECONDS } from '@features/auth/constants/auth';
import {
  OnboardingStep,
  PasswordMode,
  PasswordProof,
  ProfileStage,
  SetPasswordModel,
} from '@features/auth/models/set-password.model';
import { passwordPolicyBreach } from '@features/auth/utils/password-policy';

const EMPTY: SetPasswordModel = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  emailCode: '',
};

/**
 * Setting a password: the step that opens onboarding, and the profile's Password section (set, or
 * change with the current password).
 *
 * Provided on the `Profile` component, not on the route: it lives exactly as long as the page, so a
 * typed password can't outlive it (contract §2.6) and nothing has to be reset by hand.
 *
 * `password/` decides which proof it needs, not this client. A first password goes alone (allowed
 * within 15 minutes of a code sign-in, once); `verification_required` turns on the emailed code
 * (`password-code/`). Every documented answer of both routes has its own state.
 */
@Service({ autoProvided: false })
export class PasswordFacade {
  private readonly passwords = inject(PasswordApi);
  private readonly account = inject(AccountApi);
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly logger = inject(Logger);
  // Synchronous: the auth route's resolver merged the `auth.*` dictionary before the page rendered.
  private readonly transloco = inject(TranslocoService);
  private readonly t = (key: string): string => this.transloco.translate(key);

  /** The emailed code is the email sign-in code, so it has the login's box count. */
  readonly codeLength = environment.AUTH.otpLength;

  // ── What the page shows ───────────────────────────────────────────────────

  private readonly onboarding = signal(false);
  /** Onboarding's step, or the profile's section: the form picks its copy and buttons from this. */
  readonly isOnboarding = this.onboarding.asReadonly();
  readonly step = signal<OnboardingStep>('PASSWORD');
  /** Set before the session is dropped, so the page doesn't flash the questionnaire on its way out. */
  private readonly isLeaving = signal(false);

  /**
   * Onboarding offers a password unless the account is known to have one. `has_password: true` is
   * trustworthy and `false` can be wrong, which the step survives: the server then asks for proof.
   * An unknown (the read failed) never holds onboarding up.
   */
  readonly stage = computed<ProfileStage>(() => {
    if (this.isLeaving()) return 'DECIDING';
    if (!this.isOnboarding() || this.step() === 'QUESTIONS') return 'QUESTIONS';
    const user = this.account.user;
    if (user.hasValue()) return user.value().has_password === true ? 'QUESTIONS' : 'PASSWORD';
    return user.isLoading() ? 'DECIDING' : 'QUESTIONS';
  });

  /** `has_password: true` is trustworthy; anything else may or may not have one, so it offers to set. */
  readonly mode = computed<PasswordMode>(() =>
    this.account.user.hasValue() && this.account.user.value().has_password === true
      ? 'CHANGE'
      : 'SET',
  );

  /**
   * The profile's section needs `user-details/`: without it "set" and "change" can't be told apart,
   * and asking for a current password the learner may not have is worse than not offering one.
   */
  readonly showsSection = computed(
    () => !this.onboarding() && !this.isLeaving() && this.account.user.hasValue(),
  );
  readonly isOpen = signal(false);
  /** Counts the times the section's form closed, so the page can put focus back on its button. */
  readonly timesClosed = signal(0);

  // ── The form ──────────────────────────────────────────────────────────────

  readonly proof = signal<PasswordProof>('NONE');
  readonly model = signal<SetPasswordModel>({ ...EMPTY });

  /** Checked on submit, not by disabling the button, so a refusal always says why. */
  readonly form = form<SetPasswordModel>(this.model, (schema) => {
    required(schema.currentPassword, {
      when: () => this.proof() === 'CURRENT_PASSWORD',
      message: this.t('auth.password.errors.currentRequired'),
    });
    required(schema.newPassword, { message: this.t('auth.password.errors.newRequired') });
    validate(schema.newPassword, ({ value }) => {
      const breach = value() ? passwordPolicyBreach(value()) : null;
      return breach ? { kind: 'policy', message: this.t(`auth.password.errors.${breach}`) } : null;
    });
    required(schema.confirmPassword, { message: this.t('auth.password.errors.confirmRequired') });
    validate(schema.confirmPassword, ({ value, valueOf }) =>
      value() && value() !== valueOf(schema.newPassword)
        ? { kind: 'mismatch', message: this.t('auth.password.errors.mismatch') }
        : null,
    );
    // Only once the server has asked for a code; until then the field isn't on screen.
    required(schema.emailCode, {
      when: () => this.proof() === 'EMAIL_CODE',
      message: this.t('auth.password.errors.codeRequired'),
    });
    validate(schema.emailCode, ({ value }) => {
      const code = value();
      if (this.proof() !== 'EMAIL_CODE' || !code) return null;
      if (!/^\d+$/.test(code)) {
        return { kind: 'pattern', message: this.t('auth.otp.errors.digitsOnly') };
      }
      return code.length === this.codeLength
        ? null
        : {
            kind: 'minlength',
            message: this.transloco.translate('auth.password.errors.codeLength', {
              length: this.codeLength,
            }),
          };
    });
  });

  /** The SSO's `password_policy` message, under New password until it is edited. */
  readonly policyError = linkedSignal<string, string | null>({
    source: () => this.model().newPassword,
    computation: () => null,
  });

  /** `current_password_incorrect`, under Current password until it is retyped. */
  readonly currentError = linkedSignal<string, string | null>({
    source: () => this.model().currentPassword,
    computation: () => null,
  });

  /** `email_code_incorrect`, under the code until a new one is typed. */
  readonly codeError = linkedSignal<string, string | null>({
    source: () => this.model().emailCode,
    computation: () => null,
  });

  /** A failure that belongs to no one field. */
  readonly error = signal<string | null>(null);
  /** `verification_required`'s message: what the server needs, shown as guidance, not as an error. */
  readonly proofNote = signal<string | null>(null);
  /**
   * A 403 refusal: this account can't hold a password here. Onboarding's form gives way to Continue;
   * the profile's section shows only the message.
   */
  readonly refusal = signal<string | null>(null);

  readonly isSubmitting = signal(false);
  readonly isRequestingCode = signal(false);

  // ── The emailed code ──────────────────────────────────────────────────────

  readonly maskedEmail = signal<string | null>(null);
  /** A code from the last five minutes is still live and was not re-sent. */
  readonly codeReused = signal(false);
  /** A 503 "could not be set" spent the code: a new one before another try. */
  readonly codeSpent = signal(false);

  private readonly cooldownUntil = signal(0);
  private readonly codeValidUntil = signal(0);
  private readonly retryUntil = signal(0);
  /** Ticks once a second from the first countdown on; nothing else reads it. */
  private readonly now = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | undefined;

  /** Seconds left, for the template's `duration` pipe. */
  readonly resendIn = computed(() => this.secondsUntil(this.cooldownUntil()));
  readonly codeValidFor = computed(() => this.secondsUntil(this.codeValidUntil()));
  readonly retryIn = computed(() => this.secondsUntil(this.retryUntil()));

  readonly canRequestCode = computed(
    () => !this.isRequestingCode() && !this.isSubmitting() && this.resendIn() === 0,
  );
  readonly canSubmit = computed(
    () =>
      !this.isSubmitting() &&
      !this.isRequestingCode() &&
      !(this.codeSpent() && this.proof() === 'EMAIL_CODE') &&
      this.retryIn() === 0,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.ticker));
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /** The page says whether this is onboarding: it already owns that decision. */
  start(isOnboarding: boolean): void {
    this.onboarding.set(isOnboarding);
  }

  /** The profile's "Set a password" / "Change password". */
  openSection(): void {
    this.proof.set(this.mode() === 'CHANGE' ? 'CURRENT_PASSWORD' : 'NONE');
    this.error.set(null);
    this.proofNote.set(null);
    this.isOpen.set(true);
  }

  /** The section's Cancel. */
  cancelSection(): void {
    if (this.isSubmitting()) return;
    this.closeSection();
  }

  /** "Forgot your current password?": prove it with an emailed code instead, sent at once. */
  async useEmailCode(): Promise<void> {
    this.model.update((m) => ({ ...m, currentPassword: '', emailCode: '' }));
    this.form.currentPassword().reset();
    this.form.emailCode().reset();
    this.error.set(null);
    this.proof.set('EMAIL_CODE');
    await this.requestCode();
  }

  /** Back from the emailed code to the current password. */
  useCurrentPassword(): void {
    this.clearCode();
    this.error.set(null);
    this.proofNote.set(null);
    this.proof.set('CURRENT_PASSWORD');
  }

  /** The field a fresh form starts on. */
  focusFirstField(): void {
    const field =
      this.proof() === 'CURRENT_PASSWORD' ? this.form.currentPassword : this.form.newPassword;
    field().focusBoundControl();
  }

  /** "Skip for now", and the refusal's Continue. Nothing is sent; a reload offers the step again. */
  skip(): void {
    if (this.isSubmitting()) return;
    this.wipe();
    this.step.set('QUESTIONS');
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.form().markAsTouched();
    if (this.form().invalid()) {
      this.focusFirstError();
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);
    const { currentPassword, newPassword, emailCode } = this.model();
    const mode = this.mode();
    let failure: PasswordFailure | null = null;
    try {
      // Passwords exactly as typed, and one proof at most: an absent proof is omitted, never sent
      // empty.
      const proof = this.proof();
      const result = await this.passwords.set(
        proof === 'EMAIL_CODE'
          ? { newPassword, emailCode }
          : proof === 'CURRENT_PASSWORD'
            ? { newPassword, currentPassword }
            : { newPassword },
      );
      this.wipe();
      if (result.signedOut) {
        await this.leave('signedOut');
        return;
      }
      this.account.user.reload();
      if (this.onboarding()) {
        // No "other devices were signed out": a brand-new account has none.
        this.notify.success(
          this.t('auth.password.toast.setTitle'),
          this.t('auth.password.toast.setBody'),
        );
        this.step.set('QUESTIONS');
      } else {
        const changed = mode === 'CHANGE';
        this.notify.success(
          this.t(`auth.password.toast.${changed ? 'changedTitle' : 'setTitle'}`),
          this.t(
            result.signedOutOtherSessions
              ? 'auth.password.toast.otherDevices'
              : `auth.password.toast.${changed ? 'changedBody' : 'setBody'}`,
          ),
        );
        this.closeSection();
      }
    } catch (err) {
      failure = this.toFailure(err);
    } finally {
      this.isSubmitting.set(false);
    }
    // After `isSubmitting` drops: `verification_required` asks for a code next, which waits on it.
    if (failure) await this.render(failure, 'set');
  }

  /** Email a code — on `verification_required` straight away, and on "Resend code". */
  async requestCode(): Promise<void> {
    if (!this.canRequestCode()) return;

    this.isRequestingCode.set(true);
    this.error.set(null);
    let failure: PasswordFailure | null = null;
    try {
      const sent = await this.passwords.requestCode();
      this.maskedEmail.set(sent.maskedEmail);
      this.codeReused.set(sent.reused === true);
      this.codeValidUntil.set(
        sent.reused && sent.validForSeconds ? this.deadlineIn(sent.validForSeconds) : 0,
      );
      this.cooldownUntil.set(this.deadlineIn(sent.cooldownSeconds));
      this.codeSpent.set(false);
    } catch (err) {
      failure = this.toFailure(err);
    } finally {
      this.isRequestingCode.set(false);
    }
    if (failure) await this.render(failure, 'code');
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private toFailure(err: unknown): PasswordFailure {
    const failure = toPasswordFailure(
      err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }),
    );
    // The kind only: a body can echo what was sent.
    this.logger.warn('Password request failed', failure.kind);
    return failure;
  }

  /** Maps a failure onto the state the form renders for it (`prompts/onboarding-set-password.md`). */
  private async render(failure: PasswordFailure, from: 'set' | 'code'): Promise<void> {
    switch (failure.kind) {
      case 'policy':
        this.policyError.set(failure.message);
        this.form.newPassword().focusBoundControl();
        return;
      case 'verification_required':
        this.proofNote.set(failure.message);
        // Untouched: the submit that got here touched every field, and a code box can't be red
        // before the code has even been sent.
        this.form.emailCode().reset();
        this.proof.set('EMAIL_CODE');
        await this.requestCode();
        return;
      case 'code_incorrect':
        this.clearCode();
        this.codeError.set(failure.message);
        return;
      case 'current_password_incorrect':
        this.model.update((m) => ({ ...m, currentPassword: '' }));
        this.form.currentPassword().reset();
        // After the clear: the message resets whenever the field changes.
        this.currentError.set(failure.message);
        this.form.currentPassword().focusBoundControl();
        return;
      case 'session_expired':
        await this.leave('sessionEnded');
        return;
      case 'refused':
        this.wipe();
        this.isOpen.set(false);
        this.refusal.set(failure.message);
        return;
      case 'rate_limited': {
        this.error.set(failure.message);
        // `password-code/` says how long; `password/` doesn't, so that wait is an estimate.
        const until = this.deadlineIn(failure.retryAfterSeconds ?? PASSWORD_RETRY_FALLBACK_SECONDS);
        if (from === 'code') this.cooldownUntil.set(until);
        else this.retryUntil.set(until);
        return;
      }
      case 'code_spent':
        this.error.set(failure.message);
        if (this.proof() === 'EMAIL_CODE') {
          this.clearCode();
          this.codeSpent.set(true);
        }
        return;
      default:
        this.error.set(failure.message);
    }
  }

  /**
   * Out of a session that no longer works, to sign in. Onboarding keeps its `redirect`: a `new_user` is
   * sent back here after, and one who now has a password skips the step. The profile asks to come
   * back to itself, since sign-in otherwise lands on home.
   */
  private async leave(reason: 'signedOut' | 'sessionEnded'): Promise<void> {
    this.isLeaving.set(true);
    this.auth.clear();
    this.notify.info(
      this.t(`auth.password.toast.${reason}Title`),
      this.t(`auth.password.toast.${reason}Body`),
    );
    await (this.onboarding()
      ? this.router.navigate(['/auth/login'], { queryParamsHandling: 'preserve' })
      : this.router.navigate(['/auth/login'], { queryParams: { redirect: '/auth/profile' } }));
  }

  /**
   * The section's form away. What was sent stays (masked address, cooldown, a spent code): those are
   * the server's state, and a code sent a minute ago is still the one in the inbox.
   */
  private closeSection(): void {
    this.wipe();
    this.isOpen.set(false);
    this.timesClosed.update((n) => n + 1);
  }

  /** Passwords and code out of memory, and the fields back to untouched. */
  private wipe(): void {
    this.model.set({ ...EMPTY });
    this.form().reset();
  }

  private clearCode(): void {
    this.model.update((m) => ({ ...m, emailCode: '' }));
    this.form.emailCode().reset();
  }

  /** In the order the learner reads them. A field that isn't on screen has no control to focus. */
  private focusFirstError(): void {
    const fields = [
      this.form.currentPassword,
      this.form.newPassword,
      this.form.confirmPassword,
      this.form.emailCode,
    ];
    fields
      .find((field) => field().invalid())?.()
      .focusBoundControl();
  }

  /** A deadline `seconds` from now, starting the clock the first time a countdown needs it. */
  private deadlineIn(seconds: number): number {
    this.now.set(Date.now());
    this.ticker ??= setInterval(() => this.now.set(Date.now()), 1000);
    return Date.now() + seconds * 1000;
  }

  private secondsUntil(until: number): number {
    return Math.max(0, Math.ceil((until - this.now()) / 1000));
  }
}
