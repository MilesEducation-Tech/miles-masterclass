import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { logo } from '@core/constants/icon';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { MasterclassAboutCourse } from '@features/offerings/masterclass/models/masterclass-course.model';
import { durationParts } from '@features/offerings/masterclass/utils/duration-parts';

/**
 * The course page's About section, from `about-course/`. Its design is the
 * masterclass branch of the shared `CourseAbout`, class for class; that one
 * stays on the legacy `ContentDetails` for podcast, micro-learning and webinar.
 *
 * Held back until the API covers them (`docs/MASTERCLASS_API_QUESTIONS.md`):
 * the learning pathway card, the created/reviewed/updated dates and the video
 * duration. Instructors aren't links yet, because the instructor page still
 * reads legacy numeric ids.
 */
@Component({
  selector: 'app-masterclass-course-about',
  imports: [NgOptimizedImage, NgIcon, CategoriesList],
  templateUrl: './masterclass-course-about.html',
})
export class MasterclassCourseAbout {
  readonly course = input.required<MasterclassAboutCourse>();

  protected readonly icons = { logo };

  protected readonly duration = computed(() => durationParts(this.course().total_duration));
}
