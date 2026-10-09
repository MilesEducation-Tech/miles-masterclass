import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, inject, Service, PLATFORM_ID, signal } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '@env/environment';
import { ApiClient, apiUrl } from '@core/services/api-client/api-client';
import { Logger } from '@core/services/logger/logger';
import { isObject } from '@features/offerings/utils/contract-guards';
import {
  HEARTBEAT_MAX_SECONDS,
  HEARTBEAT_MIN_SECONDS,
  LIVE_SESSION_BACKGROUND,
  LIVE_SESSION_CHANNEL,
  LIVE_SESSION_LOCK,
  LIVE_SESSION_ROUTES,
  TAKEOVER_POLL_MS,
  TAKEOVER_WAIT_MS,
} from '@features/offerings/webinar/constants/live-session';
import {
  ClaimResponse,
  EjectionReason,
  LeaseHolder,
  parseClaim,
  parseLeaseHolder,
  parseSignature,
  SessionChannelMessage,
  SessionConflict,
  SignatureResponse,
} from '@features/offerings/webinar/models/meeting-session.model';
import { deviceLabel } from '@features/offerings/webinar/utils/device-label';
import {
  isSessionConflict,
  isSupersededError,
  toWebinarError,
} from '@features/offerings/webinar/utils/webinar-error';

/**
 * Enforces "one learner, one meeting, one surface" in three layers.
 *
 * The rule is stronger than it looks: the lease key is the USER, not the
 * (user, webinar) pair — joining a second, different webinar must conflict too.
 *
 * ## Layer 1 — the server lease (authoritative)
 * The only layer that reaches across browsers, profiles, incognito windows and
 * devices. Crucially, the Zoom signature is minted by the same endpoint that
 * holds the lease, so a surface without the lease cannot obtain the credentials
 * to join at all. Everything below is UX on top of that fact — none of it is
 * the security boundary.
 *
 * ## Layer 2 — Web Locks (same browser profile, instant)
 * `navigator.locks` guarantees no other tab, iframe or worker on this origin
 * holds the same named lock. It buys two things a heartbeat cannot: a second
 * tab learns it has lost with ZERO network round trips, and — the important one
 * — the lock releases automatically when a tab is force-quit or crashes. A
 * localStorage flag left behind by a dead tab locks the user out until its TTL
 * expires; a Web Lock simply stops existing.
 *
 * ## Layer 3 — BroadcastChannel (same browser, coordination)
 * Locks answer "who goes first", not "who else needs to know". This is how the
 * losing tab renders its conflict state instantly, and how a takeover evicts the
 * old tab immediately instead of waiting up to a full heartbeat for the server
 * to tell it.
 *
 * Route-scoped: provided on the `/live` route, so the lock's lifetime is exactly
 * the lifetime of the page that holds the meeting.
 */
@Service({ autoProvided: false })
export class MeetingSession {
  private readonly api = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Stable for this surface's whole session; the lease is keyed on it. */
  readonly sessionId = this.isBrowser ? crypto.randomUUID() : '';

  /** How this device is named on the learner's other devices ("Chrome on macOS"). */
  private readonly deviceLabel = this.isBrowser ? deviceLabel(navigator.userAgent) : '';

  readonly conflict = signal<SessionConflict | null>(null);
  readonly ejection = signal<EjectionReason | null>(null);
  readonly holdsLease = signal(false);

  /**
   * Called when the session is lost and the SDK must be torn down. Set by the
   * meeting page; kept as a callback rather than a signal because leaving a
   * meeting is an imperative action, not a piece of state to render.
   */
  onEvict: ((reason: EjectionReason) => void) | null = null;

  private channel: BroadcastChannel | null = null;
  private releaseWebLock: (() => void) | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private currentWebinarId: string | null = null;
  /**
   * Set when `pagehide` gave the lease back by beacon. If the page then comes
   * back from the bfcache, the lease is gone and Zoom left on unload, so the
   * room must not keep claiming to be live.
   */
  private releasedByBeacon = false;

