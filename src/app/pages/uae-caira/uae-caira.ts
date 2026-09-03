import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { Faq } from '../../pages/faq/faq';
import { CairaLevelsSection } from './shared/components/caira-levels-section/caira-levels-section';
import { CairaWebinarSection } from './shared/components/caira-webinar-section/caira-webinar-section';
import { LocalTimeZonePipe } from './shared/pipes/local-time-zone.pipe';
import { AppDownload } from '../../features/home/components/app-download/app-download';
import { WebinarRegistrationForm } from '../../features/offerings/webinar/shared/components/webinar-registration-form/webinar-registration-form';
import {
  CairaStep,
  CairaStepsGrid,
} from '../../features/partners/shared/components/caira-steps-grid/caira-steps-grid';
import {
  CairaFeatureGrid,
  CairaFeatureItem,
} from '../../features/partners/shared/components/caira-feature-grid/caira-feature-grid';
import {
  PartnerContentItem,
  PartnerContentList,
} from '../../features/partners/shared/components/partner-content-list/partner-content-list';
import { WebinarFacade } from '../../features/offerings/webinar/shared/services/webinar-facade/webinar-facade';
import { nextSessionOf } from '../../features/offerings/webinar/shared/utils/webinar-status';
import {
  iconCairaBadge,
  iconCairaCpe,
  iconCairaLearn,
  iconCairaSignUp,
} from '../../features/partners/shared/models/caira-step-icons';

/**
 * UAE CAIRA marketing landing page.
 *
 * Rendered at `/<country>/accounting/home` for the country segments in
 * `uaeCairaMatchGuard` (currently `ae`); every other segment keeps the default
 * `Home`. The routing swap lives in `features.ts` via a `CanMatch` guard.
 *
 * Reuses the CAIRA presentation components from the partners feature
 * (`PartnerContentList`, `CairaFeatureGrid`, `CairaStepsGrid`) for the static
 * marketing sections, adds a library-driven CAIRA Levels 1/2/3 section, and
 * the platform webinar registration. See UAE_CAIRA_LANDING_PLAN.md.
 */
@Component({
  selector: 'app-uae-caira',
  imports: [
    DatePipe,
    PartnerContentList,
    CairaFeatureGrid,
    CairaStepsGrid,
    CairaLevelsSection,
    CairaWebinarSection,
    WebinarRegistrationForm,
    AppDownload,
    Faq,
    LocalTimeZonePipe,
  ],
  templateUrl: './uae-caira.html',
  styleUrl: './uae-caira.css',
})
export class UaeCaira {
  private readonly facade = inject(WebinarFacade);
  private readonly document = inject(DOCUMENT);
  private readonly S3 = environment.S3_BUCKET_URL;

  /** Live/next-up webinar powering the hero registration form. */
  protected readonly heroWebinar = this.facade.liveOrNextUp;
  protected readonly heroSession = computed(() => {
    const w = this.heroWebinar();
    return w ? nextSessionOf(w) : null;
  });

  constructor() {
    // Single load for the whole page; the hero form reads the facade signals.
    this.facade.loadHomePage();
  }

