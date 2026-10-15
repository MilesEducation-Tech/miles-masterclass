import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matAccessTimeRound,
  matDownloadDoneRound,
  matPlayArrowRound,
} from '@ng-icons/material-icons/round';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { Progress } from '@shared/ui/progress/progress';
import { isChapterWatched, watchedPercent } from '@features/offerings/models/course-detail.model';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The course page's Masterclass section: one row per chapter, the masterclass
 * branch of the shared `CourseChapterList` class for class. That one stays on
 * the legacy facade for podcast. The chapters come from `CourseDetailFacade`.
 *
 * Rows are links to the chapter page rather than the old `role="button"` divs.
 * A started chapter shows how much was watched, and a finished one says so; both
 * come with the signed-in read and follow each progress save without a reload.
 */
@Component({
  selector: 'app-masterclass-chapter-list',
  imports: [NgOptimizedImage, RouterLink, NgIcon, DurationPipe, Progress],
  templateUrl: './masterclass-chapter-list.html',
  providers: [provideIcons({ matAccessTimeRound, matDownloadDoneRound, matPlayArrowRound })],
})
export class MasterclassChapterList {
  protected readonly chapters = inject(CourseDetailFacade).chapters;
  protected readonly isChapterWatched = isChapterWatched;
  protected readonly watchedPercent = watchedPercent;
}
