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
  readonly current = model<any | null>(null);
  readonly previous = input<any | null>(null);
  readonly next = input<any | null>(null);
  readonly cpeMode = input(false);
  /** The server's `is_video_seekable` for this chapter. Default locked. */
  readonly seekUnlocked = input(false);
  readonly chapterIndex = input(0);
  readonly chapterWiseDetails = input<any | undefined>(undefined);
  readonly userAssessmentDetails = input<any | undefined>(undefined);

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

  readonly currentProgress = signal(0);
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

  readonly audioSource = computed<VideoSource[]>(
    () => {
      const chapter = this.current();
      const url = chapter?.audio_url || chapter?.video_url;
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
      const progress = (event.currentTime / event.duration) * 100;
      this.currentProgress.set(progress);
      this.trackMediaProgress(progress);
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
