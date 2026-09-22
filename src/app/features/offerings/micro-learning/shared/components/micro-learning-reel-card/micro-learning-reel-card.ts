import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAddShoppingCartRound,
  matFavoriteBorderRound,
  matFavoriteRound,
  matInfoRound,
  matLinkRound,
  matLockRound,
  matMenuBookRound,
  matMoreVertRound,
  matPlayArrowRound,
  matSendRound,
  matShoppingCartRound,
  matVolumeOffRound,
  matVolumeUpRound,
} from '@ng-icons/material-icons/round';
import { NgpMenu, NgpMenuItem, NgpMenuTrigger } from 'ng-primitives/menu';
import { Button } from '../../../../../../shared/components/ui/button/button';
import {
  PlayerMode,
  VideoConfig,
  VideoJs,
  VideoSource,
} from '../../../../../../shared/components/video-js/video-js';
import {
  ActionStatus,
  deriveActionStatus,
  isReelCompleted,
  MicroLearningOptionId,
  MicroLearningReel,
  ReelActivityPayload,
} from '../../../../../../shared/core/models/micro-learning-course.model';
import { TotalCpeCreditsPipe } from '../../../../../../shared/core/pipes/total-cpe-credits/total-cpe-credits.pipe';
import { Utils } from '../../../../../../shared/core/services/utils/utils';

/**
 * Free preview window for a reel the user has no plan for, in seconds. The
 * first minute plays; past that the card locks. Positional, not a budget —
 * "the first minute is free" — so seeking back and rewatching it is fine and
 * seeking past it locks immediately.
 */
const PREVIEW_LIMIT_SECONDS = 60;

@Component({
  selector: 'app-micro-learning-reel-card',
  imports: [NgIcon, Button, VideoJs, TotalCpeCreditsPipe, NgpMenu, NgpMenuItem, NgpMenuTrigger],
  templateUrl: './micro-learning-reel-card.html',
  styleUrl: './micro-learning-reel-card.css',
  host: {
    class: 'bg-[#13171B] rounded-2xl w-full h-auto my-auto py-auto',
  },
  viewProviders: [
    provideIcons({
      matVolumeUpRound,
      matVolumeOffRound,
      matSendRound,
      matMoreVertRound,
      matPlayArrowRound,
      matFavoriteBorderRound,
      matFavoriteRound,
      matAddShoppingCartRound,
      matShoppingCartRound,
      matInfoRound,
      matLinkRound,
      matMenuBookRound,
      matLockRound,
    }),
  ],
})
export class MicroLearningReelCard {
  readonly episode = input.required<MicroLearningReel>();
  readonly muted = input<boolean>(false);
  /** True only for the reel currently in view; drives play/pause + tracking. */
  readonly active = input<boolean>(false);
  /** True when this reel is in the ±1 preload window; drives VideoJs mount. */
  readonly preloaded = input<boolean>(false);
  /** Monotonic token — when it changes and matches this reel's id, reset playhead. */
  readonly rewatchToken = input<number | null>(null);
  /** Monotonic token — when it changes and matches this reel's id, pause the player. */
  readonly pauseToken = input<number | null>(null);
  /** Disables the CTA button while a request is in flight. */
  readonly ctaDisabled = input<boolean>(false);

  readonly muteToggled = output<void>();
  readonly shared = output<void>();
  /** Fires when the user picks an item from the inline `[ngMenu]`. */
  readonly optionSelected = output<MicroLearningOptionId>();
  /** Emits the clicked reel's id so the facade acts on this card, not the stale active reel. */
  readonly actionInvoked = output<number>();
  readonly bookmarkToggled = output<void>();
  readonly cartToggled = output<void>();
  /** Raw timeupdate from the underlying player — the page derives heartbeat/completion. */
  readonly timeUpdate = output<ReelActivityPayload>();
  /** Fired on deactivation/destroy with the last known playhead for the exit ping. */
  readonly exited = output<ReelActivityPayload>();
  /**
   * Fires when the video naturally ends in CPE mode (loop disabled in that
   * state). Parent auto-opens the chapter quiz dialog. Mirrors audio-chapter's
   * `handleAudioEnded` → previewMode='quiz' flow.
   */
  readonly videoEnded = output<void>();

