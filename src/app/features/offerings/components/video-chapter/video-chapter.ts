import {
  CourseChapter,
  ChapterWiseDetails,
  UserAssessmentDetails,
} from '@core/models/course.model';
import {
  Component,
  computed,
  input,
  output,
  effect,
  signal,
  viewChild,
  inject,
  DestroyRef,
  model,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VideoJs } from '@shared/components/video-js/video-js';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { ChapterSkeleton } from '@shared/components/skeleton/chapter-skeleton/chapter-skeleton';

import { ChapterQuiz } from '../chapter-quiz/chapter-quiz';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { faClipboard } from '@ng-icons/font-awesome/regular';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { MasterclassFacade } from '../../services/masterclass-facade';
import { Analytics } from '@core/services/analytics/analytics';
// Type-only: HtmlContentDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

@Component({
  selector: 'app-video-chapter',
  imports: [VideoJs, ChapterSkeleton, ChapterQuiz, NgIcon],
  templateUrl: './video-chapter.html',
  providers: [provideIcons({ faClipboard })],
  host: {
    class: 'flex w-full h-full max-md:overflow-auto flex-col md:overflow-hidden',
  },
})
export class VideoChapter {
  readonly current = model<CourseChapter | null>(null);
  readonly previous = input<CourseChapter | null>(null);
  readonly next = input<CourseChapter | null>(null);
  readonly activeIndex = input(0);
  readonly cpeMode = input(false);
  readonly chapterWiseDetails = input<ChapterWiseDetails | undefined>(undefined);
  readonly userAssessmentDetails = input<UserAssessmentDetails | undefined>(undefined);
  readonly courseId = input<number | null>(null);
  readonly courseType = input<string>('masterclass');

  readonly navigate = output<number>();
  readonly startFinalAssessment = output<void>();
  readonly viewFinalAssessmentReport = output<void>();
  readonly firstChapterEnded = output<void>();

  // Video events outputs
  readonly paused = output<void>();
  readonly ended = output<void>();
  readonly videoExit = output<{ duration: number; currentTime: number }>();
  readonly timeUpdate = output<{ duration: number; currentTime: number }>();

  private readonly videoPlayer = viewChild(VideoJs);
  private readonly destroyRef = inject(DestroyRef);
  private readonly masterclassFacade = inject(MasterclassFacade);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly analytics = inject(Analytics);

  private transcriptCache = new Map<number, string>();

  readonly currentProgress = signal(0);

  // Track last known time for destroy handler
  private lastTime = 0;
  private lastDuration = 0;
  private lastChapterId = 0;

  // Analytics: per-chapter video-milestone dedup (reset on chapter change).
  private videoTrackedChapter: number | null = null;
  private videoStartFired = false;
  private readonly firedVideoMilestones = new Set<number>();
  private static readonly VIDEO_MILESTONES = [25, 50, 75, 90] as const;

  readonly progressUnlocked = computed(() => {
    const currentChapter = this.current();
    if (!this.cpeMode()) return true;

    const isCompleted = currentChapter?.play_history?.is_completed;
    const isStatusCompleted = this.chapterWiseDetails()?.status;

    return isCompleted || isStatusCompleted;
  });

