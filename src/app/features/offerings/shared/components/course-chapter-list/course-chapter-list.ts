import { Component, inject, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAccessTimeRound,
  matDownloadDoneRound,
  matPlayArrowRound,
  matTimelapseRound,
} from '@ng-icons/material-icons/round';
import { DurationPipe } from '../../../../../shared/core/pipes/duration/duration-pipe';
import { Progress } from '../../../../../shared/components/ui/progress/progress';
import { RecordDisk } from '../../../../../shared/components/record-disk/record-disk';
import { CairaUuid } from '../../../../../shared/core/models/caira/envelope.model';
import { CourseDetail } from '../../services/course-detail/course-detail';

@Component({
  selector: 'app-course-chapter-list',
  imports: [NgOptimizedImage, NgIcon, DurationPipe, Progress, RecordDisk],
  templateUrl: './course-chapter-list.html',
  styleUrl: './course-chapter-list.css',
  providers: [
    provideIcons({
      matPlayArrowRound,
      matAccessTimeRound,
      matDownloadDoneRound,
      matTimelapseRound,
    }),
  ],
})
export class CourseChapterList {
  courseType = input<'masterclass' | 'podcast'>('masterclass');

  /** Route-scoped — the same instance the course page keys on the route id. */
  readonly masterclass = inject(CourseDetail);

  /**
   * Whether a chapter counts as watched.
   *
   * This used to branch on CPE vs Preview mode and read `chapter_wise_details`
   * in the CPE branch. CAIRA has no mode — completion is server-side on the
   * chapter's own progress row — so both branches collapse to one lookup.
   */
  getChapterCompletedStatus(chapterId: CairaUuid): boolean {
    return (
      this.masterclass.courseChapters().find((chapter) => chapter.id === chapterId)?.play_history
        ?.is_completed === true
    );
  }
}
