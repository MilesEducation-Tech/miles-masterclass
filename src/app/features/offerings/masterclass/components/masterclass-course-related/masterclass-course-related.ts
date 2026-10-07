import { NgOptimizedImage } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { swiperConfigEven } from '@core/config/swiper.config';
import { Carousel } from '@shared/components/carousel/carousel';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { Button } from '@shared/ui/button/button';
import { MasterclassRelatedRail } from '@features/offerings/masterclass/models/masterclass-course.model';

/**
 * The course page's Related section: "Related Courses" and one "More by" rail
 * per instructor, as the shared `CourseRelatedSection` lays them out for a
 * masterclass. The cards are the shared horizontal design, drawn inline, since
 * these API courses carry no trailer or badges for the course card to show.
 * Each links to its own course page.
 */
@Component({
  selector: 'app-masterclass-course-related',
  imports: [NgOptimizedImage, RouterLink, Carousel, CategoriesList, Button],
  templateUrl: './masterclass-course-related.html',
})
export class MasterclassCourseRelated {
  readonly rails = input.required<MasterclassRelatedRail[]>();

  protected readonly swiperConfig = swiperConfigEven;
}