  constructor() {
    if (this.isBrowser) {
      this.openChannel();
      this.watchPageLifecycle();
    }
    this.destroyRef.onDestroy(() => this.teardown());
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Take the session and mint a Zoom signature, or explain why not.
   *
   * Order matters: the local lock is checked first because it costs nothing and
   * answers instantly, then the server lease, then the signature. A user who
   * already has this webinar open in another tab never generates a request.
   */
  async acquire(webinarId: string, takeover = false): Promise<SignatureResponse | null> {
    if (!this.isBrowser) return null;
    this.currentWebinarId = webinarId;
    this.conflict.set(null);
    this.ejection.set(null);

    const gotLocalLock = await this.acquireWebLock();
    if (!gotLocalLock) {
      if (!takeover) {
        this.conflict.set({ source: 'local-tab' });
        return null;
      }
      // Ask the holding tab to stand down, then wait for it to let go. If it
      // never does (it is wedged), the server lease still arbitrates below.
      this.post({ type: 'takeover-requested', sessionId: this.sessionId, webinarId });
      await this.waitForWebLock();
    }

    try {
      const claim = await this.claimLease(webinarId, takeover);
      this.holdsLease.set(true);
      this.startHeartbeat(claim.heartbeat_interval_seconds);
      this.post({ type: 'claimed', sessionId: this.sessionId, webinarId });

      return await this.mintSignature(webinarId);
    } catch (err) {
      const error = toWebinarError(err);

      if (isSessionConflict(error)) {
        this.conflict.set({
          source: 'remote',
          holder: this.readHolder(err),
          detail: error.message,
        });
      } else {
        this.conflict.set(null);
        // A refusal the contract names (not registered, not open yet, ended…)
        // is an answer, not a fault; only the unexplained ones are errors.
        if (error.code === 'unknown_error') {
          this.logger.error('[MeetingSession] acquire failed', error.code, err);
        } else {
          this.logger.warn('[MeetingSession] acquire refused', error.code);
        }
      }

      // The lease may already be OURS: `claimLease` can succeed and
      // `mintSignature` still fail, and by then the heartbeat is running.
      // Unwinding in the right order matters — `release()` is a no-op once
      // `holdsLease` is false, so give the lease back BEFORE clearing the flag,
      // or the learner holds a session they cannot enter until the TTL expires
      // and a timer keeps renewing it behind a screen showing an error.
      if (this.holdsLease()) {
        await this.release();
      } else {
        this.stopHeartbeat();
        // Do not sit on a local lock we could not back with a server lease —
        // another tab in this browser would be blocked for nothing.
        this.dropWebLock();
      }
      this.holdsLease.set(false);
      if (!isSessionConflict(error)) throw err;
      return null;
    }
  }

  /** Give the session up deliberately — the learner left the meeting. */
  async release(): Promise<void> {
    if (!this.isBrowser || !this.holdsLease()) return;
    this.stopHeartbeat();
    this.holdsLease.set(false);
    this.post({ type: 'released', sessionId: this.sessionId });
    this.dropWebLock();

    try {
      await firstValueFrom(
        this.api.call(
          LIVE_SESSION_ROUTES.release,
          { session_id: this.sessionId },
          { context: LIVE_SESSION_BACKGROUND },
        ),
      );
    } catch (err) {
      // A failed release is not worth surfacing: the lease expires on its own
      // in 45s, and the learner has already left.
      this.logger.warn('[MeetingSession] release failed; lease will expire', err);
    }
  }

  // ---- Layer 1: the server lease -------------------------------------------

  private async claimLease(webinarId: string, takeover: boolean): Promise<ClaimResponse> {
    return await firstValueFrom(
      this.api
        .call(LIVE_SESSION_ROUTES.claim, {
          webinar_id: webinarId,
          session_id: this.sessionId,
          takeover,
          surface: 'web',
          device_label: this.deviceLabel,
        })
        .pipe(map(parseClaim)),
    );
  }

  private async mintSignature(webinarId: string): Promise<SignatureResponse> {
    return await firstValueFrom(
      this.api
        .call(LIVE_SESSION_ROUTES.signature, {
          webinar_id: webinarId,
          session_id: this.sessionId,
          surface: 'web',
        })
        .pipe(map(parseSignature)),
    );
  }

  /**
   * Keep the lease alive, and learn about eviction.
   *
   * TTL is 45s against a 15s cadence — three misses before expiry, so one
   * dropped request on a flaky connection never ejects someone who is watching.
   *
   * This is also the ONLY way a surface in a different browser or on a different
   * device finds out it has been superseded, since BroadcastChannel cannot reach
   * it. Worst-case eviction delay is therefore one interval.
   */
  private startHeartbeat(intervalSeconds: number | null): void {
    this.stopHeartbeat();
    const seconds = heartbeatSeconds(intervalSeconds);

    this.heartbeatId = setInterval(async () => {
      try {
        await this.beat();
      } catch (err) {
        const error = toWebinarError(err);
        if (isSupersededError(error)) {
          this.evict('superseded-remotely');
          return;
        }
        // Any other failure is treated as transient. Ejecting on a single
        // network blip would throw someone out of a session they are paying
        // attention to; the server's own TTL is the backstop.
        this.logger.warn('[MeetingSession] heartbeat failed', error.code);
      }
    }, seconds * 1000);
  }

  /** One heartbeat. Its body is not read: the 200 is the whole answer. */
  private async beat(): Promise<void> {
    await firstValueFrom(
      this.api.call(
        LIVE_SESSION_ROUTES.heartbeat,
        { session_id: this.sessionId },
        { context: LIVE_SESSION_BACKGROUND },
      ),
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatId !== null) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }

  // ---- Layer 2: Web Locks --------------------------------------------------

  /**
   * Try to take the origin-wide lock, without waiting.
   *
   * The lock is held inside a promise that never resolves, so it lives for as
   * long as this tab does. `dropWebLock` resolves it to let go.
   */
  private acquireWebLock(): Promise<boolean> {
    if (!('locks' in navigator)) {
      // No Web Locks: fall through to the server lease alone. It is slower to
      // notice a sibling tab, but it is still correct.
      return Promise.resolve(true);
    }

    return new Promise<boolean>((settle) => {
      navigator.locks
        .request(LIVE_SESSION_LOCK, { ifAvailable: true }, (lock) => {
          if (!lock) {
            settle(false);
            return Promise.resolve();
          }
          settle(true);
          return new Promise<void>((resolveHeld) => {
            this.releaseWebLock = resolveHeld;
          });
        })
        .catch((err) => {
          this.logger.warn('[MeetingSession] web lock request failed', err);
          settle(true);
        });
    });
  }

  /** Wait for a sibling tab to stand down, with a ceiling so we never hang. */
  private async waitForWebLock(): Promise<void> {
    const deadline = Date.now() + TAKEOVER_WAIT_MS;
    while (Date.now() < deadline) {
      if (await this.acquireWebLock()) return;
      await new Promise((resolve) => setTimeout(resolve, TAKEOVER_POLL_MS));
    }
  }

  private dropWebLock(): void {
    this.releaseWebLock?.();
    this.releaseWebLock = null;
  }

  // ---- Layer 3: BroadcastChannel -------------------------------------------

  private openChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel(LIVE_SESSION_CHANNEL);
    this.channel.onmessage = (event: MessageEvent<SessionChannelMessage>) => {
      const msg = event.data;
      // Ignore our own echo — BroadcastChannel does not deliver to the sender,
      // but a re-entrant claim within this tab would still show up here.
      if (msg.sessionId === this.sessionId) return;

      switch (msg.type) {
        case 'takeover-requested':
        case 'claimed':
          // Another tab of ours is taking the session. Stand down immediately
          // rather than making the user wait for the server to say so.
          if (this.holdsLease()) this.evict('taken-over-locally');
          else this.dropWebLock();
          break;
        case 'released':
          // The holder let go; a tab showing the conflict screen can retry.
          if (this.conflict()?.source === 'local-tab') this.conflict.set(null);
          break;
      }
    };
  }

