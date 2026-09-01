import { HttpContext } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StyleQrComponent } from '@code_with_sachin/ngx-style-qr';
import { logoIcon } from '../../../../shared/core/constant/icon';
import { Button } from '../../../../shared/components/ui/button/button';
import { Otp } from '../../../../shared/components/ui/otp/otp';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { Auth } from '../../../../shared/core/services/auth/auth';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { CAIRA } from '../../../../shared/core/http/caira.endpoints';
import { cairaError, userMessage } from '../../../../shared/core/http/caira-error';
import { SKIP_ERROR_NOTIFICATION } from '../../../../shared/core/models/caira/envelope.model';
import {
  QrConfirmRequest,
  QrConfirmResponse,
  QrFailureReason,
  QrInitiateRequest,
  QrInitiateResponse,
} from '../../../../shared/core/models/caira/qr-login.model';
import {
  QrCryptoError,
  QrKeyPair,
  decryptQrPayload,
  generateQrKeyPair,
  isQrCryptoAvailable,
} from './qr-crypto';

/** How many digits the phone's PIN carries. `make_pin()` produces `4324-3456`. */
const PIN_DIGITS = 6;

/**
 * Centre logo — the app's own mark, inlined as a data URI.
 *
 * A URL would taint the export canvas and break `download()`; the mark already
 * lives in the bundle as a string, so there is nothing to fetch. It is white
 * on a cleared (transparent) patch, matching the white modules on the dark card.
 * `ecLevel="H"` in the template is what makes the covered modules recoverable.
 */
const QR_LOGO = {
  src: `data:image/svg+xml,${encodeURIComponent(logoIcon)}`,
  size: 0.22,
  padding: 2,
} as const;

/**
 * Cross-device QR sign-in — endpoints #36 and #38.
 *
 * The learner sees a code, scans it in the Miles One app, and types back the
 * PIN the app shows. That middle step is #37, which is the *phone's* call and
 * is not implemented here.
 *
 * All state is local: nothing outside this component reads a QR session, so it
 * lives here rather than in a service (AGENTS.md §3). The keypair is a plain
 * field, not a signal — it is never rendered and nothing derives from it, and
 * keeping a private key out of the reactive graph keeps it out of any state
 * snapshot too.
 *
 * **Browser-only.** `crypto.subtle` does not exist during SSR, so the template
 * renders a placeholder until `start()` runs from a real browser.
 *
 * One step is unverifiable today: decrypting #38's response depends on a crypto
 * contract the API reference puts out of scope (G-04). See `qr-crypto.ts` —
 * a mismatch there ends as a clear message and a working fallback to the other
 * sign-in methods, never a half-authenticated state.
 */
