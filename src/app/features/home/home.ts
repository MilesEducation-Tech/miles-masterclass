import { Component, inject, computed } from '@angular/core';
import { environment } from '@env/environment';
import { Carousel } from '@shared/components/carousel/carousel';
import { Horizontal } from '@shared/components/cards/horizontal/horizontal';
import { Vertical } from '@shared/components/cards/vertical/vertical';
import { FeatureFacade } from '@core/services/feature-facade/feature-facade';
import { ComingSoon } from '@shared/components/cards/coming-soon/coming-soon';
import {
  swiperConfigComingSoon,
  swiperConfigEven,
  swiperConfigOdd,
} from '@core/config/swiper.config';
import { AppDownload } from '@shared/components/app-download/app-download';
import { HomeHero } from './components/home-hero/home-hero';
import { Offering } from './components/offerings/offerings';
import { SectionNav, SectionNavItem } from '@shared/components/section-nav/section-nav';
import { PartnerContentList } from '@shared/components/partner-content-list/partner-content-list';
import { Faq } from '@shared/components/faq/faq';
import { PlanBenefits, PlanPointer } from '@shared/components/plan-benefits/plan-benefits';
import { Button } from '@shared/ui/button/button';
import { Router } from '@angular/router';
import { Utils } from '@shared/services/utils';
import { CairaLevelStack } from '@shared/components/caira-level-stack/caira-level-stack';
import { SurroundCarousel } from '@shared/components/surround-carousel/surround-carousel';

@Component({
  selector: 'app-home',
  imports: [
    Carousel,
    Horizontal,
    Vertical,
    ComingSoon,
    AppDownload,
    HomeHero,
    Offering,
    SectionNav,
    PartnerContentList,
    Faq,
    PlanBenefits,
    Button,
    CairaLevelStack,
    SurroundCarousel,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;
  readonly feature: FeatureFacade = inject(FeatureFacade);
  readonly router = inject(Router);
  private readonly utils = inject(Utils);

  /**
   * Navigate to the subscription-plan picker. Builds the absolute path from
   * `Utils.country()` / `Utils.profession()` instead of relative `../..` since
   * `router.navigate` without a `relativeTo: ActivatedRoute` resolves
   * `..` against the route root, which produced a broken path.
   */
  goToPlan(): void {
    this.router.navigate(['/', this.utils.country(), this.utils.profession(), 'payment', 'plan']);
  }

  // Swiper configurations for templates
  readonly swiperConfigEven = swiperConfigEven;
  readonly swiperConfigOdd = swiperConfigOdd;
  readonly swiperConfigComingSoon = swiperConfigComingSoon;

  filterConfig = {
    filterEnabled: true,
  };

  readonly track = this.feature.getResource('track', 'masterclass');
  readonly premiere = this.feature.getResource('premiere', 'masterclass');
  readonly comingSoon = this.feature.getResource('comingSoon', 'masterclass');

  readonly sectionNavItems = computed<SectionNavItem[]>(() => {
    return [
      {
        id: 'home-hero',
        label: 'Home',
        visible: true,
        icon: 'lucideHome',
      },
      {
        id: 'home-masterclasses',
        label: 'Miles Masterclass',
        visible: true,
        icon: 'lucidePlay',
      },
      {
        id: 'model-carousel',
        label: 'AI Labs',
        visible: true,
        icon: 'lucideLayers',
      },
      {
        id: 'offerings',
        label: 'Offerings',
        visible: true,
        icon: 'lucideBookOpen',
      },
      {
        id: 'app-download',
        label: 'Download App',
        visible: true,
        icon: 'lucideLink',
      },
      {
        id: 'plan',
        label: 'Plans',
        visible: true,
        icon: 'lucideStar',
      },
      {
        id: 'faq',
        label: 'FAQ',
        visible: true,
        icon: 'lucideHelpCircle',
      },
    ];
  });
  planPointers: PlanPointer[] = [
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
}
