import {
  Component,
  computed,
  input,
  output,
  effect,
  viewChild,
  inject,
  DestroyRef,
  model,
} from '@angular/core';
import { AudioJs } from '../../../../../shared/components/audio-js/audio-js';
import {
  PlayerMode,
  VideoConfig,
  VideoSource,
} from '../../../../../shared/core/models/video-player.model';
import { ChapterSkeleton } from '../../../../../shared/components/skeleton/chapter-skeleton/chapter-skeleton';

import { RecordDisk } from '../../../../../shared/components/record-disk/record-disk';
import { Analytics } from '../../../../../shared/core/services/analytics/analytics';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { faClipboard } from '@ng-icons/font-awesome/regular';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import {
  ChapterView,
  CourseDetailCard,
} from '../../../../../shared/core/models/caira/course-detail.model';

@Component({
  selector: 'app-audio-chapter',
  imports: [AudioJs, ChapterSkeleton, NgIcon, RecordDisk],
  templateUrl: './audio-chapter.html',
  styleUrl: './audio-chapter.css',
  providers: [provideIcons({ faClipboard })],
  host: {
    class: 'block w-full h-full',
  },
})
export class AudioChapter {
  // --- Inputs ---
  readonly current = model<ChapterView | null>(null);
  readonly previous = input<ChapterView | null>(null);
  readonly next = input<ChapterView | null>(null);
  readonly cpeMode = input(false);
  /** The server's `is_video_seekable` for this chapter. Default locked. */
  readonly seekUnlocked = input(false);
  readonly chapterIndex = input(0);
  /** The server's completion verdict for this chapter. Default not-complete. */
  readonly completed = input(false);
  readonly userAssessmentDetails = input<CourseDetailCard['user_assessment_details'] | undefined>(
    undefined,
  );

  // --- Outputs ---
  readonly navigate = output<CairaUuid>();
  readonly startFinalAssessment = output<void>();
  readonly viewFinalAssessmentReport = output<void>();
  readonly paused = output<void>();
  readonly ended = output<void>();
  readonly audioExit = output<{ duration: number; currentTime: number }>();
  readonly timeUpdate = output<{ duration: number; currentTime: number }>();

  // --- Private ---
  private readonly audioPlayer = viewChild(AudioJs);
  private readonly destroyRef = inject(DestroyRef);
  private readonly analytics = inject(Analytics);

  private lastTime = 0;
  private lastDuration = 0;

  // Analytics: per-chapter media-milestone dedup (reset on chapter change).
  private mediaTrackedChapter: CairaUuid | null = null;
  private mediaStartFired = false;
  private readonly firedMediaMilestones = new Set<number>();
  private static readonly MEDIA_MILESTONES = [25, 50, 75, 90] as const;

  // --- Computed State ---
  readonly trackLabel = computed(() => {
    const idx = this.chapterIndex();
    return `Track ${String(idx + 1).padStart(2, '0')}`;
  });

  /** Free seeking — the server's verdict, same rule as `VideoChapter`. */
  readonly progressUnlocked = computed(() => !this.cpeMode() || this.seekUnlocked());

  /** Same two gates as `VideoChapter`. */
  readonly canAdvance = computed(() => !this.cpeMode() || this.completed());
  readonly canStartExam = computed(() => this.cpeMode() && this.completed());

  readonly audioSource = computed<VideoSource[]>(
    () => {
      const chapter = this.current();
      // CAIRA serves one media URL per chapter whatever the format — the
      // Django-era `audio_url`/`video_url` pair has no counterpart.
      const url = chapter?.hls_video_url;
      if (!url) return [];

      let type = 'audio/mpeg';
      if (url.endsWith('.m3u8')) {
        type = 'application/x-mpegURL';
      } else if (url.endsWith('.mp4')) {
        type = 'audio/mp4';
      } else if (url.endsWith('.ogg')) {
        type = 'audio/ogg';
      } else if (url.endsWith('.wav')) {
        type = 'audio/wav';
      }
      return [{ src: url, type }];
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  readonly playerMode = computed(() =>
    this.progressUnlocked() ? PlayerMode.DEFAULT : PlayerMode.CPE,
  );

  readonly audioConfig = computed<VideoConfig>(() => ({
    autoplay: false,
    fluid: false,
    controls: true,
  }));

  constructor() {
    // Same reason as `VideoChapter`: no stale `audioExit` after the chapter goes.
    effect(() => {
      if (!this.current()) {
        this.lastTime = 0;
        this.lastDuration = 0;
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.lastTime > 0) {
        this.audioExit.emit({
          currentTime: this.lastTime,
          duration: this.lastDuration,
        });
      }
    });
  }

  // --- Event Handlers ---

  handleTimeUpdate(event: { currentTime: number; duration: number }) {
    this.lastTime = event.currentTime;
    this.lastDuration = event.duration;
    if (event.duration > 0) {
      this.trackMediaProgress((event.currentTime / event.duration) * 100);
    }
    this.timeUpdate.emit(event);
  }

  /** Reset milestone dedup when the active chapter changes. */
  private syncMediaTracking(): void {
    const id = this.current()?.id ?? null;
    if (id !== this.mediaTrackedChapter) {
      this.mediaTrackedChapter = id;
      this.mediaStartFired = false;
      this.firedMediaMilestones.clear();
    }
  }

  private mediaEventParams(): Record<string, unknown> {
    return { course_type: 'podcast', chapter_id: this.current()?.id };
  }

  /** video_start once, then video_progress at 25/50/75/90% — each once per chapter. */
  private trackMediaProgress(progress: number): void {
    this.syncMediaTracking();
    if (!this.mediaStartFired && progress > 0) {
      this.mediaStartFired = true;
      this.analytics.trackEvent('video_start', this.mediaEventParams());
    }
    for (const m of AudioChapter.MEDIA_MILESTONES) {
      if (progress >= m && !this.firedMediaMilestones.has(m)) {
        this.firedMediaMilestones.add(m);
        this.analytics.trackEvent('video_progress', { ...this.mediaEventParams(), percent: m });
      }
    }
  }

  handleMetadataLoaded(_event: { duration: number }) {
    const chapter = this.current();
    if (
      this.cpeMode() &&
      chapter?.play_history &&
      !chapter.play_history.is_completed &&
      chapter.play_history.time_status
    ) {
      this.audioPlayer()?.seek(chapter.play_history.time_status, true);
    }
  }

  /** ponytail: the quiz hand-off is gone — see the note in `VideoChapter`. */
  handleAudioEnded() {
    this.ended.emit();
    this.syncMediaTracking();
    if (!this.firedMediaMilestones.has(100)) {
      this.firedMediaMilestones.add(100);
      this.analytics.trackEvent('video_complete', this.mediaEventParams());
    }

    if (!this.cpeMode()) {
      this.audioPlayer()?.seek(0);
      this.audioPlayer()?.pause();
    }
  }
}
