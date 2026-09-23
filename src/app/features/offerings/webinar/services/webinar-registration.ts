import { DestroyRef, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiClient } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import {
  AttemptStatusResponse,
  isAlreadyRegistered,
  RegisterRequest,
  RegisterResponse,
  resolveStatusUrl,
  WEBINAR_ENDPOINTS,
} from '../models/webinar.model';
import { toWebinarError, WebinarError } from '../utils/webinar-error';

/**
 * Drives the two-call registration handshake.
 *
 * `register-via-zoom` is a **202 handshake, not a synchronous registration**.
 * The Zoom leg is three attempts with 1s/3s backoff and the Salesforce leg is
 * another three, so a worst case that still ENDS IN SUCCESS is roughly eight
 * seconds. That is not a request to hold open, so the endpoint answers
 * immediately with an `attempt_id` and the outcome is polled.
 */

/** Poll every 2s for the first 15s, then back off — matches the contract's advice. */
const FAST_POLL_MS = 2_000;
const FAST_POLL_WINDOW_MS = 15_000;
const SLOW_POLL_MS = 5_000;

export interface RegistrationOutcome {
  /** `'registered'` is the only outcome that opens a join affordance. */
  result: 'registered' | 'retry' | 'already-registered' | 'timed-out';
  attemptId: string | null;
  bookingId: string | null;
  joinUrl: string | null;
  registrantToken: string | null;
  /** Safe to surface. On `timed-out`, this is the reason the wait continues. */
  message: string | null;
  /**
   * The internal ten-state status, for DISPLAY ONLY, and only on `timed-out`.
   * This is the single place the client is meant to read it.
   */
  internalStatus: string | null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

@Service({ autoProvided: false })
export class WebinarRegistration {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);

  /**
   * Set when the route that provides this service is torn down.
   *
   * The poll below runs for up to `registrationPollCapSeconds` (45s today) and
   * nothing about leaving the page cancels an `await`. Without this, a learner
   * who registers and immediately navigates away leaves a loop hitting the API
   * every couple of seconds for the rest of the cap, and its result is handed
   * to a facade that no longer has a page. The in-flight request is allowed to
   * settle; what stops is the NEXT iteration.
   */
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  /** Webinar ids with a registration request in flight, for per-card spinners. */
  readonly inFlight = signal<ReadonlySet<string>>(new Set());

  isRegistering(webinarId: string): boolean {
    return this.inFlight().has(webinarId);
  }

  /**
   * Register, then poll to a terminal state.
   *
   * Safe to call twice: the backend absorbs a double-tap in two layers — a live
   * booking answers `200 already_registered`, and an in-flight attempt answers
   * `202` carrying THAT attempt's id. The expensive mistake being avoided is a
   * duplicate Zoom registrant.
   */
  async register(webinarId: string): Promise<RegistrationOutcome | WebinarError> {
    if (this.isRegistering(webinarId)) {
      return {
        result: 'timed-out',
        attemptId: null,
        bookingId: null,
        joinUrl: null,
        registrantToken: null,
        message: 'Registration already in progress.',
        internalStatus: null,
      };
    }
    this.mark(webinarId, true);

    try {
      const started = await this.postRegistration(webinarId);

      if (isAlreadyRegistered(started)) {
        return {
          result: 'already-registered',
          attemptId: null,
          bookingId: started.booking_id,
          joinUrl: null,
          registrantToken: null,
          message: started.message,
          internalStatus: null,
        };
      }

      // Follow the server's own `status_url` rather than assembling the path —
      // it is built off the URLconf, so it cannot drift from the real route.
      return await this.pollUntilTerminal(
        resolveStatusUrl(started.status_url, started.attempt_id),
        started.attempt_id,
      );
    } catch (err) {
      const error = toWebinarError(err);
      this.logger.error('[WebinarRegistration] register failed', error.code, err);
      return error;
    } finally {
      this.mark(webinarId, false);
    }
  }

  /**
   * POST the handshake, absorbing the one lock-contention retry.
   *
   * `409 registration_in_progress` means two taps landed inside the same few
   * milliseconds and this one lost the per-(user, webinar) lock. Waiting out
   * `retry_after_seconds` and retrying once yields the in-flight 202.
   */
  private async postRegistration(webinarId: string): Promise<RegisterResponse> {
    // ONE FIELD, AND THAT IS THE WHOLE BODY. Validation is strict: an undeclared
    // key is a 400 naming it, and that includes `webinar_date_id: null` — the
    // KEY is forbidden, not just a non-null value.
    const body: RegisterRequest = { webinar_id: webinarId };

    try {
      return await firstValueFrom(
        this.api.post<RegisterResponse>(WEBINAR_ENDPOINTS.register, body),
      );
    } catch (err) {
      const error = toWebinarError(err);
      if (error.code !== 'registration_in_progress') throw err;

      await sleep((error.retryAfterSeconds ?? 15) * 1000);
      return await firstValueFrom(
        this.api.post<RegisterResponse>(WEBINAR_ENDPOINTS.register, body),
      );
    }
  }

  /**
   * Poll the status route until `registration_status` leaves `PENDING`, or the
   * cap expires.
   *
   * The cap is not optional. `ZOOM_PENDING_APPROVAL` is terminal on the server
   * but reports as `PENDING` to the client, so an uncapped loop spins on it
   * forever. On timeout we stop and report the last internal `status` and
   * `error_message` — the one place reading that status is correct, and it is
   * for display, not for branching.
   */
  private async pollUntilTerminal(
    statusUrl: string,
    attemptId: string,
  ): Promise<RegistrationOutcome> {
    const capMs = environment.WEBINAR.registrationPollCapSeconds * 1000;
    const startedAt = Date.now();
    let last: AttemptStatusResponse | null = null;

    while (Date.now() - startedAt < capMs) {
      if (this.destroyed) break;
      const elapsed = Date.now() - startedAt;
      await sleep(elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS);
      if (this.destroyed) break;

      // The status route takes NO query parameters — any query string is a 400.
      last = await firstValueFrom(this.api.get<AttemptStatusResponse>(statusUrl));

      if (last.registration_status === 'REGISTERED') {
        return {
          result: 'registered',
          attemptId: last.attempt_id,
          bookingId: last.booking_id,
          joinUrl: last.join_url,
          registrantToken: last.registrant_token ?? null,
          message: null,
          internalStatus: last.status,
        };
      }

      if (last.registration_status === 'REGISTER') {
        // Includes the self-healing case: an attempt whose worker died mid-
        // pipeline is reaped on read and comes back `INTERRUPTED` with
        // `error_code: 'stuck'`. No Zoom registration was completed, so this is
        // a genuine retry affordance rather than a dead end.
        return {
          result: 'retry',
          attemptId: last.attempt_id,
          bookingId: last.booking_id,
          joinUrl: null,
          registrantToken: null,
          message: last.error_message,
          internalStatus: last.status,
        };
      }
    }

    return {
      result: 'timed-out',
      attemptId,
      bookingId: last?.booking_id ?? null,
      joinUrl: last?.join_url ?? null,
      registrantToken: last?.registrant_token ?? null,
      message: last?.error_message ?? null,
      internalStatus: last?.status ?? null,
    };
  }

  private mark(webinarId: string, active: boolean): void {
    this.inFlight.update((current) => {
      const next = new Set(current);
      if (active) next.add(webinarId);
      else next.delete(webinarId);
      return next;
    });
  }
}