@Component({
  selector: 'app-qr-login',
  imports: [StyleQrComponent, Button, Otp, Spinner],
  templateUrl: './qr-login.html',
})
export class QrLogin {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);

  /** Emitted once the token pair is stored — the login page owns the redirect. */
  readonly authenticated = output<void>();

  protected readonly pinDigits = PIN_DIGITS;
  protected readonly qrLogo = QR_LOGO;

  /**
   * `idle` before the first `start()`, `expired` once the 120 s window closes.
   * `unsupported` is the SSR / no-WebCrypto case.
   */
  protected readonly status = signal<
    'idle' | 'starting' | 'waiting' | 'confirming' | 'expired' | 'unsupported'
  >('idle');

  protected readonly sessionId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  /** From a 401's `attempts_remaining`; `null` until the first wrong PIN. */
  protected readonly attemptsLeft = signal<number | null>(null);
  protected readonly pin = signal('');

  /** Memory only. Never persisted, never logged, dropped on destroy. */
  private keyPair: QrKeyPair | null = null;

  // ---------------------------------------------------------------------------
  // Expiry countdown
  //
  // Deadline-based for the same reason the OTP resend timer is: background tabs
  // get `setInterval` throttled to about once a minute, and reading a PIN off a
  // phone is exactly when this tab is in the background. Counting ticks would
  // leave a long-dead session looking live.
  // ---------------------------------------------------------------------------

  private readonly expiresAt = signal(0);
  private readonly clock = signal(0);
  private countdownHandle: ReturnType<typeof setInterval> | null = null;

  protected readonly secondsLeft = computed(() =>
    Math.max(0, Math.ceil((this.expiresAt() - this.clock()) / 1000)),
  );
  protected readonly countdown = computed(() => {
    const total = this.secondsLeft();
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  protected readonly canConfirm = computed(
    () => this.pin().replace(/\D/g, '').length === PIN_DIGITS && this.status() === 'waiting',
  );

  constructor() {
    // `afterNextRender` rather than an effect: this is a one-shot browser-only
    // kick-off, not a reaction to state. The login page creates this component
    // only when the QR method is chosen, so first render *is* the trigger — and
    // the hook never runs during SSR, where `crypto.subtle` does not exist.
    afterNextRender(() => void this.start());

    this.destroyRef.onDestroy(() => {
      this.stopCountdown();
      // Drop the private key as soon as the screen goes away.
      this.keyPair = null;
    });
  }

  /** #36 · mint a keypair and open a session. */
  async start(): Promise<void> {
    if (!isQrCryptoAvailable()) {
      this.status.set('unsupported');
      return;
    }

    this.status.set('starting');
    this.reset();

    try {
      this.keyPair = await generateQrKeyPair();
    } catch (cause) {
      this.logger.error('QR login: could not generate a keypair', cause);
      this.fail('This browser cannot start QR sign-in. Please use email or phone.');
      return;
    }

    const body: QrInitiateRequest = { public_key: this.keyPair.publicKey };
    this.api
      .post<QrInitiateResponse>(CAIRA.qrInitiate, body, silent())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (!response?.session_id) {
            this.fail('Could not start QR sign-in. Please try again.');
            return;
          }
          this.sessionId.set(response.session_id);
          this.status.set('waiting');
          // The documented TTL is 120 s, but trust the server's own number.
          this.startCountdown(response.expires_in ?? 120);
        },
        error: (err: unknown) => {
          const failure = cairaError(err);
          this.logger.error('QR login: initiate failed', failure);
          // 503 here means Redis is down — it is the only QR session store.
          this.fail(userMessage(failure));
        },
      });
  }

  /**
   * #38 · exchange the PIN for the encrypted token pair, then decrypt it.
   *
   * The PIN is sent in the dashed form the phone displays. Whether
   * `store.verify_pin` strips the dash is undocumented; sending it exactly as
   * shown is the one form that cannot be wrong for the wrong reason.
   */
  confirm(): void {
    const sessionId = this.sessionId();
    const privateKey = this.keyPair?.privateKey;
    if (!sessionId || !privateKey || !this.canConfirm()) return;

    this.status.set('confirming');
    this.error.set(null);

    const body: QrConfirmRequest = {
      session_id: sessionId,
      verification_pin: this.pin(),
    };

    this.api
      .post<QrConfirmResponse>(CAIRA.qrConfirm, body, silent())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => void this.completeLogin(response, privateKey),
        error: (err: unknown) => this.handleConfirmError(err),
      });
  }

  /** Start over after a lockout or an expiry. The old session is already dead. */
  rescan(): void {
    void this.start();
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async completeLogin(
    response: QrConfirmResponse | null,
    privateKey: CryptoKey,
  ): Promise<void> {
    if (!response?.payload) {
      this.fail('QR sign-in did not return a session. Please try again.');
      return;
    }

    try {
      const session = await decryptQrPayload(response.payload, privateKey);
      // Same path as password and OTP login: setting the access token is what
      // loads the profile, since `Auth` keys `v2/status` on the token signal.
      this.auth.storeTokens(session.access_token, session.refresh_token);
      this.stopCountdown();
      this.authenticated.emit();
    } catch (cause) {
      // The session is already spent — #38 purges it before replying — so there
      // is nothing to retry with. Say so plainly and point at the other methods.
      this.logger.error('QR login: payload decryption failed', cause);
      this.status.set('expired');
      this.error.set(
        cause instanceof QrCryptoError
          ? 'QR sign-in is not available right now. Please use email or phone.'
          : 'Something went wrong completing QR sign-in. Please try another method.',
      );
    }
  }

  /**
   * Every documented #38 failure is a UI state, not an error toast —
   * `errorInterceptor` already declines to toast `kind: 'domain'`.
   */
  private handleConfirmError(err: unknown): void {
    const failure = cairaError(err);

    if (failure.kind === 'domain') {
      switch (failure.reason) {
        case QrFailureReason.INVALID_PIN: {
          const remaining = failure.extra['attempts_remaining'];
          this.attemptsLeft.set(typeof remaining === 'number' ? remaining : null);
          this.status.set('waiting');
          this.pin.set('');
          this.error.set(failure.message ?? 'Incorrect PIN.');
          return;
        }
        case QrFailureReason.NOT_CLAIMED:
          this.status.set('waiting');
          this.error.set(failure.message ?? 'Scan the QR code with your phone first.');
          return;
        case QrFailureReason.LOCKED_OUT:
          // The store deleted the session; only a fresh code can help.
          this.expire(failure.message ?? 'Too many incorrect attempts. Please rescan.');
          return;
      }
    }

    if (failure.kind === 'notFound') {
      this.expire('This code has expired. Please rescan.');
      return;
    }

    this.logger.error('QR login: confirm failed', failure);
    this.status.set('waiting');
    this.error.set(userMessage(failure));
  }

  private startCountdown(seconds: number): void {
    this.stopCountdown();
    this.expiresAt.set(Date.now() + seconds * 1000);
    this.clock.set(Date.now());
    this.countdownHandle = setInterval(() => {
      this.clock.set(Date.now());
      if (this.secondsLeft() === 0) {
        this.expire('This code has expired. Please rescan.');
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownHandle !== null) {
      clearInterval(this.countdownHandle);
      this.countdownHandle = null;
    }
  }

  private expire(message: string): void {
    this.stopCountdown();
    this.status.set('expired');
    this.sessionId.set(null);
    this.pin.set('');
    this.error.set(message);
  }

  private fail(message: string): void {
    this.stopCountdown();
    this.status.set('expired');
    this.error.set(message);
  }

  private reset(): void {
    this.error.set(null);
    this.attemptsLeft.set(null);
    this.pin.set('');
    this.sessionId.set(null);
  }
}

/**
 * Re-insert the dash the phone shows, so `1234` `5678` typed into eight boxes
 * goes back as `1234-5678`.
 */
// function formatPin(raw: string): string {
//   const digits = raw.replace(/\D/g, '').slice(0, PIN_DIGITS);
//   return `${digits.slice(0, 4)}-${digits.slice(4)}`;
// }

/** QR shows its failures inline; the global toast would be noise on top. */
function silent() {
  return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
}
