import { Component, input, signal } from '@angular/core';
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

  // ponytail: MasterclassFacade was deleted with the Django strip. This placeholder

  // keeps the template bindings compiling and renders the empty state.

  // Swap in the new backend's service — the template needs no changes.

  readonly masterclass: any = {
    courseChapters: signal<any[]>([]),

    courseDetails: signal<any[]>([]),

    navigateToChapter: (..._args: any[]): any => null,
  };

  getChapterCompletedStatus(chapterId: number) {
    return (
      (this.masterclass.courseDetails()?.cpe_mode_details?.cpe_mode === true &&
        this.masterclass
          .courseDetails()
          ?.chapter_wise_details?.find((chapter: any) => chapter.chapter_id === chapterId)
          ?.status) ||
      (this.masterclass.courseDetails()?.cpe_mode_details?.cpe_mode === false &&
        this.masterclass.courseChapters()?.find((chapter: any) => chapter.id === chapterId)
          ?.play_history?.is_completed)
    );
  }
}
