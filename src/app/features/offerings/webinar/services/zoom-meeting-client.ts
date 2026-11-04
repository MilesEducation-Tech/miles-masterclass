import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, DestroyRef, inject, Service, PLATFORM_ID, signal } from '@angular/core';
import { Logger } from '@core/services/logger/logger';
import { isNum, isObject, isStr } from '@core/utils/contract-guards';
import {
  ZOOM_ERROR_OUTCOMES,
  ZOOM_LEAVE_REASONS,
  ZOOM_MEETING_STATUS,
} from '@features/offerings/webinar/constants/live-session';
import {
  JoinPhase,
  SignatureResponse,
  ZoomClientView,
  ZoomClientViewInit,
  ZoomExit,
  ZoomJoinOutcome,
  ZoomJoinParams,
} from '@features/offerings/webinar/models/meeting-session.model';

/**
 * Thin wrapper around the Zoom Meeting SDK's Client View.
 *
 * Client View, not Component View: it is Zoom's full-page web client, so the
 * meeting fills the screen on phones, tablets and desktops, screen share
 * included, with polls, Q&A and chat built in. Component View cannot: it
 * ignores any size we give it while a share is on screen, keeps a fixed aspect
 * ratio, and Zoom documents it as desktop-only.
 *
 * Four constraints shape this file:
 *
 * 1. **The SDK is imported dynamically, inside `join()`.** `@zoom/meetingsdk`
 *    is many megabytes and this app's production initial-bundle budget is
 *    2.00 MB, already close to full. A static import would put Zoom in `main`
 *    and fail `build:prod` — which is the correct outcome, so do not "fix" that
 *    by raising the budget. The SDK's TYPES are imported with `import type` in
 *    the model, which the build erases.
 *
 * 2. **Browser only.** The SDK touches `window`, `document` and WebAssembly at
 *    module scope. The `/live` route is registered as `RenderMode.Client` so
 *    this never runs during SSR, and the platform guard below is the backstop.
 *
 * 3. **One SDK per document.** Client View has no destroy: it is imported and
 *    initialised once, and retries a refused join in place, but cannot join
 *    again once it has been in a meeting (`spent`). It draws into its own
 *    body-level `#zmmtg-root` and injects global CSS, both confined to the
 *    `/live` document by `live-document-guard`. The root is shown only while
 *    Zoom is joining or joined, so the room's own screens are never hidden
 *    under an empty one.
 *
 * 4. **Zoneless is an advantage here.** Zoom's own Angular guidance is to run
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
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly phase = signal<JoinPhase>('idle');

  /**
   * Fired when Zoom itself ends our participant: the host ended the webinar,
   * removed this learner, the connection failed, or the learner pressed Zoom's
   * own Leave. Never for our own `leave()`: that is the room's action, not news.
   */
  onConnectionClosed: ((exit: ZoomExit) => void) | null = null;

  /** Client View, imported and initialised once; `null` until the first join, or after a failed boot. */
  private sdk: Promise<ZoomClientView> | null = null;
  /** Zoom holds this learner in the waiting room. */
  private held = false;
  /**
   * Zoom has joined once in this document. Client View cannot join again after
   * it has been in a meeting: a second `join` stalls on Zoom's "Webinar
   * Disconnected" page and never calls back. A later join needs a fresh page.
   */
  private joinedOnce = false;

  /** A further join here would stall; the room must reload to join again. */
  get spent(): boolean {
    return this.joinedOnce;
  }

  constructor() {
    this.destroyRef.onDestroy(() => void this.leave());
  }

  /**
   * Boot the SDK if it is not up yet, and join the webinar.
   *
   * `leaveUrl` is where Zoom goes if it ever ignores `leaveRedirect: false`:
   * the webinar's own page, never this room (a reload would join again).
   *
   * Never throws. A refusal comes back as the outcome its `errorCode` maps to,
   * with Zoom's root hidden again, so the next call starts clean.
   */
  async join(params: ZoomJoinParams, leaveUrl: string): Promise<ZoomJoinOutcome> {
    if (!this.isBrowser) return 'failed';
    this.phase.set('joining');
    this.held = false;

    try {
      const zoom = await this.boot(leaveUrl);
      this.showZoom(true);
      await viaCallbacks((callbacks) =>
        zoom.join({
          signature: params.signature,
          // No `sdkKey`: the SDK reads it from the signature.
          meetingNumber: params.meetingNumber,
          // Empty string is correct when the session only gates on the waiting
          // room — it must still be passed. Client View spells it `passWord`.
          passWord: params.password,
          userName: params.userName,
          // REQUIRED for webinars, unlike meetings.
          userEmail: params.userEmail,
          // REQUIRED whenever the webinar requires registration. This is the `tk`
          // from the registrant's own join URL; without it Zoom refuses the join.
          tk: params.tk,
          ...callbacks,
        }),
      );

      this.joinedOnce = true;
      // A resolved join is not "attending": the learner may be in the waiting
      // room, and the event saying so can arrive before the join resolves.
      this.syncHold();
      return 'joined';
    } catch (err) {
      const code = errorCodeOf(err);
      const outcome = (code !== null && ZOOM_ERROR_OUTCOMES[code]) || 'failed';
      // An outcome the table names is an answer; only the unmapped ones are faults.
      if (outcome === 'failed') this.logger.error('[ZoomMeetingClient] join failed', code, err);
      else this.logger.warn('[ZoomMeetingClient] join refused', code, outcome);

      this.showZoom(false);
      this.phase.set('failed');
      return outcome;
    }
  }

  /** Leave the meeting and hide Zoom. Safe to call when never joined. */
  async leave(): Promise<void> {
    const wasInRoom = isInRoom(this.phase());
    // Set FIRST: the event handlers ignore a surface that is no longer in the
    // room, so our own leave is never reported as the host ending the webinar.
    if (wasInRoom || this.phase() === 'joining') this.phase.set('left');

    if (wasInRoom && this.sdk) {
      try {
        const zoom = await this.sdk;
        await viaCallbacks((callbacks) => zoom.leaveMeeting(callbacks));
      } catch (err) {
        // A failed leave is not actionable — the page is going away and Zoom
        // will time the participant out. Hiding the root below matters more,
        // so swallow and continue.
        this.logger.warn('[ZoomMeetingClient] leave failed', err);
      }
    }

    this.showZoom(false);
  }

  /** Mark this surface ejected by the session lock, then leave. */
  async evict(): Promise<void> {
    await this.leave();
    this.phase.set('ejected');
  }

  /**
   * Import, prepare and initialise Client View, once. A failed boot is dropped
   * so the next join imports again instead of replaying the failure.
   */
  private boot(leaveUrl: string): Promise<ZoomClientView> {
    this.sdk ??= (async () => {
      // Everything about the SDK stays behind this boundary.
      const { ZoomMtg } = await import('@zoom/meetingsdk');
      ZoomMtg.preLoadWasm();
      ZoomMtg.prepareWebSDK();
      await viaCallbacks((callbacks) => {
        const options: ZoomClientViewInit = {
          leaveUrl,
          // Stay on the page when the learner leaves, so the room can say why
          // (and give the lease back) instead of Zoom jumping to `leaveUrl`.
          leaveRedirect: false,
          // Attendees watch; the camera and microphone check is in the way.
          disablePreview: true,
          // The room's own refusal screens explain a failed join.
          isShowJoiningErrorDialog: false,
          // The meeting fills the screen and stays put: no video tile dragged
          // around over the slides, and a share always scaled to the screen,
          // never Zoom's "original size" view, which can leave it smaller.
          videoDrag: false,
          sharingMode: 'fit',
          // Pull Zoom's media hot-fix branch rather than pinning to whatever
          // shipped with this SDK version — the media layer is where their
          // browser-compatibility fixes land between releases.
          patchJsMedia: true,
          // Second exit path. Our own `pagehide` handler releases the lease; this
          // makes Zoom itself drop the participant, so the webhook sees a clean
          // leave rather than a timeout.
          leaveOnPageUnload: true,
          ...callbacks,
        };
        ZoomMtg.init(options);
      });
      this.wireEvents(ZoomMtg);
      return ZoomMtg;
    })();

    return this.sdk.catch((err: unknown) => {
      this.sdk = null;
      throw err;
    });
  }

  private wireEvents(zoom: ZoomClientView): void {
    // The exit signal. SDK 6.10 always delivers `onUserLeave`, but in a webinar
    // it stops delivering `onMeetingStatus` once it has stored a hold state
    // (it saves the boolean as a string, and "false" is truthy). Our own
    // participant leaving carries a `reason`; another participant's leave
    // carries their attendee data instead.
    zoom.inMeetingServiceListener('onUserLeave', (data: unknown) => {
      if (!isObject(data) || !isStr(data['reason'])) return;
      this.closedByZoom(isNum(data['reasonCode']) ? data['reasonCode'] : null);
    });

    // Reconnecting, and a disconnect that came without a leave (a dropped
    // connection), wherever Zoom still delivers it.
    zoom.inMeetingServiceListener('onMeetingStatus', (data: unknown) => {
      const status = isObject(data) && isNum(data['meetingStatus']) ? data['meetingStatus'] : null;
      if (status === ZOOM_MEETING_STATUS.reconnecting) {
        if (isInRoom(this.phase())) this.phase.set('reconnecting');
      } else if (status === ZOOM_MEETING_STATUS.connected) {
        if (this.phase() === 'reconnecting') this.syncHold();
      } else if (status === ZOOM_MEETING_STATUS.disconnected) {
        this.closedByZoom(null);
      }
    });

    // Admission out of the waiting room (and being put back into it). SDK 6.10
    // delivers this for meetings only; in a webinar Zoom draws its own waiting
    // screens and this never fires, so the room simply stays `in-meeting`.
    zoom.inMeetingServiceListener('onUserIsInWaitingRoom', (data: unknown) => {
      if (!isObject(data) || data['self'] !== true) return;
      this.held = data['isInWaitingRoom'] === true;
      if (this.phase() === 'on-hold' || this.phase() === 'in-meeting') this.syncHold();
    });
  }

  /**
   * Zoom ended our participant, with the leave's `reasonCode` when it gave one.
   * It is news only from the room, or from a pending join our participant
   * explicitly left (Zoom's waiting screens have a Leave of their own). Anything
   * else is our own `leave()`, a failed join that `join()` already reports, or
   * the status that follows a leave already handled.
   */
  private closedByZoom(code: number | null): void {
    if (!isInRoom(this.phase()) && !(this.phase() === 'joining' && code !== null)) return;

    const exit = (code !== null && ZOOM_LEAVE_REASONS[code]) || 'connection-lost';
    this.logger.warn('[ZoomMeetingClient] disconnected', code, exit);
    this.showZoom(false);
    this.phase.set('left');
    this.onConnectionClosed?.(exit);
  }

  /** `on-hold` while Zoom holds us in the waiting room, otherwise `in-meeting`. */
  private syncHold(): void {
    this.phase.set(this.held ? 'on-hold' : 'in-meeting');
  }

  /**
   * Show or hide Client View: its body-level root, and the body-level portals it
   * draws its dialogs in (the rule in `styles.css`). A dialog Zoom opens after
   * the room took over the screen stays hidden too.
   */
  private showZoom(visible: boolean): void {
    const root = this.document.getElementById('zmmtg-root');
    if (root) root.style.display = visible ? 'block' : 'none';
    this.document.body.toggleAttribute('data-zoom-hidden', !visible);
  }
}

/** Zoom has accepted the join: waiting to be admitted, attending, or reconnecting. */
function isInRoom(phase: JoinPhase): boolean {
  return phase === 'on-hold' || phase === 'in-meeting' || phase === 'reconnecting';
}

/** Client View answers through `success` / `error` callbacks; this turns one call into a promise. */
function viaCallbacks(
  call: (callbacks: { success: (res: unknown) => void; error: (err: unknown) => void }) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => call({ success: resolve, error: reject }));
}

/** Zoom fails with its own `{ method, status, errorCode, errorMessage }` rather than an `Error`. */
function errorCodeOf(err: unknown): number | null {
  return isObject(err) && isNum(err['errorCode']) ? err['errorCode'] : null;
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
