import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Service, PLATFORM_ID, signal } from '@angular/core';
import { Logger } from '@core/services/logger/logger';
import { isNum, isObject, isStr } from '@features/offerings/utils/contract-guards';
import { ZOOM_ERROR_OUTCOMES } from '@features/offerings/webinar/constants/live-session';
import {
  ConnectionChangePayload,
  JoinPhase,
  SignatureResponse,
  ZoomCloseReason,
  ZoomEmbeddedClient,
  ZoomJoinOutcome,
  ZoomJoinParams,
} from '@features/offerings/webinar/models/meeting-session.model';

/**
 * Thin wrapper around the Zoom Meeting SDK's Component View.
 *
 * Three constraints shape this file:
 *
 * 1. **The SDK is imported dynamically, inside `join()`.** `@zoom/meetingsdk`
 *    is multi-megabyte and this app's production initial-bundle budget is
 *    2.00 MB, already close to full. A static import would put Zoom in `main`
 *    and fail `build:prod` — which is the correct outcome, so do not "fix" that
 *    by raising the budget. The same reasoning drives the lazy
 *    `import('@supabase/supabase-js')` in `@core/services/supabase`. The SDK's
 *    TYPES are imported with `import type` in the model, which the build erases.
 *
 * 2. **Browser only.** The SDK touches `window`, `document` and WebAssembly at
 *    module scope. The `/live` route is registered as `RenderMode.Client` so
 *    this never runs during SSR, and the platform guard below is the backstop.
 *
 * 3. **Zoneless is an advantage here.** Zoom's own Angular guidance is to run
 *    the SDK outside the zone and patch `zone-flags.ts` to stop its event loop
 *    triggering change detection on every frame. With no `zone.js` in this app
 *    there is nothing to patch and nothing to opt out of.
 *
 * It reports what Zoom is doing as `phase`, and how each join ended as a
 * `ZoomJoinOutcome`. What the room does about an outcome is
 * `LiveSessionFacade`'s call, not this file's.
 *
 * Route-scoped — provided on `/live`, destroyed with it.
 */
@Service({ autoProvided: false })
export class ZoomMeetingClient {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly phase = signal<JoinPhase>('idle');

  /**
   * Fired when Zoom itself ends the connection — the host ended the webinar
   * (`meeting-ended`), or the connection failed (`connection-lost`). Never for
   * our own `leave()`: that is the learner's action, not news.
   */
  onConnectionClosed: ((reason: ZoomCloseReason) => void) | null = null;

