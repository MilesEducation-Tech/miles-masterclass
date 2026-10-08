import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { logo } from '@core/constants/icon';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';
import { durationParts } from '@features/offerings/masterclass/utils/duration-parts';

/**
 * The course page's About section, from `course-detail/`. Its design is the
 * masterclass branch of the shared `CourseAbout`, class for class; that one
 * stays on the legacy `ContentDetails` for podcast, micro-learning and webinar.
 *
 * The course comes from the nearest `CourseDetailFacade`: the course route's on
 * the page, the dialog's own in the "i" dialog.
 *
 * Course Duration is the API's preformatted `masterclass_duration` ("3 hours");
 * Video Duration is `masterclass_duration_seconds`, the sum of the chapter
 * videos — they differ, as on production.
 *
 * Held back until the API covers it (`docs/MASTERCLASS_API_QUESTIONS.md`): the
 * learning pathway card. Instructors aren't links yet, because the instructor
 * page still reads legacy numeric ids.
 */
@Component({
  selector: 'app-masterclass-course-about',
  imports: [DatePipe, NgOptimizedImage, NgIcon, CategoriesList, DurationPipe],
  templateUrl: './masterclass-course-about.html',
})
export class MasterclassCourseAbout {
  protected readonly course = inject(CourseDetailFacade).course;

  protected readonly icons = { logo };

  protected readonly duration = computed(() => {
    const course = this.course();
    return course ? durationParts(course.masterclass_duration) : null;
  });
}
