import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matFavoriteBorderRound,
  matFavoriteRound,
  matInfoRound,
  matLinkRound,
  matLockRound,
  matMenuBookRound,
  matMoreVertRound,
  matSendRound,
  matVolumeOffRound,
  matVolumeUpRound,
} from '@ng-icons/material-icons/round';
import { NgpMenu, NgpMenuItem, NgpMenuTrigger } from 'ng-primitives/menu';
import { Button } from '@shared/ui/button/button';
import { PlayerMode, VideoConfig, VideoJs } from '@shared/components/video-js/video-js';
import { MicroLearningOptionId } from '@features/offerings/models/micro-learning-course.model';
import { Reel } from '@features/offerings/models/reel.model';
import { MicroLearningCourseFacade } from '@features/offerings/services/micro-learning-course-facade';

/**
 * One reel of the player. It takes its reel (the row it draws) and asks the
 * player's facade for the rest: whether it is on screen, what plays, what the
 * learner may do. A reel the learner can't watch plays its trailer under a
 * sign-in or subscribe message, and its button says which.
 */
@Component({
  selector: 'app-micro-learning-reel-card',
  imports: [NgIcon, NgOptimizedImage, Button, VideoJs, NgpMenu, NgpMenuItem, NgpMenuTrigger],
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
      matFavoriteBorderRound,
      matFavoriteRound,
      matInfoRound,
      matLinkRound,
      matMenuBookRound,
      matLockRound,
    }),
  ],
})
export class MicroLearningReelCard {
  protected readonly facade = inject(MicroLearningCourseFacade);

  readonly reel = input.required<Reel>();

  private readonly videoPlayer = viewChild(VideoJs);

  /** Play state of the player; drives the button's label. */
  protected readonly isPlaying = signal(false);
  /** True once the reel has played, so the label says Resume rather than Play. */
  protected readonly hasStarted = signal(false);

  protected readonly active = computed(() => this.facade.isActive(this.reel()));
  protected readonly preloaded = computed(() => this.facade.isPreloaded(this.reel()));
  /**
   * Kept as the same array while its URLs don't change: `VideoJs` reloads the
   * media for any new array, and every save hands the card a new reel object.
   */
  protected readonly sources = computed(() => this.facade.sources(this.reel()), {
    equal: (a, b) =>
      a.length === b.length && a.every((s, i) => s.src === b[i].src && s.type === b[i].type),
  });
  /** The sign-in or subscribe message over a reel the learner can't watch; `null` otherwise. */
  protected readonly accessCopy = computed(() => this.facade.accessCopy(this.reel()));
  protected readonly bookmarked = computed(() => this.facade.isBookmarked(this.reel()));

  protected readonly volumeIcon = computed(() =>
    this.facade.muted() ? 'matVolumeOffRound' : 'matVolumeUpRound',
  );

  protected readonly bookmarkIcon = computed(() =>
    this.bookmarked() ? 'matFavoriteRound' : 'matFavoriteBorderRound',
  );

  /** The facade's words (unlock, CPE, the next step), else play / pause / resume from the player. */
  protected readonly buttonLabel = computed(() => {
    const label = this.facade.buttonLabel(this.reel());
    if (label) return label;
    if (this.isPlaying()) return 'Pause';
    return this.hasStarted() || this.facade.resumeAt(this.reel()) > 0 ? 'Resume' : 'Play';
  });

  /** A mode switch, or a step on this reel, is in flight. */
  protected readonly buttonBusy = computed(() => this.facade.isBusy(this.reel()));

  /** The CPE / Preview tag, from the learner's mode on the reel; none before a mode is chosen. */
  protected readonly modeTag = computed<{ label: string; classes: string } | null>(() => {
    if (this.accessCopy()) return null;
    switch (this.reel().user_state.course_mode) {
      case 'cpe':
        return {
          label: 'CPE Mode',
          classes: 'bg-yellow-600/20 text-yellow-600 border border-yellow-600',
        };
      case 'preview':
        return { label: 'Preview Mode', classes: 'bg-accent/20 text-accent border border-accent' };
      default:
        return null;
    }
  });

  private readonly inCpeMode = computed(
    () => !this.accessCopy() && this.reel().user_state.course_mode === 'cpe',
  );

  protected readonly playerMode = computed(() =>
    this.inCpeMode() && !this.reel().user_state.is_video_completed
      ? PlayerMode.CPE
      : PlayerMode.DEFAULT,
  );

  protected readonly videoConfig = computed<VideoConfig>(() => ({
    controls: true,
    autoplay: false,
    // A trailer and a Preview reel loop, as a reel feed does; a CPE reel stops at its end.
    loop: !this.inCpeMode(),
    muted: this.facade.muted(),
    poster: this.reel().thumbnails.vertical || undefined,
    preload: 'auto',
    // Play / pause is the button below and sound the rail's mute button, and
    // full screen doesn't fit a reel: only the progress bar stays.
    controlBar: {
      playToggle: false,
      volumePanel: false,
      fullscreenToggle: false,
      timeDivider: false,
      durationDisplay: false,
      remainingTimeDisplay: false,
    },
  }));

  constructor() {
    // Play when the reel comes on screen, pause when it leaves.
    effect(() => {
      const isActive = this.active();
      const player = this.videoPlayer();
      if (!player) return;
      untracked(() => (isActive ? player.play() : player.pause()));
    });

    // The quiz opens over the reel: it pauses. Closing the quiz doesn't play it
    // again, since a CPE reel that had ended would start over from 0.
    effect(() => {
      const held = this.facade.quizOpenFor() === this.reel().id;
      const player = this.videoPlayer();
      if (held && player) untracked(() => player.pause());
    });

    // Start again from the beginning when the facade asks (a CPE switch, Rewatch).
    effect(() => {
      const request = this.facade.restartRequest();
      const player = this.videoPlayer();
      if (!request || request.id !== untracked(this.reel).id || !player) return;
      untracked(() => {
        this.hasStarted.set(false);
        player.seek(0, true);
        player.play();
      });
    });
  }

  /** The media is ready: pick up where the learner stopped. */
  protected onMetadataLoaded(): void {
    const at = this.facade.resumeAt(this.reel());
    if (at > 0) this.videoPlayer()?.seek(at, true);
  }

  protected onTimeUpdate(event: { currentTime: number; duration: number }): void {
    this.facade.videoTime(this.reel(), event.currentTime, event.duration);
  }

  protected onVideoPlaying(): void {
    this.isPlaying.set(true);
    this.hasStarted.set(true);
  }

  protected onVideoPaused(): void {
    this.isPlaying.set(false);
    this.facade.videoPaused(this.reel());
  }

  protected onVideoEnded(): void {
    this.isPlaying.set(false);
    void this.facade.videoEnded(this.reel());
  }

  /** Play / pause drives the player here; every other action is the facade's. */
  protected onButton(): void {
    const reel = this.reel();
    if (this.facade.buttonAction(reel) !== 'play') {
      this.facade.onButton(reel);
      return;
    }
    const player = this.videoPlayer();
    if (!player) return;
    if (this.isPlaying()) player.pause();
    else player.play();
  }

  protected onOption(option: MicroLearningOptionId): void {
    this.facade.onOption(this.reel(), option);
  }
}
