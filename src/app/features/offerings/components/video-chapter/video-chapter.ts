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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { faClipboard } from '@ng-icons/font-awesome/regular';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { MasterclassFacade } from '../../services/masterclass-facade';
// Type-only: HtmlContentDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { HtmlContentDialogData } from '@features/offerings/dialogs/html-content-dialog/html-content-dialog';

@Component({
  selector: 'app-video-chapter',
  imports: [VideoJs, ChapterSkeleton, NgIcon],
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

  private transcriptCache = new Map<number, string>();

  readonly currentProgress = signal(0);

  // Track last known time for destroy handler
  private lastTime = 0;
  private lastDuration = 0;
  private lastChapterId = 0;

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
        if (chapter.id !== this.lastChapterId) this.lastChapterId = chapter.id;

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
    }

    this.timeUpdate.emit(event);
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

  handleVideoEnded() {
    this.ended.emit();

    // The chapter quiz that followed in CPE mode is unbound until the web API's
    // quiz is wired in, so CPE mode stays on the chapter.
    if (!this.cpeMode()) {
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
      }
    }
  }

  resetPlayer() {
    this.currentProgress.set(0);
    this.lastTime = 0;
    this.lastDuration = 0;
    // Force seek to bypass CPE mode seek guard, since mode may have already switched
    this.videoPlayer()?.seek(0, true);
    this.videoPlayer()?.pause();
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
