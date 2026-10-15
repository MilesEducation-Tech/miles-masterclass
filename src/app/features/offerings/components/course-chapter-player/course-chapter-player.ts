import { Component, computed, effect, inject, untracked, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { VideoJs } from '@shared/components/video-js/video-js';
import { ChapterSkeleton } from '@shared/components/skeleton/chapter-skeleton/chapter-skeleton';
import { ChapterQuiz } from '@features/offerings/components/chapter-quiz/chapter-quiz';
import { QUIZ_COPY } from '@features/offerings/constants/course-detail';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';
import { CourseChapterQuizFacade } from '@features/offerings/services/course-chapter-quiz-facade';

/**
 * The chapter player for a course on the offerings' web API: the video, the
 * chapter's text, the previous and next chapters, the transcript, and the
 * chapter quiz, which takes the video's place while it is open.
 *
 * It reads and calls `CourseChapterFacade` and `CourseChapterQuizFacade`. The
 * legacy `video-chapter` stays as it is for podcast, whose API hasn't moved; it
 * goes once podcast joins this one.
 */
@Component({
  selector: 'app-course-chapter-player',
  imports: [VideoJs, ChapterSkeleton, ChapterQuiz, NgOptimizedImage],
  templateUrl: './course-chapter-player.html',
  host: {
    class: 'flex w-full h-full max-md:overflow-auto flex-col md:overflow-hidden',
  },
})
export class CourseChapterPlayer {
  protected readonly facade = inject(CourseChapterFacade);
  protected readonly quiz = inject(CourseChapterQuizFacade);
  protected readonly quizCopy = QUIZ_COPY;
  private readonly player = viewChild(VideoJs);

  constructor() {
    // The video stays mounted under the quiz (so "Watch again" doesn't reload
    // the stream), and mustn't play on unseen.
    effect(() => {
      const player = this.player();
      if (this.quiz.isOpen()) untracked(() => player?.pause());
    });
  }

  /** `hls_video_url` is HLS by contract; `null` (a locked course) plays nothing. */
  protected readonly videoSource = computed<VideoSource[]>(
    () => {
      const url = this.facade.current()?.hls_video_url;
      return url ? [{ src: url, type: 'application/x-mpegURL' }] : [];
    },
    // A re-read of the same chapter must not reload the stream mid-play.
    { equal: (a, b) => a[0]?.src === b[0]?.src },
  );

  protected readonly videoConfig = computed<VideoConfig>(() => ({
    poster: this.facade.current()?.horizontal_thumbnail_url ?? undefined,
    autoplay: false,
    fluid: true,
    controls: true,
  }));

  /** CPE mode disables the scrubber until the facade allows seeking. */
  protected readonly playerMode = computed(() =>
    this.facade.canSeek() ? PlayerMode.DEFAULT : PlayerMode.CPE,
  );

  protected onMetadataLoaded(): void {
    const at = this.facade.resumeAt();
    // Forced: CPE mode's own seek guard would otherwise refuse the resume.
    if (at > 0) this.player()?.seek(at, true);
  }

  /** Preview mode may rewind; CPE mode stays, and the chapter quiz comes next. */
  protected async onEnded(): Promise<void> {
    if (await this.facade.videoEnded()) {
      this.player()?.seek(0, true);
      this.player()?.pause();
      return;
    }
    this.quiz.videoEnded();
  }
}
