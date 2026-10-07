import { Component, computed, inject } from '@angular/core';
import { swiperConfigEven, swiperConfigOdd } from '@core/config/swiper.config';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { MasterclassHomeFacade } from '@core/services/masterclass-home-facade/masterclass-home-facade';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Carousel } from '@shared/components/carousel/carousel';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SliderSkeleton } from '@shared/components/skeleton/slider-skeleton/slider-skeleton';
import { Slider } from '@shared/components/slider/slider';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import {
  MASTERCLASS_SECTION_NAV,
  MASTERCLASS_TRACKS_SECTION_ID,
} from '@features/offerings/masterclass/constants/masterclass-nav';
// Type-only: the dialog itself loads with `import()` when opened (AGENTS.md §4.4).
import type { MasterclassCourseInfoDialogData } from '@features/offerings/masterclass/models/masterclass-course.model';

/**
 * The masterclass landing page: the hero, then one carousel per track from
 * `tracks-page/`. The tracks come from the root `MasterclassHomeFacade`, which
 * the home page shares, so navigating between the two does not refetch.
 */
@Component({
  selector: 'app-masterclass',
  imports: [Carousel, Faq, SectionNav, Slider, SliderSkeleton, Button, MasterclassCourseCard],
  templateUrl: './masterclass.html',
})
export class Masterclass {
  private readonly utils = inject(Utils);
  private readonly dialogs = inject(NgpDialogManager);

  /**
   * The hero is deliberately left exactly as it was, on its legacy feed — it
   * is out of this rebind's scope. Move it with its own ticket.
   */
  private readonly feature = inject(FeatureFacade);
  protected readonly popular = this.feature.getResource('popular', 'masterclass');

  protected readonly home = inject(MasterclassHomeFacade);

  constructor() {
    // MIL-23: this page renders the tracks on the server (a crawler gets the
    // track list; the browser reuses the response). The home page does not.
    this.home.fetchOnServer.set(true);
  }

  // Even tracks render vertical cards (more per view), odd ones horizontal.
  protected readonly swiperConfigEven = swiperConfigEven;
  protected readonly swiperConfigOdd = swiperConfigOdd;

  protected readonly sectionNavItems = computed<SectionNavItem[]>(() =>
    MASTERCLASS_SECTION_NAV.map((item) =>
      item.id === MASTERCLASS_TRACKS_SECTION_ID
        ? { ...item, visible: this.home.tracks().length > 0 }
        : item,
    ),
  );

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.title);
  }

  /** The "i" dialog: the course's About, read when it opens. Loaded on first use. */
  protected async openCourseInfo(course: MasterclassCourse): Promise<void> {
    const { MasterclassCourseInfoDialog } =
      await import('@features/offerings/masterclass/dialogs/masterclass-course-info-dialog/masterclass-course-info-dialog');
    this.dialogs.open<MasterclassCourseInfoDialogData>(MasterclassCourseInfoDialog, {
      data: { course },
    });
  }
}
