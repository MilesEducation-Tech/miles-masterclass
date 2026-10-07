import { DatePipe, NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matBookmarkBorderRound,
  matBookmarkRound,
  matPauseRound,
  matPlayArrowRound,
  matVolumeOffRound,
  matVolumeUpRound,
} from '@ng-icons/material-icons/round';
import { phosphorDownloadSimpleFill, phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCards } from '@ng-icons/phosphor-icons/regular';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { VideoSource } from '@core/models/video-player.model';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { VideoJs } from '@shared/components/video-js/video-js';
import { detectVideoMimeType } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import {
  HERO_TRAILER_CONFIG,
  HERO_TRAILER_DELAY_MS,
} from '@features/offerings/masterclass/constants/masterclass';
import { MasterclassCourseDetail } from '@features/offerings/masterclass/models/masterclass-course.model';

/**
 * The course page's hero. It renders the course it is given and emits what the
 * learner asked for; the page hands each event to the facade.
 *
 * The background is the trailer, as on production: the poster first (a plain
 * image, server-rendered, the LCP), then after `HERO_TRAILER_DELAY_MS` the HLS
 * trailer, muted and looping, fading in once it actually plays. It plays
 * through the shared video.js player, which loads video.js only when it
 * mounts; if it fails, the poster simply stays.
 *
 * Sample shows only when the API sends `sample_video_url` (null on every UAT
 * course so far); Download is enabled once it sends the certificate URL.
 * Held back until the web API covers them (`docs/MASTERCLASS_API_QUESTIONS.md`)
 * or their own PR: the CPE/Preview mode switch, price and Add To Cart, and the
 * signed-in progress, rating and final-assessment actions.
 */
@Component({
  selector: 'app-masterclass-course-hero',
  imports: [DatePipe, NgOptimizedImage, NgIcon, Button, VideoJs, CategoriesList, CairaCredlyBadge],
  templateUrl: './masterclass-course-hero.html',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matPauseRound,
      matVolumeOffRound,
      matVolumeUpRound,
      matBookmarkRound,
      matBookmarkBorderRound,
      phosphorCards,
      phosphorShareFatFill,
      phosphorDownloadSimpleFill,
    }),
  ],
})
export class MasterclassCourseHero {
  readonly course = input.required<MasterclassCourseDetail>();
  /** The learner's bookmark, held by the facade while a toggle is read back. */
  readonly bookmarked = input(false);
  readonly bookmarkPending = input(false);

  readonly watch = output();
  readonly trailer = output();
  readonly sample = output();
  readonly bookmark = output();
  readonly share = output();
  readonly download = output();

  private readonly player = viewChild(VideoJs);

  protected readonly trailerConfig = HERO_TRAILER_CONFIG;

  /** Mounts the player once the poster has had its moment; browser only. */
  protected readonly trailerMounted = signal(false);
  /** Set by the first `playing`: the trailer fades in over the poster then. */
  protected readonly trailerStarted = signal(false);
  protected readonly trailerPlaying = signal(false);
  protected readonly trailerMuted = signal(true);

  protected readonly poster = computed(
    () => this.course().trailer_thumbnail_url || this.course().horizontal_thumbnail_url,
  );

  protected readonly trailerSource = computed<VideoSource | null>(() => {
    const src = this.course().trailer_video_url;
    return src ? { src, type: detectVideoMimeType(src) } : null;
  });

  protected readonly instructorNames = computed(() =>
    this.course()
      .instructors.map((instructor) => instructor.name)
      .join(', '),
  );

  /** Every UAT course sits in one CAIRA level; the badge shows its number. */
  protected readonly cairaLevel = computed(() => this.course().level[0]?.level_number ?? null);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const timer = setTimeout(() => this.trailerMounted.set(true), HERO_TRAILER_DELAY_MS);
      destroyRef.onDestroy(() => clearTimeout(timer));
    });

    // Like `VideoPoster`: a dialog (the trailer with sound, Share) pauses the
    // background trailer rather than playing under it.
    inject(NgpDialogManager)
      .afterOpened.pipe(takeUntilDestroyed())
      .subscribe(() => this.player()?.pause());
  }

  protected onTrailerPlaying(): void {
    this.trailerStarted.set(true);
    this.trailerPlaying.set(true);
  }

  protected togglePlay(): void {
    this.player()?.togglePlay();
  }

  protected toggleMute(): void {
    const player = this.player();
    if (!player) return;
    player.toggleMute();
    this.trailerMuted.set(player.isMuted());
  }
}
