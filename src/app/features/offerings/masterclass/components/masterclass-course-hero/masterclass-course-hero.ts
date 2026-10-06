import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matPlayArrowRound } from '@ng-icons/material-icons/round';
import { phosphorShareFatFill } from '@ng-icons/phosphor-icons/fill';
import { phosphorCards } from '@ng-icons/phosphor-icons/regular';
import { CairaCredlyBadge } from '@shared/components/cards/caira-credly-badge/caira-credly-badge';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { VideoPoster } from '@shared/components/video-poster/video-poster';
import { Button } from '@shared/ui/button/button';
import { MasterclassAboutCourse } from '@features/offerings/masterclass/models/masterclass-course.model';

/**
 * The course page's hero. Presentational: it renders the course it is given and
 * emits what the learner asked for; the page hands each event to the facade.
 *
 * Held back until the web API covers them (`docs/MASTERCLASS_API_QUESTIONS.md`):
 * the CPE/Preview mode switch, price and Add To Cart, the created/updated dates,
 * and Download. Bookmark and the signed-in progress, rating and final-assessment
 * actions come with their own reads.
 */
@Component({
  selector: 'app-masterclass-course-hero',
  imports: [NgOptimizedImage, NgIcon, Button, VideoPoster, CategoriesList, CairaCredlyBadge],
  templateUrl: './masterclass-course-hero.html',
  providers: [provideIcons({ matPlayArrowRound, phosphorCards, phosphorShareFatFill })],
})
export class MasterclassCourseHero {
  readonly course = input.required<MasterclassAboutCourse>();

  readonly watch = output();
  readonly trailer = output();
  readonly sample = output();
  readonly share = output();

  protected readonly instructorNames = computed(() =>
    this.course()
      .instructors.map((instructor) => instructor.name)
      .join(', '),
  );
}
