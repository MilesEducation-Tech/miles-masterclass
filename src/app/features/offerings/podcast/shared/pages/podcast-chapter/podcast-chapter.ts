import { Component, computed, effect, inject, input, signal, DestroyRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VideoChapter } from '../../../../shared/components/video-chapter/video-chapter';
import { AudioChapter } from '../../../../shared/components/audio-chapter/audio-chapter';
import { Backward } from '@shared/components/backward/backward';
import { ChapterFacade } from '../../../../shared/services/chapter-facade/chapter-facade';
import { Utils } from '@shared/services/utils';
import { Logger } from '@core/services/logger/logger';
import { exitChapterToCourse } from '@shared/utils/exit-chapter';

@Component({
  selector: 'app-podcast-chapter',
  imports: [VideoChapter, AudioChapter, Backward],
  templateUrl: './podcast-chapter.html',
  styleUrl: './podcast-chapter.css',
})
export class PodcastChapter {
  courseId = input<string>();
  courseTitle = input<string>();
  chapterId = input<string>();

  readonly chapterFacade = inject(ChapterFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utils = inject(Utils);
  private readonly logger = inject(Logger);

  readonly isVideoCompleted = signal(false);
  private currentTime = 0;

  private lastFetchedChapterId: number | null = null;

  readonly podcastFormat = computed(() => {
    return this.chapterFacade.courseDetails()?.podcast_format ?? null;
  });

  readonly chapterIndex = computed(() => {
    const chapters = this.chapterFacade.courseChapters();
    const currentId = this.chapterFacade.selectedChapterId();
    if (!currentId) return 0;
    const idx = chapters.findIndex((c) => c.id === currentId);
    return idx >= 0 ? idx : 0;
  });

  constructor() {
    effect(() => {
      const id = this.courseId();
      const courseType = 'podcast';

      if (id) {
        this.chapterFacade.loadCourse({
          id: Number(id),
          course_type: courseType,
        });
      }
    });

    effect(() => {
      const chapterId = this.chapterId();
      if (chapterId) {
        this.chapterFacade.selectedChapterId.set(Number(chapterId));
      }
    });

    // Initialize completion status
    effect(() => {
      const current = this.chapterFacade.chapterNavigation().current;
      if (current) {
        this.isVideoCompleted.set(current.play_history?.is_completed ?? false);

        if (current.id !== this.lastFetchedChapterId) {
          this.chapterFacade.fetchQuizReport(current.id);
          this.lastFetchedChapterId = current.id;
        }
      }
    });

    // ponytail: the logout-redirect effect went with the auth layer.

    // Access control check
    effect(() => {
      const details = this.chapterFacade.courseDetails();
      if (details && !this.chapterFacade.loading()) {
        if (!details.cpe_mode_details) {
          this.logger.warn('Access Denied: CPE Mode details missing');
        }
        // Deep link / hard refresh bypasses `navigateToChapter` — see the
        // masterclass chapter page for the full note.
        if (!this.utils.requireCpeModeAccess(details)) {
          exitChapterToCourse(this.router);
        }
      }
    });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.chapterFacade.clear();
    });
  }

  readonly navigation = this.chapterFacade.chapterNavigation;

  readonly cpeMode = computed(() => {
    return this.chapterFacade.courseDetails()?.cpe_mode_details?.cpe_mode ?? false;
  });

  readonly chapterWiseDetails = computed(() => {
    const currentChapterId = this.navigation().current?.id;
    if (!currentChapterId) return undefined;

    return this.chapterFacade
      .courseDetails()
      ?.chapter_wise_details?.find((detail) => detail.chapter_id === currentChapterId);
  });

  readonly courseNavigation = signal('../../..');

  handleNavigation(chapterId: number) {
    const { prev } = this.navigation();

    const isNavigatingToPrevious = prev?.id === chapterId;

    if (!isNavigatingToPrevious && this.cpeMode() && !this.isVideoCompleted()) {
      return;
    }

    const chapters = this.chapterFacade.courseChapters();
    const chapter = chapters.find((c) => c.id === chapterId);

    let slug = '';
    if (chapter) {
      slug = this.utils.slugify(chapter.chapter_name);
    }

    this.router.navigate(['../../', chapterId, slug], { relativeTo: this.route });
  }

  startFinalAssessment() {
    this.utils.startFinalAssessment(
      this.courseId()!,
      this.courseTitle()!,
      'podcast',
      this.chapterFacade.courseDetails()?.exam_rules!,
    );
  }

  handleViewReport() {
    const details = this.chapterFacade.courseDetails();
    const sessionId = details?.user_assessment_details?.session_id;

    if (sessionId) {
      const commands = ['../../../', 'final-assessment', sessionId, 'report'];
      this.router.navigate(commands, {
        relativeTo: this.route,
      });
    } else {
      this.logger.warn('Cannot navigate to report: Session ID is missing', details);
    }
  }

  // Track last known time and percentage for periodic updates
  private lastTrackedPercentage = 0;

  handleMediaEvent(
    event: 'heartbeat' | 'completed' | 'exit',
    data?: { currentTime: number; duration: number },
  ) {
    const current = this.chapterFacade.chapterNavigation().current;
    if (!current) return;

    if (this.isVideoCompleted() && event !== 'completed') {
      return;
    }

    const time = data?.currentTime ?? this.currentTime;
    const timeStatus = Number(time);

    this.chapterFacade.trackActivity(current.id, timeStatus, event).subscribe();
  }

  handleMediaCompleted() {
    this.isVideoCompleted.set(true);
    this.handleMediaEvent('completed', { currentTime: this.currentTime, duration: 0 });
  }

  updateTime(data: { currentTime: number; duration: number }) {
    this.currentTime = data.currentTime;

    if (data.duration > 0) {
      const percentage = (data.currentTime / data.duration) * 100;

      if (percentage > 95 && !this.isVideoCompleted()) {
        this.handleMediaCompleted();
      }

      if (Math.abs(percentage - this.lastTrackedPercentage) >= 5) {
        this.lastTrackedPercentage = percentage;
        this.handleMediaEvent('heartbeat', {
          currentTime: data.currentTime,
          duration: data.duration,
        });
      }
    }
  }
}
