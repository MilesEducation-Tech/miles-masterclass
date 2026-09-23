import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Viewport } from '@core/services/viewport/viewport';
import { MeetingStage } from '../../components/meeting-stage/meeting-stage';
import { EjectionReason } from '../../models/meeting-session.model';
import { WebinarCard } from '../../models/webinar.model';
import { MeetingSession } from '../../services/meeting-session';
import { WebinarFacade } from '../../services/webinar-facade';
import { toJoinParams, ZoomMeetingClient } from '../../services/zoom-meeting-client';

/**
 * The live meeting room.
 *
 * Registered as `RenderMode.Client` — the SDK touches `window`, `document` and
 * WebAssembly, so this route is never server-rendered.
 *
 * The join sequence is deliberately ordered cheapest-refusal-first:
 *
 *   local Web Lock  →  server lease  →  Zoom signature  →  import SDK  →  join
 *
 * A second tab in the same browser is turned away at step one, with no network
 * request and without downloading several megabytes of SDK. A second *browser*
 * is turned away at step two. Only a surface that genuinely owns the session
 * ever reaches the import.
 */
@Component({
  selector: 'app-webinar-live',
  imports: [DatePipe, MeetingStage],
  templateUrl: './webinar-live.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebinarLive {
  /** Bound from the `:id` route param by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly facade = inject(WebinarFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly viewport = inject(Viewport);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly session = inject(MeetingSession);
  protected readonly zoom = inject(ZoomMeetingClient);

  private readonly stage = viewChild(MeetingStage);

  protected readonly webinar = signal<WebinarCard | null>(null);
  protected readonly isPreparing = signal(false);

  protected readonly title = computed(() => this.webinar()?.name ?? 'Webinar');

  /**
   * Zoom states Component View is designed for desktop browsers, not mobile.
   * On anything handheld we do not embed — we hand the learner their own Zoom
   * link instead. The lease is still claimed first, so the one-session rule
   * holds on mobile too, and Zoom's webhook still records attendance, so CPE is
   * unaffected. Phase 3 replaces this branch with Client View.
   */
  protected readonly isMobile = computed(() => this.viewport.isHandheld());

  protected readonly conflict = computed(() => this.session.conflict());
  protected readonly ejection = computed(() => this.session.ejection());

  protected readonly statusText = computed(() => {
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
    // noticed: a sibling tab taking over, or the server superseding us.
    this.session.onEvict = (reason: EjectionReason) => {
      void this.zoom.evict();
      if (reason === 'superseded-remotely' || reason === 'taken-over-locally') {
        this.isPreparing.set(false);
      }
    };

    // The host ending the webinar is not an eviction — release the lease so the
    // learner is not blocked from rejoining if it restarts.
    this.zoom.onConnectionClosed = () => void this.session.release();

    effect(() => {
      const webinarId = this.id();
      if (!this.isBrowser || !webinarId) return;

      untracked(() => {
        this.webinar.set(this.facade.findById(webinarId));
        void this.start(webinarId, false);
      });
    });
  }

  /**
   * Claim the session and join.
   *
   * `takeover` is only ever `true` when the learner has explicitly confirmed it
   * in the conflict dialog — a silent takeover would let a stray background tab
   * eject the session someone is actually watching.
   */
  protected async start(webinarId: string, takeover: boolean): Promise<void> {
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

      const root = this.stage()?.stageRoot();
      if (!root) {
        this.zoom.phase.set('failed');
        return;
      }

      await this.zoom.join(root, toJoinParams(signature));
    } finally {
      this.isPreparing.set(false);
    }
  }

  /** The learner confirmed the takeover in the conflict dialog. */
  protected confirmTakeover(): void {
    void this.start(this.id(), true);
  }

  protected async leave(): Promise<void> {
    await this.zoom.leave();
    await this.session.release();
    // Up two segments: `:id/live` → the feature root.
    void this.router.navigate(['../../'], { relativeTo: this.route });
  }

  /** Mobile fallback: the learner's own Zoom join URL. */
  protected readonly mobileJoinUrl = computed(() => this.webinar()?.registration?.join_url ?? null);
}