  private readonly videoPlayer = viewChild(VideoJs);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utils = inject(Utils);

  private lastTime = 0;
  private lastDuration = 0;

  /** Play state of the underlying video.js player — drives the CTA label. */
  readonly isPlaying = signal(false);
  /** True once the video has been played at least once (enables "Resume" label). */
  readonly hasStarted = signal(false);

  readonly volumeIcon = computed(() => (this.muted() ? 'matVolumeOffRound' : 'matVolumeUpRound'));
  readonly bookmarkIcon = computed(() =>
    this.episode().added_bookmark ? 'matFavoriteRound' : 'matFavoriteBorderRound',
  );
  readonly cartIcon = computed(() =>
    this.episode().is_added_to_cart ? 'matShoppingCartRound' : 'matAddShoppingCartRound',
  );

  /**
   * Cart CTA visibility — mirrors the masterclass-course-hero rule:
   *   !active_plan && (is_subscription_excluded || can_purchase_individually)
   * ponytail: the live `Auth.currentPlan()` read is gone, so the card assumes
   * no plan and falls back to the reel's own purchase flags.
   */
  readonly canShowCart = computed(() => {
    const reel = this.episode();
    return !!reel.is_subscription_excluded || !!reel.can_purchase_individually;
  });

  /**
   * Paid content the user has no plan for — neither free nor individually
   * purchased. Same predicate the facade gates every CPE action with, so the
   * card and the CTA can never disagree about what's reachable.
   */
  private readonly gated = computed(() => !this.utils.canAccessCpeMode(this.episode()));

  /** Set once a gated reel's playhead passes the free-preview window. */
  private readonly previewEnded = signal(false);

  /**
   * Locked cards render the poster instead of the player, so there's nothing
   * left to autoplay, scrub or track progress with. A gated reel isn't locked
   * up front — it plays its free preview first and locks when that runs out.
   */
  readonly locked = computed(() => this.gated() && this.previewEnded());

  /** Locked-overlay CTA — login for guests, the subscription upsell otherwise. */
  protected unlock(): void {
    this.utils.requireCpeModeAccess(this.episode());
  }

  /**
   * Bridge for the `[ngMenu]` `(itemSelected)` event. The menu's generic `V`
   * tends to widen to `string` since each `<button ngMenuItem>` carries its
   * own literal — narrowing here keeps the parent contract honest.
   */
  protected onMenuItemSelected(value: string): void {
    this.optionSelected.emit(value as MicroLearningOptionId);
  }

  readonly ctaLabel = computed(() => {
    const reel = this.episode();
    const inCpeMode = !!reel.cpe_mode_details?.cpe_mode;

    // Server-pushed `action_status` drives the CTA once the reel enters the
    // post-video flow (quiz → exam → feedback → download). `deriveActionStatus`
    // fills in the FEEDBACK/DOWNLOAD tail from the reel's assessment/feedback
    // fields, which the server does not express via `action_status`. Local
    // state only drives the label before any status is set.
    switch (deriveActionStatus(reel)) {
      case ActionStatus.TAKE_QUIZ:
        return 'Take Quiz';
      case ActionStatus.TAKE_EXAM:
        return 'Take Final Assessment';
      case ActionStatus.RETAKE_EXAM:
        return 'Retake Final Assessment';
      case ActionStatus.FEEDBACK:
        return 'Submit Feedback';
      case ActionStatus.DOWNLOAD:
        return 'Download Certificate';
      case ActionStatus.REWATCH:
        return 'Rewatch';
    }

    if (!inCpeMode) return 'Watch in CPE MODE';
    // CPE mode, no pending action_status — toggle based on play state.
    if (this.isPlaying()) return 'Pause';
    return this.hasStarted() ? 'Resume' : 'Play';
  });

  readonly videoSources = computed<VideoSource[]>(() => {
    const url = this.episode().video_url;
    if (!url) return [];
    const isHls = url.toLowerCase().endsWith('.m3u8');
    return [{ src: url, type: isHls ? 'application/x-mpegURL' : 'video/mp4' }];
  });