  constructor() {
    // Initialize progress from chapter data if available
    effect(() => {
      const chapter = this.current();

      if (chapter) {
        // Only run mode initialization if chapter has changed
        if (chapter.id !== this.lastChapterId) {
          this.lastChapterId = chapter.id;

          // Reset video ended state when chapter changes
          this.videoEnded.set(false);

          // Handle Preview Mode - if completed and quiz pending, show quiz
          if (
            this.cpeMode() &&
            chapter.play_history?.is_completed &&
            chapter.quiz_details?.questions?.length &&
            !chapter.quiz_details.questions.every((q) => q.user_selected_option)
          ) {
            this.previewMode.set('quiz');
          } else {
            this.previewMode.set('video');
          }
        }

        // Handle Progress (Always update this, even if same chapter)
        if (chapter.play_history && chapter.video_duration) {
          const progress = ((chapter.play_history.time_status ?? 0) / chapter.video_duration) * 100;
          if (progress > untracked(() => this.currentProgress())) {
            this.currentProgress.set(progress);
          }
        }
      } else {
        this.currentProgress.set(0);
        this.lastTime = 0;
        this.lastDuration = 0;
        this.lastChapterId = 0;
        this.previewMode.set('video');
        this.videoEnded.set(false);
      }
    });

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      if (this.lastTime > 0) {
        this.videoExit.emit({
          currentTime: this.lastTime,
          duration: this.lastDuration,
        });
      }
    });
  }

  handleTimeUpdate(event: { currentTime: number; duration: number }) {
    this.lastTime = event.currentTime;
    this.lastDuration = event.duration;

    if (event.duration > 0) {
      const progress = (event.currentTime / event.duration) * 100;
      this.currentProgress.set(progress);
      this.trackVideoProgress(progress);
    }

    this.timeUpdate.emit(event);
  }

  /** Reset milestone dedup when the active chapter changes. */
  private syncVideoTracking(): void {
    const id = this.current()?.id ?? null;
    if (id !== this.videoTrackedChapter) {
      this.videoTrackedChapter = id;
      this.videoStartFired = false;
      this.firedVideoMilestones.clear();
    }
  }

  private videoEventParams(): Record<string, unknown> {
    return {
      course_id: this.courseId(),
      course_type: this.courseType(),
      chapter_id: this.current()?.id,
    };
  }

  /** video_start once, then video_progress at 25/50/75/90% — each once per chapter. */
  private trackVideoProgress(progress: number): void {
    this.syncVideoTracking();
    if (!this.videoStartFired && progress > 0) {
      this.videoStartFired = true;
      this.analytics.trackEvent('video_start', this.videoEventParams());
    }
    for (const m of VideoChapter.VIDEO_MILESTONES) {
      if (progress >= m && !this.firedVideoMilestones.has(m)) {
        this.firedVideoMilestones.add(m);
        this.analytics.trackEvent('video_progress', { ...this.videoEventParams(), percent: m });
      }
    }
  }

  handleMetadataLoaded() {
    const chapter = this.current();
    if (
      this.cpeMode() &&
      chapter?.play_history &&
      !chapter.play_history.is_completed &&
      chapter.play_history.time_status
    ) {
      // Seek to saved time
      this.videoPlayer()?.seek(chapter.play_history.time_status, true);
    }
  }

  readonly videoSource = computed<VideoSource[]>(
    () => {
      const chapter = this.current();
      if (!chapter?.video_url) return [];

      const url = chapter.video_url;
      let type = 'video/mp4';

      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        type = 'video/youtube';
      } else if (url.endsWith('.m3u8')) {
        type = 'application/x-mpegURL';
      }

      return [{ src: url, type }];
    },
    {
      equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    },
  );

  readonly playerMode = computed(() => {
    return this.progressUnlocked() ? PlayerMode.DEFAULT : PlayerMode.CPE;
  });

  readonly videoConfig = computed<VideoConfig>(() => ({
    poster: this.current()?.chapter_thumbnail,
    autoplay: false,
    fluid: true,
    controls: true,
  }));

  readonly previewMode = signal<'video' | 'quiz'>('video');

  readonly videoEnded = signal(false);

  readonly isQuizEnabled = computed(() => {
    return (
      this.current()?.play_history?.is_completed ||
      this.chapterWiseDetails()?.status ||
      this.videoEnded()
    );
  });

  handleVideoEnded() {
    this.videoEnded.set(true);
    this.ended.emit();
    this.syncVideoTracking();
    if (!this.firedVideoMilestones.has(100)) {
      this.firedVideoMilestones.add(100);
      this.analytics.trackEvent('video_complete', this.videoEventParams());
    }

    const chapter = this.current();
    if (
      this.cpeMode() &&
      chapter?.quiz_details?.questions?.length &&
      !chapter.quiz_details.questions.every((q) => q.user_selected_option)
    ) {
      this.previewMode.set('quiz');
    } else if (!this.cpeMode()) {
      const isFirstChapter = this.activeIndex() === 0;
      const nextChapter = this.next();

      if (isFirstChapter && nextChapter) {
        // First chapter in preview mode — let parent show CPE mode suggestion
        this.firstChapterEnded.emit();
      } else if (nextChapter) {
        this.navigate.emit(nextChapter.id);
      } else {
        // Last chapter — reset player to start
        this.videoPlayer()?.seek(0);
        this.videoPlayer()?.pause();
        this.videoEnded.set(false);
      }
    }
  }

  handleQuizNext() {
    // Navigate to next chapter
    const currentChapter = this.current();
    if (currentChapter) {
      // We might need to find the index and emit the next ID.
      // But the parent handles navigation via `navigate` output with chapter ID.
      // We need the NEXT chapter ID.
      // The `next` input holds the next chapter.
      const nextChapter = this.next();
      if (nextChapter) {
        this.navigate.emit(nextChapter.id);
      } else {
        this.startFinalAssessment.emit();
      }
    }
  }

  readonly isLastChapter = computed(() => !this.next());

  resetPlayer() {
    this.videoEnded.set(false);
    this.currentProgress.set(0);
    this.lastTime = 0;
    this.lastDuration = 0;
    this.previewMode.set('video');
    // Force seek to bypass CPE mode seek guard, since mode may have already switched
    this.videoPlayer()?.seek(0, true);
    this.videoPlayer()?.pause();
  }

  handleTrackQuiz() {
    this.previewMode.set('quiz');
  }

  openTranscript() {
    const chapter = this.current();
    const id = this.courseId();
    if (!chapter || !id) return;

    const cached = this.transcriptCache.get(chapter.id);
    if (cached) {
      void this.openTranscriptDialog(cached, chapter.chapter_name);
      return;
    }

    this.masterclassFacade
      .fetchCourseContent(
        { id, course_type: this.courseType(), chapter_id: chapter.id },
        { skipErrorNotification: true },
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.data?.chapter?.transcript_text) {
            this.transcriptCache.set(chapter.id, response.data.chapter.transcript_text);
            void this.openTranscriptDialog(
              response.data.chapter.transcript_text,
              chapter.chapter_name,
            );
          }
        },
      });
  }

  private async openTranscriptDialog(html: string, chapterName: string): Promise<void> {
    const { HtmlContentDialog } =
      await import('@features/offerings/dialogs/html-content-dialog/html-content-dialog');
    this.dialogs.open<HtmlContentDialogData>(HtmlContentDialog, {
      data: {
        title: `Transcript - ${chapterName}`,
        htmlContent: html,
      },
    });
  }
}
