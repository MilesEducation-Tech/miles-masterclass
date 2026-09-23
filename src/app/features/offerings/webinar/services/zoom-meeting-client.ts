import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Service, PLATFORM_ID, signal } from '@angular/core';
import { Logger } from '@core/services/logger/logger';
import { JoinPhase, SignatureResponse, ZoomJoinParams } from '../models/meeting-session.model';
import { WebinarError } from '../utils/webinar-error';

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
 *    `import('@supabase/supabase-js')` in `@core/services/supabase`.
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
 * Route-scoped — provided on `/live`, destroyed with it.
 */

/**
 * The slice of the SDK surface this app uses.
 *
 * Declared locally rather than imported as a type so the SDK's types are not
 * pulled into the graph of every file that references a phase — the whole point
 * of the dynamic import is that nothing static reaches into the package.
 */
interface ZoomEmbeddedClient {
  init(options: Record<string, unknown>): Promise<void>;
  join(options: Record<string, unknown>): Promise<void>;
  leave(): Promise<void>;
  on(event: string, callback: (payload: unknown) => void): void;
  off?(event: string, callback: (payload: unknown) => void): void;
}

interface ConnectionChangePayload {
  state?: string;
  reason?: string;
}

@Service({ autoProvided: false })
export class ZoomMeetingClient {
  private readonly logger = inject(Logger);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly phase = signal<JoinPhase>('idle');
  readonly error = signal<WebinarError | null>(null);

  /**
   * Fired when Zoom itself ends the connection — the host ended the webinar, or
   * the socket dropped. Distinct from the learner pressing Leave.
   */
  onConnectionClosed: ((reason: string) => void) | null = null;

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
   */
  async join(root: HTMLElement, params: ZoomJoinParams): Promise<void> {
    if (!this.isBrowser) return;

    this.phase.set('joining');
    this.error.set(null);

    try {
      // Everything about the SDK stays behind this boundary.
      const { default: ZoomMtgEmbedded } = await import('@zoom/meetingsdk/embedded');
      const client = ZoomMtgEmbedded.createClient() as unknown as ZoomEmbeddedClient;
      this.client = client;
      this.destroyClient = () => ZoomMtgEmbedded.destroyClient();

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
      });

      this.wireEvents(client);

      await client.join({
        signature: params.signature,
        sdkKey: params.sdkKey,
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
      });

      this.phase.set('in-meeting');
    } catch (err) {
      this.phase.set('failed');
      this.error.set(this.toSdkError(err));
      this.logger.error('[ZoomMeetingClient] join failed', err);
    }
  }

  /** Leave and tear the SDK down. Safe to call when never joined. */
  async leave(): Promise<void> {
    const client = this.client;
    this.client = null;

    if (client) {
      try {
        await client.leave();
      } catch (err) {
        // A failed leave is not actionable — the page is going away and Zoom
        // will time the participant out. Losing the teardown below would be
        // worse, so swallow and continue.
        this.logger.warn('[ZoomMeetingClient] leave failed', err);
      }
    }

    try {
      this.destroyClient?.();
    } catch (err) {
      this.logger.warn('[ZoomMeetingClient] destroyClient failed', err);
    }
    this.destroyClient = null;

    if (this.phase() === 'in-meeting' || this.phase() === 'joining') this.phase.set('left');
  }

  /** Mark this surface ejected by the session lock, then tear the SDK down. */
  async evict(): Promise<void> {
    await this.leave();
    this.phase.set('ejected');
  }

  private wireEvents(client: ZoomEmbeddedClient): void {
    client.on('connection-change', (payload: unknown) => {
      const state = (payload as ConnectionChangePayload)?.state;
      if (state === 'Closed' || state === 'Fail') {
        const reason = (payload as ConnectionChangePayload)?.reason ?? 'closed';
        // Zoom ended it, not the learner. The page decides whether that means
        // "the webinar finished" or "you dropped".
        if (this.phase() === 'in-meeting') this.phase.set('left');
        this.onConnectionClosed?.(reason);
      }
    });
  }

  /**
   * Zoom rejects with its own `{ type, reason, errorCode }` rather than an
   * `Error`, so map it into the shape the rest of the module renders.
   */
  private toSdkError(err: unknown): WebinarError {
    const zoom = err as { reason?: string; errorCode?: number; message?: string } | null;
    return {
      code: 'zoom_join_failed',
      message:
        zoom?.reason ??
        zoom?.message ??
        'We could not connect you to the session. Please try again.',
      status: typeof zoom?.errorCode === 'number' ? zoom.errorCode : null,
      isProfileProblem: false,
      isRetryable: true,
    };
  }
}

/** Build the SDK join parameters from a signature response. */
export function toJoinParams(signature: SignatureResponse): ZoomJoinParams {
  return {
    signature: signature.signature,
    sdkKey: signature.sdk_key,
    meetingNumber: signature.meeting_number,
    password: signature.password ?? '',
    userName: signature.user_name,
    userEmail: signature.user_email,
    tk: signature.registrant_token ?? '',
  };
}
