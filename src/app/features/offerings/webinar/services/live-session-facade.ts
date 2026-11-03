import { isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, PLATFORM_ID, Service, signal } from '@angular/core';
import { PRIMARY_OUTLET, Router, UrlTree } from '@angular/router';
import {
  JOIN_REFUSAL_KINDS,
  WAITING_FOR_HOST_RETRY_MS,
  ZOOM_REFUSALS,
} from '@features/offerings/webinar/constants/live-session';
import {
  EjectionReason,
  JoinRefusal,
  ZoomCloseReason,
  ZoomExit,
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
 * Zoom runs as Client View, its full-page web client, on every device: phones
 * included, since Client View is Zoom's supported mobile path.
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
 * (ejected, ended, removed, disconnected), `conflict`, `refusal`, or the stage
 * — which itself says whether the learner is waiting for the host to start or
 * being connected, until Zoom's own page covers it. None of them is a spinner
 * that never stops.
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly webinarId = signal<string | null>(null);
  /** Set when Zoom itself closed the connection; cleared by the next join. */
  private readonly closed = signal<ZoomCloseReason | null>(null);
  /** The next try at Zoom while the host has not started the webinar. */
  private rejoinTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Bumped by `stopWaiting()`. An attempt that sees a different value after an
   * await was abandoned (the learner left, was evicted, or started over) and
   * must not go on to join Zoom.
   */
  private run = 0;

  /**
   * The webinar this room is for. Reactive, because on a reload or a deep link
   * neither the feed nor the detail row has landed when the room opens: the
   * title and the Zoom app link fill in as soon as either does.
   */
  readonly webinar = computed<FeedCard | null>(() => {
    const id = this.webinarId();
    if (!id) return null;
    return this.webinars.findById(id) ?? this.webinars.detailWebinar();
  });

  readonly isPreparing = signal(false);
  /**
   * Zoom refused the join because the host has not started the webinar (or is
   * still in its practice session). The room holds the lease and tries again
   * every `WAITING_FOR_HOST_RETRY_MS` until the host starts.
   */
  readonly waitingForHost = signal(false);
  /** Why the server would not let the learner in; `null` while joining or joined. */
  readonly refusal = signal<JoinRefusal | null>(null);

  readonly title = computed(() => this.webinar()?.name ?? 'Webinar');
  /** The scheduled start, for the waiting-for-host copy. */
  readonly startsAt = computed(() => this.webinar()?.start_date_time ?? null);

  /** The learner's own Zoom join URL, for a webinar that refuses browser joins. */
  readonly mobileJoinUrl = computed(() => registrationOf(this.webinar())?.join_url ?? null);

  readonly conflict = this.session.conflict.asReadonly();

  /** Why this room is no longer live, from whichever layer noticed first. */
  readonly exit = computed<EjectionReason | null>(() => this.session.ejection() ?? this.closed());

  readonly statusText = computed(() => {
    if (this.waitingForHost()) return 'Waiting for the host to start the webinar…';
    switch (this.zoom.phase()) {
      case 'preflight':
        return 'Checking your seat…';
      case 'joining':
        return 'Joining the session…';
      case 'on-hold':
        return 'Waiting for the host to let you in…';
      case 'in-meeting':
        return 'You are in the session.';
      case 'reconnecting':
        return 'Reconnecting…';
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
      this.stopWaiting();
      void this.zoom.evict();
      this.isPreparing.set(false);
    };

    // Zoom ended the connection itself. Give the lease back either way: after
    // the host ends the webinar nothing is left to hold, and after a dropped
    // connection the learner may well rejoin from another device. Zoom's own
    // Leave button is the learner leaving, same as ours.
    this.zoom.onConnectionClosed = (exit: ZoomExit) => {
      if (exit === 'left') {
        void this.leave();
        return;
      }
      void this.session.release();
      this.closed.set(exit);
    };

    this.destroyRef.onDestroy(() => this.stopWaiting());
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
    this.stopWaiting();
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

  /**
   * Claim the session and join, or land in the state that explains why not.
   * Never throws: it runs from template events and an effect, where a
   * rejection would be unhandled and the room would sit on "Checking your
   * seat…" forever.
   */
  private async start(takeover: boolean): Promise<void> {
    const webinarId = this.webinarId();
    if (!webinarId) return;

    this.stopWaiting();
    const run = this.run;
    this.closed.set(null);
    this.refusal.set(null);
    this.isPreparing.set(true);
    this.zoom.phase.set('preflight');

    try {
      await this.attempt(webinarId, takeover, run);
    } catch (err) {
      // `acquire` has already given back any lease it took and logged the cause.
      this.zoom.phase.set('idle');
      this.refusal.set(toRefusal(toWebinarError(err)));
    } finally {
      this.isPreparing.set(false);
    }
  }

  /**
   * One claim → sign → join pass, and what the room does with how Zoom answered.
   * Throws only what `acquire` throws (a server refusal or a network failure).
   *
   * `canRemint` allows one fresh signature after Zoom refuses one as expired or
   * invalid; a second refusal is a fault, not an expiry.
   */
  private async attempt(
    webinarId: string,
    takeover: boolean,
    run: number,
    canRemint = true,
  ): Promise<void> {
    const signature = await this.session.acquire(webinarId, takeover);
    if (run !== this.run) return;
    // `null` means the lock refused us; `conflict` already carries the reason
    // and the template renders it. Nothing was downloaded, nothing to undo.
    if (!signature) {
      this.waitingForHost.set(false);
      this.zoom.phase.set('idle');
      return;
    }

    const outcome = await this.zoom.join(toJoinParams(signature), this.webinarPageUrl());
    if (run !== this.run) return;
    this.waitingForHost.set(outcome === 'not-started');

    switch (outcome) {
      case 'joined':
        return;
      case 'not-started':
        this.scheduleRejoin(webinarId, run);
        return;
      case 'bad-signature':
        if (canRemint) return this.attempt(webinarId, false, run, false);
        break;
      case 'meeting-ended':
      case 'removed':
        await this.session.release();
        this.closed.set(outcome);
        return;
      case 'full':
      case 'not-registered':
      case 'web-unsupported':
        await this.session.release();
        this.refusal.set(ZOOM_REFUSALS[outcome]);
        return;
    }

    // `failed`, or a signature refused twice. Give the lease back: "Try again"
    // claims it afresh, and nobody holds a session behind an error screen.
    await this.session.release();
    this.refusal.set({ kind: 'failed', message: null, opensAt: null });
  }

  /**
   * The host has not started yet: hold the lease (its heartbeat keeps running)
   * and try Zoom again shortly. Every try mints a fresh signature, and the
   * server re-runs its joinability checks, so a webinar that ends or is
   * cancelled while we wait lands in its refusal instead of looping.
   */
  private scheduleRejoin(webinarId: string, run: number): void {
    this.rejoinTimer = setTimeout(() => {
      this.rejoinTimer = null;
      void this.rejoin(webinarId, run);
    }, WAITING_FOR_HOST_RETRY_MS);
  }

  private async rejoin(webinarId: string, run: number): Promise<void> {
    try {
      await this.attempt(webinarId, false, run);
    } catch (err) {
      if (run !== this.run) return;
      const refusal = toRefusal(toWebinarError(err));
      // A network blip while waiting is no reason to stop waiting.
      if (refusal.kind === 'failed') {
        this.scheduleRejoin(webinarId, run);
        return;
      }
      this.waitingForHost.set(false);
      this.zoom.phase.set('idle');
      this.refusal.set(refusal);
    }
  }

  /** Stop waiting for the host, and abandon any attempt still in flight. */
  private stopWaiting(): void {
    this.run++;
    if (this.rejoinTimer !== null) clearTimeout(this.rejoinTimer);
    this.rejoinTimer = null;
    this.waitingForHost.set(false);
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

  /**
   * The webinar's own page, for Client View's `leaveUrl`: where Zoom goes if it
   * ever leaves the page itself. A path is enough; the SDK prefixes the origin.
   */
  private webinarPageUrl(): string {
    return this.router.serializeUrl(this.urlUp(1));
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
