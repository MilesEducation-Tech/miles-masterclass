import { Component, computed, effect, inject, input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VideoChapter } from '../../../../shared/components/video-chapter/video-chapter';
import { AudioChapter } from '../../../../shared/components/audio-chapter/audio-chapter';
import { Backward } from '../../../../../../shared/components/backward/backward';
import { Utils } from '../../../../../../shared/core/services/utils/utils';
import { Auth } from '../../../../../../shared/core/services/auth/auth';
import { Logger } from '../../../../../../shared/core/services/logger/logger';
import { CairaUuid } from '../../../../../../shared/core/models/caira/envelope.model';
import { ChapterProgress } from '../../../../shared/services/chapter-progress/chapter-progress';
import { CourseDetail } from '../../../../shared/services/course-detail/course-detail';

/** See `masterclass-chapter.ts` — same cadence, same reason. */
const SAVE_INTERVAL_PERCENT = 5;

/**
 * The podcast chapter player.
 *
 * Structurally the masterclass player with an audio layout: CAIRA serves both
 * from `Masterclass_Course_Detail`, so `CourseDetail` and `ChapterProgress` are
 * the same services, provided on the same route positions. The only difference
 * is which of the two players renders, decided by `podcast_format`.
 */
@Component({
  selector: 'app-podcast-chapter',
  imports: [VideoChapter, AudioChapter, Backward],
  templateUrl: './podcast-chapter.html',
  styleUrl: './podcast-chapter.css',
})
export class PodcastChapter {
  readonly courseId = input<string>();
  readonly courseTitle = input<string>();
  readonly chapterId = input<string>();

  protected readonly chapter = inject(ChapterProgress);
  private readonly courseDetail = inject(CourseDetail);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);

  protected readonly navigation = this.chapter.navigation;
  protected readonly courseNavigation = computed(() => '../../..');

  /**
   * ponytail: **CAIRA has no format discriminator.** The Django API returned
   * `podcast_format: 'Audio' | 'Video'`; `Masterclass_Course_Detail` serves
   * every course type from one shape and reports only `hls_video_url`, so there
   * is nothing to branch on. Held `null`, which renders the video layout — the
   * one that works for an HLS source either way.
   *
   * Podcast has no CAIRA counterpart as a CPE type at all (G-19); this is the
   * chapter-level face of that gap. A `course_format` field on #4 would fix it.
   */
  protected readonly podcastFormat = computed<'Audio' | 'Video' | null>(() => null);

  protected readonly chapterIndex = computed(() => this.navigation().currentIndex);

  private lastPosition = 0;
  private lastSavedPercent = 0;

  constructor() {
    effect(() => {
      if (!this.chapter.chapterId()) return;
      this.lastSavedPercent = 0;
      this.lastPosition = 0;
      this.chapter.start();
    });

    effect(() => {
      if (this.auth.isLoggedIn()) return;
      const tree = this.router.parseUrl(this.router.url);
      const segments = tree.root.children['primary']?.segments;
      if (segments && segments.length >= 3) {
        segments.splice(segments.length - 3, 3);
        this.router.navigateByUrl(tree);
      }
    });
  }

  protected handleNavigation(chapterId: CairaUuid): void {
    const chapter = this.chapter.chapters().find((c) => c.id === chapterId);
    if (!chapter) {
      this.logger.warn('handleNavigation: unknown chapter', { chapterId });
      return;
    }
    if (chapter.is_locked) return;

    // CPE mode holds the next chapter until this one is complete; going back is
    // always allowed. Same rule as the masterclass twin.
    const isGoingBack = this.chapter.navigation().prev?.id === chapterId;
    if (!isGoingBack && this.chapter.cpeMode() && !this.chapter.isVideoCompleted()) return;

    this.chapter.saveProgress(this.lastPosition, { final: true });

    this.router.navigate(['../../', chapterId, this.utils.slugify(chapter.chapter_name)], {
      relativeTo: this.route,
    });
  }

  protected startFinalAssessment(): void {
    const courseId = this.courseId();
    const courseTitle = this.courseTitle();
    if (!courseId || !courseTitle) return;
    this.courseDetail.startFinalAssessment(courseId, courseTitle, 'podcast');
  }

  /** ponytail: `:sessionId` has no CAIRA counterpart — see the masterclass twin. */
  protected handleViewReport(): void {
    this.router.navigate(['../../../', 'final-assessment', 'latest', 'report'], {
      relativeTo: this.route,
    });
  }

  protected updateTime(data: { currentTime: number; duration: number }): void {
    this.lastPosition = data.currentTime;
    if (data.duration <= 0) return;

    const percent = (data.currentTime / data.duration) * 100;
    if (Math.abs(percent - this.lastSavedPercent) < SAVE_INTERVAL_PERCENT) return;

    this.lastSavedPercent = percent;
    this.chapter.saveProgress(data.currentTime);
  }

  protected handleExit(data?: { currentTime: number; duration: number }): void {
    const position = data?.currentTime ?? this.lastPosition;
    this.lastPosition = position;
    this.chapter.saveProgress(position, { final: true });
  }

  protected handleMediaEnded(): void {
    this.chapter.saveProgress(this.lastPosition, { final: true });
  }
}