  private post(message: SessionChannelMessage): void {
    this.channel?.postMessage(message);
  }

  // ---- Page lifecycle ------------------------------------------------------

  /**
   * The edges that actually leak sessions in production.
   *
   * - `pagehide`, not `beforeunload`: the latter is unreliable on mobile Safari
   *   and is skipped entirely when a page enters the bfcache.
   * - `sendBeacon`, not a normal POST: the document is being torn down and a
   *   regular request is cancelled with it.
   * - `visibilitychange` deliberately does NOT release. Backgrounding a tab is
   *   not leaving a webinar, and treating it as one would eject anyone who
   *   checks their email mid-session.
   * - `pageshow` with `persisted` means a bfcache restore. If `pagehide` gave
   *   the lease back by beacon, the session is over on both ends (Zoom left on
   *   unload too), so the room drops to "disconnected" and offers a rejoin.
   *   Otherwise the heartbeat was merely frozen while we were away, and one
   *   beat re-verifies the lease before the UI keeps claiming to be live.
   */
  private watchPageLifecycle(): void {
    const onPageHide = () => this.beaconRelease();
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      if (this.releasedByBeacon) {
        this.releasedByBeacon = false;
        this.evict('connection-lost');
      } else if (this.holdsLease()) {
        void this.verifyAfterRestore();
      }
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    });
  }

  /**
   * Best-effort release during document teardown, when a normal request cannot
   * survive. `pagehide` only — an in-app navigation goes through `release()`,
   * which is authenticated and gets a response.
   *
   * The release route is built for exactly this caller (`AllowAny`, CSRF-exempt):
   *   1. `sendBeacon` cannot set headers, so this carries NO `Authorization`;
   *      the route ends the lease only while this `session_id` still holds it.
   *   2. The body MUST be a plain string. A string is sent as
   *      `text/plain;charset=UTF-8`, which is CORS-safelisted; an
   *      `application/json` Blob needs a preflight a beacon cannot make, and the
   *      browser drops it silently — the learner then waits out the 45s TTL to
   *      rejoin from another device.
   * The TTL stays the backstop, which is why this is best-effort.
   */
  private beaconRelease(): void {
    if (!this.holdsLease()) return;
    try {
      const body = JSON.stringify({ session_id: this.sessionId });
      this.releasedByBeacon = navigator.sendBeacon(apiUrl(LIVE_SESSION_ROUTES.release.path), body);
    } catch {
      // Nothing to do — the lease TTL is the backstop.
    }
  }

  /** One heartbeat after a bfcache restore, to learn if we were superseded. */
  private async verifyAfterRestore(): Promise<void> {
    try {
      await this.beat();
    } catch (err) {
      if (isSupersededError(toWebinarError(err))) this.evict('superseded-remotely');
    }
  }

  // ---- Eviction ------------------------------------------------------------

  private evict(reason: EjectionReason): void {
    this.stopHeartbeat();
    this.holdsLease.set(false);
    this.dropWebLock();
    this.ejection.set(reason);
    this.onEvict?.(reason);
  }

  private teardown(): void {
    // A normal in-app navigation, not a document unload: the injector is going
    // away but the network is not, so use the real authenticated release rather
    // than the header-less beacon. Not awaited — `onDestroy` cannot wait, and
    // the request is already on the wire by the time this returns.
    void this.release();
    this.stopHeartbeat();
    this.dropWebLock();
    this.channel?.close();
    this.channel = null;
  }

  /** Pull the holder block off a `409 session_active` for the conflict dialog. */
  private readHolder(err: unknown): LeaseHolder | null {
    if (!(err instanceof HttpErrorResponse) || !isObject(err.error)) return null;
    // On the body, or inside `data` if the refusal is wrapped (see `toWebinarError`).
    const body = err.error;
    const inner = isObject(body['data']) ? body['data'] : {};
    return parseLeaseHolder(body['holder'] ?? inner['holder']);
  }
}

/**
 * The server's heartbeat cadence when it is a sane one, else the environment
 * default. A `0` or a string must never become `setInterval(fn, 0)`.
 */
function heartbeatSeconds(fromServer: number | null): number {
  return fromServer !== null &&
    fromServer >= HEARTBEAT_MIN_SECONDS &&
    fromServer <= HEARTBEAT_MAX_SECONDS
    ? fromServer
    : environment.WEBINAR.leaseHeartbeatSeconds;
}
