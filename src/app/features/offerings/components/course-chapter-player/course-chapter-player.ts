import { Component, computed, inject, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { PlayerMode, VideoConfig, VideoSource } from '@core/models/video-player.model';
import { VideoJs } from '@shared/components/video-js/video-js';
import { ChapterSkeleton } from '@shared/components/skeleton/chapter-skeleton/chapter-skeleton';
import { CourseChapterFacade } from '@features/offerings/services/course-chapter-facade';

/**
 * The chapter player for a course on the offerings' web API: the video, the
 * chapter's text, the previous and next chapters, and the transcript.
 *
 * It reads and calls `CourseChapterFacade` and nothing else. The legacy
 * `video-chapter` stays as it is for podcast, whose API hasn't moved; it goes
 * once podcast joins this one.
 */
@Component({
  selector: 'app-course-chapter-player',
  imports: [VideoJs, ChapterSkeleton, NgOptimizedImage],
  templateUrl: './course-chapter-player.html',
  host: {
    class: 'flex w-full h-full max-md:overflow-auto flex-col md:overflow-hidden',
  },
})
export class CourseChapterPlayer {
  protected readonly facade = inject(CourseChapterFacade);
  private readonly player = viewChild(VideoJs);

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

  protected onTimeUpdate(event: { currentTime: number; duration: number }): void {
    if (event.duration > 0) this.facade.videoProgress((event.currentTime / event.duration) * 100);
  }

  protected async onEnded(): Promise<void> {
    if (!(await this.facade.videoEnded())) return;
    this.player()?.seek(0, true);
    this.player()?.pause();
  }
}
