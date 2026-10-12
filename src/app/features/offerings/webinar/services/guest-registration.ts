import { DestroyRef, Service, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { dialCodeWithLength } from '@core/constants/dial-code';
import { AuthFailure, OtpChannel, OtpContact, toAuthFailure } from '@core/models/auth.model';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { WebinarFacade } from './webinar-facade';

/** Used only until a send response tells us the real `cooldownSeconds`. */
const FALLBACK_COOLDOWN_SECONDS = 60;

const DIAL_CODES = [...new Set(dialCodeWithLength.map((row) => String(row.CountryCode ?? '')))];

/**
 * The seat card's one field as send/verify want it: an email as typed, or a
 * `+`-prefixed phone split into `mobile` and `country_code`. `null` when it is
 * neither, which is what the seat form's validator refuses.
 *
 * Dial codes are prefix-free (ITU E.164), so the first code the number starts
 * with is the only one. Spaces are dropped because the placeholder itself
 * shows them.
 */
export function toOtpContact(value: string): OtpContact | null {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { email: trimmed };
  const phone = trimmed.replace(/\s+/g, '');
  if (!/^\+\d{7,15}$/.test(phone)) return null;
  const code = DIAL_CODES.find((c) => c && phone.startsWith(c));
  return code ? { mobile: phone.slice(code.length), country_code: code } : null;
}

export type SeatStep = 'identify' | 'otp';

/**
 * The guest hero's "Secure Your Seat" card, as a flow.
 *
 * v3 let an anonymous visitor register from an inline form (name, email,
 * phone, location, company → OTP → done) against a v2 route this platform
 * does not have. On the Events contract a seat is a `register-via-zoom` call,
 * and that route is `IsAuthenticated` and reads the learner's PROFILE for the
 * email and first name — so the only honest guest flow is: sign in by OTP
 * (which is also sign-up), then register with the session that produced.
 *
 * Two steps, one identifier, no dial-code picker: the field takes an email
 * or an E.164 phone, split by `toOtpContact`, and the full login page (with its
 * country codes, consent and lockout tally) is one click away for anyone who
 * needs it. Anything longer-lived than this card lives in `AuthSession`.
 *
 * `autoProvided: false` — provided on the webinar parent route beside
 * `WebinarFacade`, and dies with it.
 */
@Service({ autoProvided: false })
export class GuestRegistration {
  readonly otpLength = environment.AUTH.otpLength;

  private readonly auth = inject(AuthSession);
  private readonly facade = inject(WebinarFacade);
  private readonly router = inject(Router);

  readonly step = signal<SeatStep>('identify');
  /** As typed, for the confirmation line. `contact` is what the API gets. */
  readonly identifier = signal('');
  private contact: OtpContact | null = null;
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  /** `channel` from the send RESPONSE — never inferred from what was typed. */
  readonly channel = signal<OtpChannel | null>(null);

  private readonly cooldownUntil = signal(0);
  private readonly now = signal(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTicker());
  }

  readonly secondsLeft = computed(() =>
    Math.max(0, Math.ceil((this.cooldownUntil() - this.now()) / 1000)),
  );
  readonly canResend = computed(() => this.secondsLeft() === 0 && !this.isLoading());

  /** `0:30`, for "Resend OTP in 0:30". */
  readonly cooldownDisplay = computed(() => {
    const total = this.secondsLeft();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  readonly deliveryNote = computed(() => {
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

  /** Step one: send the code and move to the OTP step. */
  async sendCode(identifier: string): Promise<void> {
    if (this.isLoading()) return;
    // The seat form's validator has already said why when this is null.
    const contact = toOtpContact(identifier);
    if (!contact) return;

    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.send(contact);
      this.contact = contact;
      this.identifier.set(identifier.trim());
      this.step.set('otp');
    } catch (err) {
      this.renderFailure(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Step two: exchange the code for a session, then take the seat.
   *
   * A `new_user` has no email or first name on file yet, and `register-via-zoom`
   * answers `missing_email` / `missing_first_name` to exactly that — so they
   * finish their profile first and come straight back here, on the same
   * `redirect` convention `authGuard` uses. Everyone else is registered in
   * place: the session is stored by `AuthSession.verifyOtp`, `loginType` flips
   * to `post_login`, and the hero re-renders as a member with the seat booked.
   */
  async verifyAndRegister(webinarId: string, code: string): Promise<void> {
    if (this.isLoading() || !this.contact) return;

    this.isLoading.set(true);
    this.error.set(null);
    try {
      const session = await this.auth.verifyOtp(this.contact, code);
      this.stopTicker();

      if (session.profile_status === 'new_user') {
        await this.router.navigate(['/auth/profile'], {
          queryParams: { redirect: this.router.url },
        });
        return;
      }

      await this.facade.register(webinarId);
      this.reset();
    } catch (err) {
      const failure = this.renderFailure(err);
      if (failure.kind === 'retry_new_code') {
        // The code they used is spent. Back to step one, reason kept on screen.
        this.step.set('identify');
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async resend(): Promise<void> {
    if (!this.canResend() || !this.contact) return;

    this.isLoading.set(true);
    this.error.set(null);
    try {
      await this.send(this.contact);
    } catch (err) {
      this.renderFailure(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** "Change email" — back to step one without losing what was typed. */
  edit(): void {
    this.step.set('identify');
    this.error.set(null);
  }

  reset(): void {
    this.stopTicker();
    this.step.set('identify');
    this.identifier.set('');
    this.contact = null;
    this.error.set(null);
    this.channel.set(null);
    this.cooldownUntil.set(0);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async send(contact: OtpContact): Promise<void> {
    const sent = await this.auth.sendOtp(contact);
    this.channel.set(sent.channel ?? null);
    // Read the cooldown off the response; never hardcode one.
    const seconds = sent.cooldownSeconds ?? FALLBACK_COOLDOWN_SECONDS;
    this.now.set(Date.now());
    this.cooldownUntil.set(Date.now() + seconds * 1000);
    this.startTicker();
  }

  private renderFailure(err: unknown): AuthFailure {
    const failure = toAuthFailure(
      err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }),
    );
    this.error.set(failure.message);
    return failure;
  }

  /** One interval, alive only while a cooldown is running. */
  private startTicker(): void {
    if (this.ticker !== null) return;
    this.ticker = setInterval(() => {
      this.now.set(Date.now());
      if (this.secondsLeft() === 0) this.stopTicker();
    }, 1000);
  }

  private stopTicker(): void {
    if (this.ticker === null) return;
    clearInterval(this.ticker);
    this.ticker = null;
  }
}
