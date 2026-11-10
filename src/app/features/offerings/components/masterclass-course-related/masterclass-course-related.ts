import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { swiperConfigEven } from '@core/config/swiper.config';
import { Carousel } from '@shared/components/carousel/carousel';
import { CategoriesList } from '@shared/components/categories-list/categories-list';
import { Button } from '@shared/ui/button/button';
import { CourseDetailFacade } from '@features/offerings/services/course-detail-facade';

/**
 * The course page's Related section: "Related Courses" and one "More by" rail
 * per instructor, as the shared `CourseRelatedSection` lays them out for a
 * masterclass. The cards are the shared horizontal design, drawn inline, since
 * these API courses carry no trailer or badges for the course card to show.
 * Each links to its own course page. The rails come from `CourseDetailFacade`.
 */
@Component({
  selector: 'app-masterclass-course-related',
  imports: [NgOptimizedImage, RouterLink, Carousel, CategoriesList, Button],
  templateUrl: './masterclass-course-related.html',
})
export class MasterclassCourseRelated {
  protected readonly rails = inject(CourseDetailFacade).relatedRails;

  protected readonly swiperConfig = swiperConfigEven;
}
