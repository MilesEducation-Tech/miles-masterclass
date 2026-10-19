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
import { AudioJs } from '@shared/components/audio-js/audio-js';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { ChapterSkeleton } from '@shared/components/skeleton/chapter-skeleton/chapter-skeleton';
import { RecordDisk } from '@shared/components/record-disk/record-disk';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { faClipboard } from '@ng-icons/font-awesome/regular';

@Component({
  selector: 'app-audio-chapter',
  imports: [AudioJs, ChapterSkeleton, NgIcon, RecordDisk],
  templateUrl: './audio-chapter.html',
  providers: [provideIcons({ faClipboard })],
  host: {
    class: 'block w-full h-full',
  },
})
export class AudioChapter {
  // --- Inputs ---
  readonly current = model<CourseChapter | null>(null);
  readonly previous = input<CourseChapter | null>(null);
  readonly next = input<CourseChapter | null>(null);
  readonly cpeMode = input(false);
  readonly chapterIndex = input(0);
  readonly chapterWiseDetails = input<ChapterWiseDetails | undefined>(undefined);
  readonly userAssessmentDetails = input<UserAssessmentDetails | undefined>(undefined);

  // --- Outputs ---
  readonly navigate = output<number>();
  readonly startFinalAssessment = output<void>();
  readonly viewFinalAssessmentReport = output<void>();
  readonly paused = output<void>();
  readonly ended = output<void>();
  readonly audioExit = output<{ duration: number; currentTime: number }>();
  readonly timeUpdate = output<{ duration: number; currentTime: number }>();

  // --- Private ---
  private readonly audioPlayer = viewChild(AudioJs);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentProgress = signal(0);
  private lastTime = 0;
  private lastDuration = 0;
  private lastChapterId = 0;

  // --- Computed State ---
  readonly trackLabel = computed(() => {
    const idx = this.chapterIndex();
    return `Track ${String(idx + 1).padStart(2, '0')}`;
  });

  readonly progressUnlocked = computed(() => {
    const currentChapter = this.current();
    if (!this.cpeMode()) return true;
    const isCompleted = currentChapter?.play_history?.is_completed;
    const isStatusCompleted = this.chapterWiseDetails()?.status;
    return isCompleted || isStatusCompleted;
  });

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

  /**
   * Whether the Next Chapter card is actionable. Outside CPE mode the next
   * chapter is always open; inside it, the current chapter has to be done
   * first. Lifted out of the template, where the same expression was inlined
   * four times (desktop + mobile, each in a class and a click binding).
   */
  readonly canGoToNextChapter = computed(
    () => (!!this.chapterWiseDetails()?.status && this.cpeMode()) || !this.cpeMode(),
  );

  /** Final assessment only opens in CPE mode once the chapter is complete. */
  readonly canStartFinalAssessment = computed(
    () => !!this.chapterWiseDetails()?.status && this.cpeMode(),
  );

  constructor() {
    effect(() => {
      const chapter = this.current();
      if (chapter) {
        if (chapter.id !== this.lastChapterId) this.lastChapterId = chapter.id;

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
    }
    this.timeUpdate.emit(event);
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

  handleAudioEnded() {
    this.ended.emit();

    // The chapter quiz that followed in CPE mode is unbound until the web API's
    // quiz is wired in, so CPE mode stays on the chapter.
    if (!this.cpeMode()) {
      this.audioPlayer()?.seek(0);
      this.audioPlayer()?.pause();
    }
  }
}
