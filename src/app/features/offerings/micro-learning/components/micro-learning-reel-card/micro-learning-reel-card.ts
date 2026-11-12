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
  protected readonly sources = computed(() => this.facade.sources(this.reel()));
  /** The sign-in or subscribe message over a reel the learner can't watch; `null` otherwise. */
  protected readonly accessCopy = computed(() => this.facade.accessCopy(this.reel()));
  protected readonly bookmarked = computed(() => this.facade.isBookmarked(this.reel()));

  protected readonly volumeIcon = computed(() =>
    this.facade.muted() ? 'matVolumeOffRound' : 'matVolumeUpRound',
  );

  protected readonly bookmarkIcon = computed(() =>
    this.bookmarked() ? 'matFavoriteRound' : 'matFavoriteBorderRound',
  );

  protected readonly buttonLabel = computed(() => {
    const copy = this.accessCopy();
    if (copy) return copy.button;
    if (this.isPlaying()) return 'Pause';
    return this.hasStarted() ? 'Resume' : 'Play';
  });

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
  }

  protected onVideoPlaying(): void {
    this.isPlaying.set(true);
    this.hasStarted.set(true);
  }

  protected onVideoPaused(): void {
    this.isPlaying.set(false);
  }

  /** A locked reel's button unlocks (sign in or subscribe); an open one plays and pauses. */
  protected onButton(): void {
    if (this.accessCopy()) {
      void this.facade.unlock(this.reel());
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
