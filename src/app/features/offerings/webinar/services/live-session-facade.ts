import { isPlatformBrowser } from '@angular/common';
import { computed, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { PRIMARY_OUTLET, Router, UrlTree } from '@angular/router';
import { Viewport } from '@core/services/viewport/viewport';
import { JOIN_REFUSAL_KINDS } from '@features/offerings/webinar/constants/live-session';
import {
  EjectionReason,
  JoinRefusal,
  ZoomCloseReason,
} from '@features/offerings/webinar/models/meeting-session.model';
import { FeedCard, registrationOf } from '@features/offerings/webinar/models/webinar.model';
import { MeetingSession } from '@features/offerings/webinar/services/meeting-session';
import { WebinarFacade } from '@features/offerings/webinar/services/webinar-facade';
import {
  toJoinParams,
  ZoomMeetingClient,
} from '@features/offerings/webinar/services/zoom-meeting-client';
import { toWebinarError, WebinarError } from '@features/offerings/webinar/utils/webinar-error';

/**
 * The live room: claims the session, joins Zoom, and decides what the room shows.
 *
 * The join sequence is deliberately ordered cheapest-refusal-first:
 *
 *   local Web Lock  →  server lease  →  Zoom signature  →  import SDK  →  join
 *
 * A second tab in the same browser is turned away at step one, with no network
 * request and without downloading several megabytes of SDK. A second *browser*
 * is turned away at step two. Only a surface that genuinely owns the session
 * ever reaches the import.
 *
 * Every way the sequence can end is a state the page renders: `exit`
 * (ejected, ended, disconnected), `conflict`, `refusal`, the mobile hand-off,
 * or the stage. None of them is a spinner that never stops.
 *
 * Route-scoped on `:id/live`, next to `MeetingSession` and `ZoomMeetingClient`,
 * so all three live exactly as long as the room. The page and `MeetingStage`
 * inject it; neither relays its state.
 */
@Service({ autoProvided: false })
export class LiveSessionFacade {
  private readonly webinars = inject(WebinarFacade);
  private readonly session = inject(MeetingSession);
  private readonly zoom = inject(ZoomMeetingClient);
  private readonly router = inject(Router);
  private readonly viewport = inject(Viewport);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly webinarId = signal<string | null>(null);
  /** Set when Zoom itself closed the connection; cleared by the next join. */
  private readonly closed = signal<ZoomCloseReason | null>(null);
  /** The element the SDK renders into, registered by `MeetingStage` once it renders. */
  private stageRoot: HTMLElement | null = null;

  /**
   * The webinar this room is for. Reactive, because on a reload or a deep link
   * neither the feed nor the detail row has landed when the room opens: the
   * title and the mobile join link fill in as soon as either does.
   */
  readonly webinar = computed<FeedCard | null>(() => {
    const id = this.webinarId();
    if (!id) return null;
    return this.webinars.findById(id) ?? this.webinars.detailWebinar();
  });

  readonly isPreparing = signal(false);
  /** Why the server would not let the learner in; `null` while joining or joined. */
  readonly refusal = signal<JoinRefusal | null>(null);

  readonly title = computed(() => this.webinar()?.name ?? 'Webinar');

  /**
   * Zoom states Component View is designed for desktop browsers, not mobile.
   * On anything handheld we do not embed — we hand the learner their own Zoom
   * link instead. The lease is still claimed first, so the one-session rule
   * holds on mobile too, and Zoom's webhook still records attendance, so CPE is
   * unaffected. Phase 3 replaces this branch with Client View.
   */
  readonly isMobile = computed(() => this.viewport.isHandheld());

  /** Mobile fallback: the learner's own Zoom join URL. */
  readonly mobileJoinUrl = computed(() => registrationOf(this.webinar())?.join_url ?? null);

  readonly conflict = this.session.conflict.asReadonly();
  readonly zoomError = this.zoom.error.asReadonly();

  /** Why this room is no longer live, from whichever layer noticed first. */
  readonly exit = computed<EjectionReason | null>(() => this.session.ejection() ?? this.closed());

  readonly statusText = computed(() => {
    switch (this.zoom.phase()) {
      case 'preflight':
        return 'Checking your seat…';
      case 'joining':
        return 'Joining the session…';
      case 'in-meeting':
        return 'You are in the session.';
      case 'left':
        return 'You have left the session.';
      default:
        return null;
    }
  });

  constructor() {
    // Tear the SDK down the moment the lease is lost, from whichever layer
    // noticed: a sibling tab taking over, the server superseding us, or a
    // bfcache restore after the tab-close beacon gave the lease back.
    this.session.onEvict = () => {
      void this.zoom.evict();
      this.isPreparing.set(false);
    };

    // Zoom ended the connection itself. Give the lease back either way: after
    // the host ends the webinar nothing is left to hold, and after a dropped
    // connection the learner may well rejoin from another device.
    this.zoom.onConnectionClosed = (reason: ZoomCloseReason) => {
      void this.session.release();
      this.closed.set(reason);
    };
  }

  /** Enter the room for one webinar. Browser only: `/live` is never server-rendered. */
  open(webinarId: string): void {
    if (!this.isBrowser || !webinarId) return;
    this.webinarId.set(webinarId);
    // Not in the feed (a deep link before it lands, or a webinar outside its
    // buckets): ask the details endpoint, which `webinar` falls back to.
    if (!this.webinars.findById(webinarId)) this.webinars.showDetail(webinarId);
    void this.start(false);
  }

  /**
   * The learner confirmed the takeover in the conflict dialog. Only ever on
   * that click — a silent takeover would let a stray background tab eject the
   * session someone is actually watching.
   */
  takeover(): void {
    void this.start(true);
  }

  /** Join again without taking over: after a refusal, a failed join or a dropped connection. */
  retry(): void {
    void this.start(false);
  }

  /** The learner pressed Leave: give everything back, then return to the webinar. */
  async leave(): Promise<void> {
    await this.zoom.leave();
    await this.session.release();
    this.backToWebinar();
  }

  /** `:id/live` → `:id`, the webinar's own page. */
  backToWebinar(): void {
    void this.router.navigateByUrl(this.urlUp(1));
  }

  /** `:id/live` → the webinar list. */
  allWebinars(): void {
    void this.router.navigateByUrl(this.urlUp(2));
  }

  /** The session token expired mid-join: sign in, then come straight back here. */
  signIn(): void {
    void this.router.navigate(['/auth/login'], { queryParams: { redirect: this.router.url } });
  }

  /** Called by `MeetingStage` once its SDK container is in the DOM. */
  attachStage(root: HTMLElement): void {
    this.stageRoot = root;
  }

  /** Called by `MeetingStage` on destroy; ignores a stage that was already replaced. */
  detachStage(root: HTMLElement): void {
    if (this.stageRoot === root) this.stageRoot = null;
  }

  /**
   * Claim the session and join, or land in the state that explains why not.
   * Never throws: it runs from template events and an effect, where a
   * rejection would be unhandled and the room would sit on "Checking your
   * seat…" forever.
   */
  private async start(takeover: boolean): Promise<void> {
    const webinarId = this.webinarId();
    if (!webinarId) return;

    this.closed.set(null);
    this.refusal.set(null);
    this.isPreparing.set(true);
    this.zoom.phase.set('preflight');

    try {
      const signature = await this.session.acquire(webinarId, takeover);
      // `null` means the lock refused us; `conflict` already carries the reason
      // and the template renders it. Nothing was downloaded, nothing to undo.
      if (!signature) {
        this.zoom.phase.set('idle');
        return;
      }

      if (this.isMobile()) {
        // Hold the lease but do not embed — see `isMobile`.
        this.zoom.phase.set('idle');
        return;
      }

      const root = this.stageRoot;
      if (!root) {
        // The stage is not on screen, so there is nowhere to join into. Give
        // the lease back rather than hold a session nobody can see.
        await this.session.release();
        this.zoom.phase.set('idle');
        this.refusal.set({ kind: 'failed', message: null, opensAt: null });
        return;
      }

      await this.zoom.join(root, toJoinParams(signature));
    } catch (err) {
      // `acquire` has already given back any lease it took and logged the cause.
      this.zoom.phase.set('idle');
      this.refusal.set(toRefusal(toWebinarError(err)));
    } finally {
      this.isPreparing.set(false);
    }
  }

  /**
   * The current URL with its last `levels` path segments dropped. The facade is
   * provided on the route, not the component, so it has no `ActivatedRoute` to
   * navigate relative to.
   */
  private urlUp(levels: number): UrlTree {
    const segments = this.router.parseUrl(this.router.url).root.children[PRIMARY_OUTLET]?.segments;
    return this.router.createUrlTree((segments ?? []).slice(0, -levels).map((s) => s.path));
  }
}

/**
 * The room a refusal lands in. The server's `detail` is user-facing copy for
 * the codes the contract names; anything else (network, 5xx, a broken
 * response) gets the room's generic copy, never an internal message.
 */
function toRefusal(error: WebinarError): JoinRefusal {
  const kind = JOIN_REFUSAL_KINDS[error.code] ?? 'failed';
  return {
    kind,
    message: kind === 'failed' ? null : error.message,
    opensAt: error.joinOpensAt ?? null,
  };
}
