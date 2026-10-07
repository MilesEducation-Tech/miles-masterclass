import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matAccessTimeRound, matPlayArrowRound } from '@ng-icons/material-icons/round';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { MasterclassChapterLink } from '@features/offerings/masterclass/models/masterclass-course.model';

/**
 * The course page's Masterclass section: one row per chapter, the masterclass
 * branch of the shared `CourseChapterList` class for class. That one stays on
 * the legacy facade for podcast.
 *
 * Rows are links to the chapter page rather than the old `role="button"` divs.
 * The progress, completed and lock states come with the signed-in read.
 */
@Component({
  selector: 'app-masterclass-chapter-list',
  imports: [NgOptimizedImage, RouterLink, NgIcon, DurationPipe],
  templateUrl: './masterclass-chapter-list.html',
  providers: [provideIcons({ matAccessTimeRound, matPlayArrowRound })],
})
export class MasterclassChapterList {
  readonly chapters = input.required<MasterclassChapterLink[]>();
}
