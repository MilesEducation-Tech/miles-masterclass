import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { VideoChapter } from '../../../components/video-chapter/video-chapter';
import { Backward } from '@shared/components/backward/backward';
import { ChapterFacade } from '../../../services/chapter-facade';
import { Utils } from '@shared/services/utils';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Logger } from '@core/services/logger/logger';
import { exitChapterToCourse } from '@shared/utils/exit-chapter';
// Type-only: UtilsDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';

@Component({
  selector: 'app-masterclass-chapter',
  imports: [VideoChapter, Backward],
  templateUrl: './masterclass-chapter.html',
})
export class MasterclassChapter {
  courseId = input<string>();
  courseTitle = input<string>();
  chapterId = input<string>();

  readonly chapterFacade = inject(ChapterFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly logger = inject(Logger);
  private readonly videoChapter = viewChild(VideoChapter);

  readonly isVideoCompleted = signal(false);
  private currentTime = 0;

  private lastFetchedChapterId: number | null = null;

  constructor() {
    effect(() => {
      const id = this.courseId();
      const courseType = 'masterclass';

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
        // Use play_history status if available, default to false
        this.isVideoCompleted.set(current.play_history?.is_completed ?? false);

        // Fetch quiz report if completed and not already fetched for this chapter
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
      // Only run check if details are loaded
      if (details && !this.chapterFacade.loading()) {
        if (!details.cpe_mode_details) {
          // User requirement: "if cpe_mode_details is null then user is not allowed to be in this page"
          // For now, logging. Could redirect or show error state.
          this.logger.warn('Access Denied: CPE Mode details missing');
          // this.router.navigate(['/']); // Uncomment to enforce redirect
        }
        // Deep link / hard refresh into an in-progress course bypasses
        // `navigateToChapter`, so the subscription gate has to run here too —
        // otherwise a bookmarked chapter URL is an open door to the paid tier.
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

    // Determine if navigating to previous or next chapter
    const isNavigatingToPrevious = prev?.id === chapterId;

    // Block navigation to NEXT chapter if in CPE mode and video not completed
    // Allow navigation to PREVIOUS chapter regardless of CPE mode
    if (!isNavigatingToPrevious && this.cpeMode() && !this.isVideoCompleted()) {
      return;
    }

    // Find the chapter to get its name
    const chapters = this.chapterFacade.courseChapters();
    const chapter = chapters.find((c) => c.id === chapterId);

    // Construct slug if chapter found
    let slug = '';
    if (chapter) {
      slug = this.utils.slugify(chapter.chapter_name);
    }

    // Use relative navigation: ../../<newId>/<newSlug>
    // Assuming current route is .../chapter/:id/:slug
    this.router.navigate(['../../', chapterId, slug], { relativeTo: this.route });
  }

  startFinalAssessment() {
    this.utils.startFinalAssessment(
      this.courseId()!,
      this.courseTitle()!,
      'masterclass',
      this.chapterFacade.courseDetails()?.exam_rules!,
    );
  }

  handleViewReport() {
    const details = this.chapterFacade.courseDetails();
    const sessionId = details?.user_assessment_details?.session_id;

    if (sessionId) {
      // Navigate up 3 levels to get out of chapter/:id/:slug
      const commands = ['../../../', 'final-assessment', sessionId, 'report'];
      this.router.navigate(commands, {
        relativeTo: this.route,
      });
    } else {
      this.logger.warn('Cannot navigate to report: Session ID is missing', details);
    }
  }

  async handleFirstChapterEnded(): Promise<void> {
    const nextChapter = this.navigation().next;
    if (!nextChapter) return;

    // Don't offer an upgrade the learner can't take. Without a subscription
    // fall through to the same path the "Skip" button uses, so they aren't
    // stranded at the end of chapter 1 behind a modal with no way forward.
    const course = this.chapterFacade.courseDetails();
    if (!course || !this.utils.canAccessCpeMode(course)) {
      this.handleNavigation(nextChapter.id);
      return;
    }

    const dialogData: UtilsDialogData = {
      title: 'Switch to CPE Mode?',
      containerClass: 'max-w-lg text-left!',
      content: [
        {
          type: 'text',
          value:
            'You have completed the first chapter in Preview Mode. Switch to CPE Mode to earn your certificate and track your progress with quizzes.',
        },
      ],
      buttons: [
        { label: 'Skip', variant: 'ghost', action: 'cancel' },
        { label: 'Switch to CPE Mode', variant: 'default', action: 'confirm' },
      ],
    };

    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const ref = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: { ...dialogData, maxWidth: '32rem', disableClose: true },
    });

    ref.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.action === 'confirm' && result.result) {
        this.chapterFacade
          .selectCpeMode(true)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((res) => {
            if (res) {
              this.videoChapter()?.resetPlayer();
            }
          });
      } else {
        this.handleNavigation(nextChapter.id);
      }
    });
  }

  // Track last known time and percentage for periodic updates
  private lastTrackedPercentage = 0; // Initialize at 0

  handleVideoEvent(
    event: 'heartbeat' | 'completed' | 'exit',
    data?: { currentTime: number; duration: number },
  ) {
    const current = this.chapterFacade.chapterNavigation().current;
    if (!current) return;

    // If already completed, only allow 'completed' event (player end), block others
    if (this.isVideoCompleted() && event !== 'completed') {
      return;
    }

    const time = data?.currentTime ?? this.currentTime;
    // time_status is passed as number (seconds) to API
    const timeStatus = Number(time);

    this.chapterFacade.trackActivity(current.id, timeStatus, event).subscribe();
  }

  handleVideoCompleted() {
    // Mark as completed locally to switch view (if using toggle) or update UI
    this.isVideoCompleted.set(true);
    // Call API
    this.handleVideoEvent('completed', { currentTime: this.currentTime, duration: 0 });
  }

  updateTime(data: { currentTime: number; duration: number }) {
    this.currentTime = data.currentTime;

    if (data.duration > 0) {
      const percentage = (data.currentTime / data.duration) * 100;

      // Check for completion (> 95%)
      if (percentage > 95 && !this.isVideoCompleted()) {
        this.handleVideoCompleted();
      }

      // Check for periodic update (every 5%)
      if (Math.abs(percentage - this.lastTrackedPercentage) >= 5) {
        this.lastTrackedPercentage = percentage;
        this.handleVideoEvent('heartbeat', {
          currentTime: data.currentTime,
          duration: data.duration,
        });
      }
    }
  }
}