  /**
   * Scroll to the hero registration form. Uses `scrollIntoView` with
   * `behavior: 'instant'` so it works regardless of the user's "reduce motion"
   * setting (smooth scrolling is a no-op when reduced motion is enabled).
   */
  protected scrollToTop(): void {
    this.document
      .getElementById('uae-caira-top')
      ?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  /**
   * Marketing assets served from the Miles ImageKit CDN — all plain URLs, so
   * nothing needs to be imported into the app bundle.
   */
  private readonly IK = 'https://ik.imagekit.io/mileseducation/miles_website';
  protected readonly assets = {
    /** UAE-dressed CAIRA mascot (Emirati keffiyeh + thobe), points toward the form. */
    heroMascot: `${this.IK}/landing-pages/uae/desktop_ai.webp?tr=w-560,q-80`,
    // BannerCaira hero assets (ported from cpa-course caira_uae_page).
    bannerBgDesk: `${this.IK}/caira/new/new-ban-bg-desk.webp`,
    bannerBgMob: `${this.IK}/caira/new/new-ban-bg-mob.webp`,
    bannerBadge: `${this.IK}/caira/new/level3_badge.gif`,
    bannerLinkedIn: `${this.IK}/caira/new/linkedin-showcase.webp`,
    bannerLogo: `${this.IK}/caira/new/new-caira-logo.webp`,
    bannerShowcaseMob: `${this.IK}/caira/new/showcase.webp`,
  };

  /** Big-4 + global-bank logos for the "valued by leading firms" strip. */
  protected readonly partnerLogos: string[] = [
    `${this.IK}/accounting/cpa-visit-new/deloitte.webp`,
    `${this.IK}/accounting/cpa-visit-new/ey.webp`,
    `${this.IK}/accounting/cpa-visit-new/kpmg.webp`,
    `${this.IK}/accounting/cpa-visit-new/pwc.webp`,
    `${this.IK}/accounting/cpa-visit-new/hsbc.webp`,
    `${this.IK}/accounting/cpa-visit-new/deutsche_bank.webp`,
    `${this.IK}/accounting/cpa-visit-new/standard_charted.webp`,
    `${this.IK}/accounting/cpa-visit-new/wells_fargo.webp`,
  ];

  protected readonly heroContent: PartnerContentItem[] = [
    {
      heading: 'Become a Certified AI-Ready Accountant in the UAE',
      headingClass: 'text-white md:text-5xl text-3xl font-bold',
      itemClass: 'py-3',
    },
    {
      subHeading:
        'CAIRA is your LinkedIn-ready proof of AI-powered accounting skills — earn it across three levels.',
      subHeadingClass: 'text-white/85 md:text-xl text-base',
      itemClass: 'py-3 max-w-xl',
    },
  ];

  protected readonly featuresHeading: PartnerContentItem[] = [
    {
      heading: 'Get Certified. Get Noticed. Flex Your AI Readiness on LinkedIn!',
      headingClass: 'text-foreground md:text-4xl text-2xl font-semibold leading-tight',
      itemClass: 'text-center md:w-3/5 w-full mx-auto',
    },
  ];

  protected readonly features: CairaFeatureItem[] = [
    {
      title: '30 CPE Hours. Big Impact.',
      description:
        'A focused learning path designed to help you stay ahead in the AI-powered accounting era.',
      image: `${this.S3}static-assests/web-app/caira/caira-1a.webp`,
    },
    {
      title: 'Flex Your AI Readiness on LinkedIn',
      description:
        'Showcase your achievement with a Credly digital badge — verified, shareable proof of your AI readiness.',
      image: `${this.S3}static-assests/web-app/caira/caira-1b.webp`,
    },
    {
      title: 'Learn from Global Accounting & AI Leaders',
      description:
        'Gain insights, strategies, and frameworks from the industry pioneers shaping accounting and AI.',
      image: `${this.S3}static-assests/web-app/caira/caira-1c.webp`,
    },
  ];

  protected readonly stepsHeading: PartnerContentItem[] = [
    {
      heading: 'Your Path to Earning Your CAIRA Badge',
      headingClass: 'text-foreground md:text-4xl text-2xl font-semibold leading-tight',
      itemClass: 'text-center w-full',
    },
    {
      paragraph:
        'Develop high-impact, in-demand AI-driven skills that bridge accounting and AI — no prerequisites required.',
      paragraphClass: 'text-muted-foreground md:text-base text-sm',
      itemClass: 'text-center w-full mt-3',
    },
  ];

  protected readonly steps: CairaStep[] = [
    {
      title: 'Sign up & subscribe',
      description: 'Create your account, subscribe, and begin your CAIRA journey.',
      icon: iconCairaSignUp,
    },
    {
      title: 'Learn your way',
      description:
        'Binge Master Classes, swipe through reels, or tune into podcasts from global accounting leaders.',
      icon: iconCairaLearn,
    },
    {
      title: 'Complete your CPE hours',
      description: 'Track your progress as you learn using the CPE Tracker.',
      icon: iconCairaCpe,
    },
    {
      title: 'Earn your badge',
      description: 'Become a Certified AI-Ready Accountant and flex your Credly badge on LinkedIn.',
      icon: iconCairaBadge,
    },
  ];
}
