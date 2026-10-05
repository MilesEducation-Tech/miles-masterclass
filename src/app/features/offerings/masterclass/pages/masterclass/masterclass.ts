import { Component, computed, inject } from '@angular/core';
import { swiperConfigEven, swiperConfigOdd } from '@core/config/swiper.config';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { Carousel } from '@shared/components/carousel/carousel';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SliderSkeleton } from '@shared/components/skeleton/slider-skeleton/slider-skeleton';
import { Slider } from '@shared/components/slider/slider';
import { Button } from '@shared/ui/button/button';
import { MasterclassCourseCard } from '@features/offerings/masterclass/components/masterclass-course-card/masterclass-course-card';
import {
  MASTERCLASS_SECTION_NAV,
  MASTERCLASS_TRACKS_SECTION_ID,
} from '@features/offerings/masterclass/constants/masterclass-nav';
import { MasterclassHomeFacade } from '@features/offerings/masterclass/services/masterclass-home-facade';

/**
 * The masterclass landing page: the hero, then one carousel per track from
 * `home-page/`. The tracks' data, loading and error state, and the trailer
 * action all live in `MasterclassHomeFacade`.
 */
@Component({
  selector: 'app-masterclass',
  imports: [Carousel, Faq, SectionNav, Slider, SliderSkeleton, Button, MasterclassCourseCard],
  templateUrl: './masterclass.html',
})
export class Masterclass {
  protected readonly facade = inject(MasterclassHomeFacade);

  /**
   * The hero is deliberately left exactly as it was, on its legacy feed — it
   * is out of this rebind's scope. Move it with its own ticket.
   */
  private readonly feature = inject(FeatureFacade);
  protected readonly popular = this.feature.getResource('popular', 'masterclass');

  // Even tracks render vertical cards (more per view), odd ones horizontal.
  protected readonly swiperConfigEven = swiperConfigEven;
  protected readonly swiperConfigOdd = swiperConfigOdd;

  protected readonly sectionNavItems = computed<SectionNavItem[]>(() =>
    MASTERCLASS_SECTION_NAV.map((item) =>
      item.id === MASTERCLASS_TRACKS_SECTION_ID
        ? { ...item, visible: this.facade.tracks().length > 0 }
        : item,
    ),
  );
}
