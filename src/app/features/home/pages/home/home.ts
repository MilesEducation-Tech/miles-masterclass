import { Component, inject } from '@angular/core';
import { swiperConfigEven } from '@core/config/swiper.config';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { MasterclassHomeFacade } from '@core/services/masterclass-home-facade/masterclass-home-facade';
import { AppDownload } from '@shared/components/app-download/app-download';
import { CairaLevelStack } from '@shared/components/caira-level-stack/caira-level-stack';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Carousel } from '@shared/components/carousel/carousel';
import { Faq } from '@shared/components/faq/faq';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SurroundCarousel } from '@shared/components/surround-carousel/surround-carousel';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { HomeHero } from '../../components/home-hero/home-hero';
import { HomePricing } from '../../components/home-pricing/home-pricing';

/**
 * The home page, in the v3 section order: hero, the masterclass track rails,
 * the AI Labs ring, the CAIRA levels, the pricing card, the app download and the FAQ.
 * The rails come from the root `MasterclassHomeFacade`, the same read `/masterclass`
 * renders, so moving between the two pages never refetches.
 *
 * Not here yet (see prompts/home-redesign.md): the live-webinar ticket, which
 * needs a web-api highlight endpoint; and the pricing card shows no figures
 * until the plan-price source is confirmed. Both are flagged, not wired to v2.
 */
@Component({
  selector: 'app-home',
  imports: [
    AppDownload,
    Button,
    CairaLevelStack,
    Carousel,
    Faq,
    HomeHero,
    HomePricing,
    MasterclassCourseCard,
    SectionNav,
    SurroundCarousel,
  ],
  templateUrl: './home.html',
})
export class Home {
  private readonly utils = inject(Utils);

  protected readonly home = inject(MasterclassHomeFacade);

  // Every rail is horizontal cards, so one swiper preset serves them all.
  protected readonly swiperConfigEven = swiperConfigEven;

  /** The sidenav. "Live Webinar" joins the list with its ticket (its own PR). */
  protected readonly sectionNavItems: SectionNavItem[] = [
    { id: 'home-hero', label: 'Home', visible: true, icon: 'lucideHome' },
    { id: 'home-masterclasses', label: 'Master Classes', visible: true, icon: 'lucidePlay' },
    { id: 'model-carousel', label: 'AI Labs', visible: true, icon: 'lucideLayers' },
    { id: 'caira-levels', label: 'CAIRA', visible: true, icon: 'lucideGraduationCap' },
    { id: 'plan', label: 'Pricing', visible: true, icon: 'lucideStar' },
    { id: 'app-download', label: 'Download App', visible: true, icon: 'lucideLink' },
    { id: 'faq', label: 'FAQ', visible: true, icon: 'lucideHelpCircle' },
  ];

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.title);
  }
}