  private client: ZoomEmbeddedClient | null = null;
  private destroyClient: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => void this.leave());
  }

  /**
   * Boot the SDK into `root` and join the webinar.
   *
   * `root` must be an element that Tailwind's preflight does not reach into:
   * the SDK injects its own stylesheet, and resets applied inside the container
   * fight it.
   *
   * Never throws. A rejection comes back as the outcome its `errorCode` maps to,
   * with the SDK already torn down, so the next call starts clean.
   */
  async join(root: HTMLElement, params: ZoomJoinParams): Promise<ZoomJoinOutcome> {
    if (!this.isBrowser) return 'failed';

    // The Component View client is a singleton: a second `init()` on the one a
    // failed or abandoned join left behind is refused as a duplicate operation.
    this.teardown();
    this.phase.set('joining');

    try {
      // Everything about the SDK stays behind this boundary.
      const { default: ZoomMtgEmbedded } = await import('@zoom/meetingsdk/embedded');
      const client = ZoomMtgEmbedded.createClient();
      this.client = client;
      this.destroyClient = () => ZoomMtgEmbedded.destroyClient();

      assertExecuted(
        await client.init({
          zoomAppRoot: root,
          language: 'en-US',
          // Pull Zoom's media hot-fix branch rather than pinning to whatever
          // shipped with this SDK version — the media layer is where their
          // browser-compatibility fixes land between releases.
          patchJsMedia: true,
          // Second exit path. Our own `pagehide` handler releases the lease; this
          // makes Zoom itself drop the participant, so the webhook sees a clean
          // leave rather than a timeout.
          leaveOnPageUnload: true,
        }),
      );

      this.wireEvents(client);

      assertExecuted(
        await client.join({
          signature: params.signature,
          // No `sdkKey`: the SDK dropped it from join options in v4 and reads it
          // from the signature.
          meetingNumber: params.meetingNumber,
          // Empty string is correct when the session only gates on the waiting
          // room — it must still be passed.
          password: params.password,
          userName: params.userName,
          // REQUIRED for webinars, unlike meetings.
          userEmail: params.userEmail,
          // REQUIRED whenever the webinar requires registration. This is the `tk`
          // from the registrant's own join URL; without it Zoom refuses the join.
          tk: params.tk,
        }),
      );

      // A resolved join is not "attending": the learner may be in the waiting
      // room. Read it now, not only on the next `user-updated` — the host can
      // admit them before the SDK has finished drawing the waiting room, and
      // that event is then already gone.
      this.syncHold(client);
      return 'joined';
    } catch (err) {
      const code = errorCodeOf(err);
      const outcome = (code !== null && ZOOM_ERROR_OUTCOMES[code]) || 'failed';
      // An outcome the table names is an answer; only the unmapped ones are faults.
      if (outcome === 'failed') this.logger.error('[ZoomMeetingClient] join failed', code, err);
      else this.logger.warn('[ZoomMeetingClient] join refused', code, outcome);

      this.teardown();
      this.phase.set('failed');
      return outcome;
    }
  }

  /** Leave and tear the SDK down. Safe to call when never joined. */
  async leave(): Promise<void> {
    // Cleared FIRST: the event handlers ignore a client that is no longer
    // current, so our own leave is never reported as the host ending the webinar.
    const client = this.client;
    this.client = null;

    if (client && isInRoom(this.phase())) {
      try {
        await client.leaveMeeting();
      } catch (err) {
        // A failed leave is not actionable — the page is going away and Zoom
        // will time the participant out. Losing the teardown below would be
        // worse, so swallow and continue.
        this.logger.warn('[ZoomMeetingClient] leave failed', err);
      }
    }

    this.teardown();
    if (isInRoom(this.phase()) || this.phase() === 'joining') this.phase.set('left');
  }

  /** Mark this surface ejected by the session lock, then tear the SDK down. */
  async evict(): Promise<void> {
    await this.leave();
    this.phase.set('ejected');
  }

  /** Destroy the SDK client, if there is one. Leaves `phase` to the caller. */
  private teardown(): void {
    this.client = null;
    try {
      this.destroyClient?.();
    } catch (err) {
      this.logger.warn('[ZoomMeetingClient] destroyClient failed', err);
    }
    this.destroyClient = null;
  }

  private wireEvents(client: ZoomEmbeddedClient): void {
    client.on('connection-change', (payload: unknown) => {
      if (this.client !== client) return;
      const { state, reason } = readConnectionChange(payload);

      if (state === 'Reconnecting') {
        if (isInRoom(this.phase())) this.phase.set('reconnecting');
        return;
      }
      if (state === 'Connected') {
        if (this.phase() === 'reconnecting') this.syncHold(client);
        return;
      }
      if (state !== 'Closed' && state !== 'Fail') return;

      // Zoom ended it, not the learner: `Closed` is the host ending (or
      // removing us from) the webinar, which is final; `Fail` is a dropped
      // connection, which the learner can rejoin.
      this.logger.warn('[ZoomMeetingClient] connection closed', state, reason);
      if (isInRoom(this.phase())) this.phase.set('left');
      this.onConnectionClosed?.(state === 'Closed' ? 'meeting-ended' : 'connection-lost');
    });

    // Admission out of the waiting room (and being put back into it) arrives as
    // an update to our own participant. Joining the room proper can also report
    // us as added, so both re-read the one flag that decides it.
    const onParticipantChange = () => {
      if (this.client !== client) return;
      if (this.phase() === 'on-hold' || this.phase() === 'in-meeting') this.syncHold(client);
    };
    client.on('user-updated', onParticipantChange);
    client.on('user-added', onParticipantChange);
  }

  /** `on-hold` while Zoom holds us in the waiting room, otherwise `in-meeting`. */
  private syncHold(client: ZoomEmbeddedClient): void {
    this.phase.set(client.getCurrentUser()?.isHold ? 'on-hold' : 'in-meeting');
  }
}

/** Zoom has accepted the join: waiting to be admitted, attending, or reconnecting. */
function isInRoom(phase: JoinPhase): boolean {
  return phase === 'on-hold' || phase === 'in-meeting' || phase === 'reconnecting';
}

/**
 * The SDK types `init`/`join` as RESOLVING to `string | { type, reason }`, and
 * in practice rejects on failure. Treat a resolved failure object the same as a
 * rejection, so neither path reports a failed join as `in-meeting`. The object
 * itself is thrown so an `errorCode` on it survives to `errorCodeOf`.
 */
function assertExecuted(result: unknown): void {
  if (isObject(result) && isStr(result['type']) && isStr(result['reason'])) {
    throw result;
  }
}

/** Zoom rejects with its own `{ type, reason, errorCode }` rather than an `Error`. */
function errorCodeOf(err: unknown): number | null {
  return isObject(err) && isNum(err['errorCode']) ? err['errorCode'] : null;
}

/** Read the SDK's `any`-typed `connection-change` payload field by field. */
function readConnectionChange(payload: unknown): ConnectionChangePayload {
  if (!isObject(payload)) return {};
  return {
    state: isStr(payload['state']) ? payload['state'] : undefined,
    reason: isStr(payload['reason']) ? payload['reason'] : undefined,
  };
}

/**
 * Build the SDK join parameters from a signature response. `user_name` can be
 * empty (`get_full_name()` of a learner with no name on file) and Zoom refuses
 * an empty `userName`, so fall back to the email's local part.
 */
export function toJoinParams(signature: SignatureResponse): ZoomJoinParams {
  return {
    signature: signature.signature,
    meetingNumber: signature.meeting_number,
    password: signature.password,
    userName: signature.user_name || signature.user_email.split('@')[0] || 'Learner',
    userEmail: signature.user_email,
    tk: signature.registrant_token ?? '',
  };
}
