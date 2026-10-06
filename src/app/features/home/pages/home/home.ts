import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { swiperConfigEven } from '@core/config/swiper.config';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import { MasterclassHomeFacade } from '@core/services/masterclass-home-facade/masterclass-home-facade';
import { AppDownload } from '@shared/components/app-download/app-download';
import { CairaLevelStack } from '@shared/components/caira-level-stack/caira-level-stack';
import { MasterclassCourseCard } from '@shared/components/cards/masterclass-course-card/masterclass-course-card';
import { Carousel } from '@shared/components/carousel/carousel';
import { Faq } from '@shared/components/faq/faq';
import { PlanBenefits, PlanPointer } from '@shared/components/plan-benefits/plan-benefits';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { SurroundCarousel } from '@shared/components/surround-carousel/surround-carousel';
import { Utils } from '@shared/services/utils';
import { Button } from '@shared/ui/button/button';
import { HomeHero } from '../../components/home-hero/home-hero';

/**
 * The home page, in the v3 section order: hero, the masterclass track rails,
 * the AI Labs ring, the CAIRA levels, the plan, the app download and the FAQ.
 * The rails come from the root `MasterclassHomeFacade`, the same read `/masterclass`
 * renders, so moving between the two pages never refetches.
 *
 * Not here yet (see prompts/home-redesign.md): the live-webinar ticket, which
 * needs a web-api highlight endpoint, and the pricing card, which needs the
 * plan-price source confirmed. Both are flagged, not wired to v2.
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
    MasterclassCourseCard,
    PlanBenefits,
    SectionNav,
    SurroundCarousel,
  ],
  templateUrl: './home.html',
})
export class Home {
  protected readonly router = inject(Router);
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

  /** The plan section's copy, until the pricing card replaces it. */
  protected readonly planPointers: PlanPointer[] = [
    {
      id: 1,
      planfeature: {
        name: 'Full access to 22+ categories: Master Classes, Podcast, and Micro-learning Reels',
        description: null,
        icon: null,
      },
    },
    {
      id: 2,
      planfeature: {
        name: 'Watch on Desktop and Mobile Devices',
        description: null,
        icon: null,
      },
    },
    {
      id: 3,
      planfeature: {
        name: 'New Courses Added Every Month',
        description: null,
        icon: null,
      },
    },
    {
      id: 4,
      planfeature: {
        name: 'Pay Securely Using Major Credit Cards',
        description: null,
        icon: null,
      },
    },
    {
      id: 5,
      planfeature: {
        name: 'NASBA-Approved CPE Certificates',
        description: null,
        icon: null,
      },
    },
    {
      id: 6,
      planfeature: {
        name: 'Credly Digital Badge* to Share on LinkedIn',
        description: null,
        icon: null,
      },
    },
    {
      id: 7,
      planfeature: {
        name: 'Certified AI Ready Accountant Digital Badge',
        description: null,
        icon: null,
      },
    },
    {
      id: 8,
      planfeature: {
        name: 'Track Compliance with CPE Tracker',
        description: null,
        icon: null,
      },
    },
  ];

  /**
   * Navigate to the subscription-plan picker. Builds the absolute path from
   * `Utils.country()` / `Utils.profession()` instead of relative `../..` since
   * `router.navigate` without a `relativeTo: ActivatedRoute` resolves
   * `..` against the route root, which produced a broken path.
   */
  protected goToPlan(): void {
    void this.router.navigate([
      '/',
      this.utils.country(),
      this.utils.profession(),
      'payment',
      'plan',
    ]);
  }

  /** The shared video dialog; it toasts "Trailer Not Found" for a course with none. */
  protected openTrailer(course: MasterclassCourse): void {
    void this.utils.openVideoDialog(course.trailer_url, course.title);
  }
}