  /** Derived from `last_activity / total_duration >= 95%` — the single source of truth. */
  readonly isCompleted = computed(() => isReelCompleted(this.episode()));

  /** Stable per-reel identity — doesn't recompute when `episode()` object updates. */
  private readonly reelId = computed(() => this.episode().id);

  readonly playerMode = computed<PlayerMode>(() => {
    const reel = this.episode();
    const cpe = !!reel.cpe_mode_details?.cpe_mode;
    return cpe && !this.isCompleted() ? PlayerMode.CPE : PlayerMode.DEFAULT;
  });

  /**
   * Surfaces the CPE-vs-Preview tag (top-left of the video card). Mirrors the
   * masterclass hero's `cpe_mode_details.cpe_mode` toggle — `null` when the
   * reel doesn't carry the cpe_mode_details payload at all (legacy rows), so
   * the template can hide the badge entirely.
   */
  readonly cpeModeTag = computed<{ label: string; classes: string } | null>(() => {
    const details = this.episode().cpe_mode_details;
    if (!details) return null;
    return details.cpe_mode
      ? {
          label: 'CPE Mode',
          classes: 'bg-yellow-600/20 text-yellow-600 border border-yellow-600',
        }
      : {
          label: 'Preview Mode',
          classes: 'bg-accent/20 text-accent border border-accent',
        };
  });

  readonly videoConfig = computed<VideoConfig>(() => {
    const reel = this.episode();
    const inCpeMode = !!reel.cpe_mode_details?.cpe_mode;
    // In CPE mode while incomplete, disable loop so the `ended` event fires
    // naturally and the parent can auto-open the chapter quiz dialog.
    // Elsewhere (preview, or completed CPE) keep the TikTok-style loop.
    const shouldLoop = !(inCpeMode && !this.isCompleted());
    return {
      controls: true,
      autoplay: false,
      loop: shouldLoop,
      muted: this.muted(),
      poster: reel.thumbnail || undefined,
      preload: 'auto',
      // Reels are a vertical, swipe-based experience. Play/pause is handled by tap
      // gestures, volume by the mute button in the action rail, and fullscreen
      // doesn't fit the UX — keep only the progress bar + time displays visible.
      // This override layers on top of both DEFAULT_CONTROL_BAR (Preview) and
      // CPE_CONTROL_BAR (CPE mode), so these toggles are hidden in either state.
      controlBar: {
        playToggle: false,
        volumePanel: false,
        fullscreenToggle: false,
        timeDivider: false,
        durationDisplay: false,
        remainingTimeDisplay: false,
      },
    };
  });

  constructor() {
    // Play on activation, emit exit + pause on deactivation.
    effect(() => {
      const isActive = this.active();
      const player = this.videoPlayer();
      if (!player) return;
      if (isActive) {
        this.safePlay(player);
      } else {
        untracked(() => this.emitExit());
        player.pause();
      }
    });

    // Reset to the start whenever the parent requests a rewatch for this reel.
    effect(() => {
      const token = this.rewatchToken();
      const player = this.videoPlayer();
      if (token == null || !player) return;
      untracked(() => {
        this.hasStarted.set(false);
        player.seek(0, true);
        this.safePlay(player);
      });
    });

    // Pause the underlying player when the parent requests it (e.g. the
    // chapter quiz dialog opens). Token-based so a fresh request always
    // re-fires the effect even if the previous token was the same target.
    effect(() => {
      const token = this.pauseToken();
      const player = this.videoPlayer();
      if (token == null || !player) return;
      untracked(() => player.pause());
    });

    // Reset play state only when the reel IDENTITY changes. Using the stable
    // `reelId` computed (not `episode()` directly) avoids resetting `isPlaying`
    // on every heartbeat, which would otherwise flicker the CTA label to
    // "Resume" mid-playback after each local-progress update.
    effect(() => {
      void this.reelId();
      untracked(() => {
        this.isPlaying.set(false);
        this.hasStarted.set((this.episode().last_activity ?? 0) > 0);
        // Each reel gets its own preview.
        this.previewEnded.set(false);
      });
    });

    // Emit a final exit on destroy (SPA navigation away from the page).
    this.destroyRef.onDestroy(() => this.emitExit());
  }

