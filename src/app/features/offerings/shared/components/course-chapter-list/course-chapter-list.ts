import { Component, inject, input } from '@angular/core';
import { MasterclassFacade } from '../../services/masterclass-facade/masterclass-facade';
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

  readonly masterclass = inject(MasterclassFacade);

  getChapterCompletedStatus(chapterId: number) {
    return (
      (this.masterclass.courseDetails()?.cpe_mode_details?.cpe_mode === true &&
        this.masterclass
          .courseDetails()
          ?.chapter_wise_details?.find((chapter) => chapter.chapter_id === chapterId)?.status) ||
      (this.masterclass.courseDetails()?.cpe_mode_details?.cpe_mode === false &&
        this.masterclass.courseChapters()?.find((chapter) => chapter.id === chapterId)?.play_history
          ?.is_completed)
    );
  }
}
