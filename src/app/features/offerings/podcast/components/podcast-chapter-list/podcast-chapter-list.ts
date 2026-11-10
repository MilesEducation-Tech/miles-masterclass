import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAccessTimeRound,
  matDownloadDoneRound,
  matPlayArrowRound,
} from '@ng-icons/material-icons/round';
import { RecordDisk, RecordDiskConfig } from '@shared/components/record-disk/record-disk';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { Progress } from '@shared/ui/progress/progress';
import {
  isChapterWatched,
  MasterclassChapterLink,
  watchedPercent,
} from '@features/offerings/models/course-detail.model';
import { PODCAST_RECORD_DISK } from '@features/offerings/podcast/constants/podcast';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The podcast course page's chapters: the masterclass list's rows, links and
 * states (watched share, Completed, duration) with the podcast artwork, a
 * square record disk that spins once the chapter is started. The chapters come
 * from `CourseDetailFacade`.
 */
@Component({
  selector: 'app-podcast-chapter-list',
  imports: [RouterLink, NgIcon, DurationPipe, Progress, RecordDisk],
  templateUrl: './podcast-chapter-list.html',
  providers: [provideIcons({ matAccessTimeRound, matDownloadDoneRound, matPlayArrowRound })],
})
export class PodcastChapterList {
  protected readonly chapters = inject(CourseDetailFacade).chapters;
  protected readonly isChapterWatched = isChapterWatched;
  protected readonly watchedPercent = watchedPercent;

  /** Square artwork first, as the podcast list has always shown it. */
  protected artwork(chapter: MasterclassChapterLink): string {
    return chapter.square_thumbnail_url ?? chapter.horizontal_thumbnail_url ?? '';
  }

  /** The disk spins once the chapter has been started. */
  protected disk(started: boolean): RecordDiskConfig {
    return { ...PODCAST_RECORD_DISK, animate: started, slideOut: true };
  }
}
