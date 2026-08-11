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
import { VideoJs } from '../../../../../shared/components/video-js/video-js';
import {
  PlayerMode,
  VideoConfig,
  VideoSource,
} from '../../../../../shared/core/models/video-player.model';
import { ChapterSkeleton } from '../../../../../shared/components/skeleton/chapter-skeleton/chapter-skeleton';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { faClipboard } from '@ng-icons/font-awesome/regular';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import { Analytics } from '../../../../../shared/core/services/analytics/analytics';
import {
  HtmlContentDialog,
  HtmlContentDialogData,
} from '../../../../../shared/components/dialog/html-content-dialog/html-content-dialog';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import {
  ChapterView,
  CourseDetailCard,
} from '../../../../../shared/core/models/caira/course-detail.model';

@Component({
  selector: 'app-video-chapter',
  imports: [VideoJs, ChapterSkeleton, NgIcon],
  templateUrl: './video-chapter.html',
  styleUrl: './video-chapter.css',
  providers: [provideIcons({ faClipboard })],
  host: {
    class: 'flex w-full h-full max-md:overflow-auto flex-col md:overflow-hidden',
  },
})
export class VideoChapter {
  readonly current = model<ChapterView | null>(null);
  readonly previous = input<ChapterView | null>(null);
  readonly next = input<ChapterView | null>(null);
  readonly activeIndex = input(0);
  readonly cpeMode = input(false);
  /** The server's `is_video_seekable` for this chapter. Default locked. */
  readonly seekUnlocked = input(false);
  /** The server's completion verdict for this chapter. Default not-complete. */
  readonly completed = input(false);
  readonly userAssessmentDetails = input<CourseDetailCard['user_assessment_details'] | undefined>(
    undefined,
  );
  readonly courseId = input<CairaUuid | null>(null);
  readonly courseType = input<string>('masterclass');

  readonly navigate = output<CairaUuid>();
  readonly startFinalAssessment = output<void>();
  readonly viewFinalAssessmentReport = output<void>();

  // Video events outputs
  readonly paused = output<void>();
  readonly ended = output<void>();
  readonly videoExit = output<{ duration: number; currentTime: number }>();
  readonly timeUpdate = output<{ duration: number; currentTime: number }>();

  private readonly videoPlayer = viewChild(VideoJs);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(Dialog);
  private readonly analytics = inject(Analytics);

  readonly currentProgress = signal(0);

  // Track last known time for destroy handler
  private lastTime = 0;
  private lastDuration = 0;

  // Analytics: per-chapter video-milestone dedup (reset on chapter change).
  private videoTrackedChapter: CairaUuid | null = null;
  private videoStartFired = false;
  private readonly firedVideoMilestones = new Set<number>();
  private static readonly VIDEO_MILESTONES = [25, 50, 75, 90] as const;

  /**
   * Free seeking. The server owns this verdict (`Is_Video_Seekable`) — it is
   * forced open on a closed course, so re-deriving it from completion here
   * would lock learners the backend has already let through.
   */
  readonly progressUnlocked = computed(() => !this.cpeMode() || this.seekUnlocked());

  /** Whether the learner may move on. Outside CPE mode nothing holds them. */
  readonly canAdvance = computed(() => !this.cpeMode() || this.completed());

  /** The final assessment is a CPE-mode gate — it needs the chapter finished. */
  readonly canStartExam = computed(() => this.cpeMode() && this.completed());

  constructor() {
    // Initialize progress from chapter data if available
    effect(() => {
      const chapter = this.current();

      if (chapter) {
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
      if (!chapter?.hls_video_url) return [];

      const url = chapter.hls_video_url;
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

  /**
   * ponytail: the in-player quiz hand-off lived here and gated on
   * `quiz_details.questions`, which no CAIRA mapper produces — the condition
   * was structurally always false, so the branch never ran. `ChapterQuiz` also
   * needs per-question `user_selected_option` from #7 (P5), which does not
   * exist yet. When #7 lands, gate on `ChapterView.show_quiz` — already
   * surfaced as `ChapterProgress.showQuiz`.
   */
  handleVideoEnded() {
    this.ended.emit();
    this.syncVideoTracking();
    if (!this.firedVideoMilestones.has(100)) {
      this.firedVideoMilestones.add(100);
      this.analytics.trackEvent('video_complete', this.videoEventParams());
    }

    if (!this.cpeMode()) {
      const nextChapter = this.next();
      if (nextChapter) {
        this.navigate.emit(nextChapter.id);
      } else {
        // Last chapter — reset player to start
        this.videoPlayer()?.seek(0);
        this.videoPlayer()?.pause();
      }
    }
  }

  /**
   * #4 already carries `transcript_text` on every unlocked chapter, so there is
   * nothing to fetch. This used to call a second endpoint through a facade that
   * no longer exists, which threw on every click.
   */
  openTranscript() {
    const chapter = this.current();
    if (!chapter?.transcript_text) return;

    this.dialog.open<HtmlContentDialog, HtmlContentDialogData>(HtmlContentDialog, {
      maxWidth: '100%',
      data: {
        title: `Transcript - ${chapter.chapter_name}`,
        htmlContent: chapter.transcript_text,
      },
    });
  }
}