  onMetadataLoaded(event: { duration: number }): void {
    this.lastDuration = event.duration;
    // Mirror video-chapter.handleMetadataLoaded: in CPE mode, resume from the
    // last known position if the user has partial progress that isn't yet 95%.
    const reel = this.episode();
    const watched = reel.last_activity ?? 0;
    if (this.playerMode() === PlayerMode.CPE && watched > 0 && !this.isCompleted()) {
      this.videoPlayer()?.seek(watched, true);
    }
  }

  onVideoPlaying(): void {
    this.isPlaying.set(true);
    this.hasStarted.set(true);
  }

  onVideoPaused(): void {
    this.isPlaying.set(false);
    // Mirror masterclass-chapter.ts: a player pause fires `exit` to
    // myclassactivity so the server has the latest playhead. `emitExit`
    // guards on `lastTime > 0` so the pause triggered by the deactivation
    // effect (which pre-emits exit and resets lastTime) doesn't double-fire.
    this.emitExit();
  }

  /**
   * Fires only in CPE mode (loop is disabled there until completion). The
   * parent auto-opens the chapter quiz dialog. Mirrors audio-chapter's
   * `handleAudioEnded` previewMode swap.
   */
  onVideoEnded(): void {
    this.isPlaying.set(false);
    this.videoEnded.emit();
  }

  /**
   * CTA click:
   *  - action_status set (server-driven) → delegate to parent.
   *  - Preview mode (no CPE) → delegate to parent (mode upgrade / login flow).
   *  - CPE mode + locally completed → delegate to parent (open chapter quiz).
   *  - CPE mode + in progress → toggle play/pause directly.
   */
  onCtaClick(): void {
    const reel = this.episode();
    const inCpeMode = !!reel.cpe_mode_details?.cpe_mode;
    if (reel.action_status || !inCpeMode || (inCpeMode && this.isCompleted())) {
      this.actionInvoked.emit(reel.id);
      return;
    }
    const player = this.videoPlayer();
    if (!player) return;
    if (this.isPlaying()) player.pause();
    else this.safePlay(player);
  }

  /**
   * `play()` returns a Promise that rejects when the browser blocks autoplay
   * (e.g., unmuted video without a prior user gesture). Swallow that
   * rejection so it doesn't surface as an "Uncaught (in promise)" console
   * error — if playback is blocked, the user can always tap the CTA.
   */
  private safePlay(player: VideoJs): void {
    // Belt and braces: a locked card renders the poster, not the player, but
    // `locked` can flip mid-session (plan expires) while a player is still
    // mounted. Every play path — scroll activation, rewatch, CTA — lands here.
    if (this.locked()) return;
    player.play();
  }

  onTimeUpdate(event: { currentTime: number; duration: number }): void {
    this.lastTime = event.currentTime;
    this.lastDuration = event.duration;

    // Free preview is up — pause and lock. Setting `previewEnded` swaps the
    // template to the poster, which tears the player down; pausing first stops
    // playback cleanly rather than relying on that teardown. Also catches a
    // seek past the window, since the playhead lands beyond the limit.
    if (this.gated() && event.currentTime >= PREVIEW_LIMIT_SECONDS) {
      this.videoPlayer()?.pause();
      this.previewEnded.set(true);
      return;
    }

    // video-js only fires `timeupdate` while the media is actually playing, so
    // only the active reel can trigger this. Don't gate on `active()` — the
    // signal can flicker false during a scroll/activation handoff and drop
    // events. Match video-chapter.handleTimeUpdate.
    if (!event.duration || event.duration <= 0) return;

    const reel = this.episode();
    this.timeUpdate.emit({
      chapterId: reel.chapter_id,
      currentTime: event.currentTime,
      duration: event.duration,
    });
  }

  private emitExit(): void {
    if (this.lastTime <= 0) return;
    const reel = this.episode();
    this.exited.emit({
      chapterId: reel.chapter_id,
      currentTime: this.lastTime,
      duration: this.lastDuration,
    });
    // Reset so repeated deactivations don't re-fire with stale state.
    this.lastTime = 0;
  }
}
