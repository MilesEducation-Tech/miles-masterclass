import { Component } from '@angular/core';
import { VideoListWrapper } from '../../components/video-list-wrapper/video-list-wrapper';
import {
  PartnerContentItem,
  PartnerContentList,
} from '@shared/components/partner-content-list/partner-content-list';
import {
  PartnershipContent,
  PartnershipContentInput,
} from '../../components/partnership-content/partnership-content';
import {
  CairaFeatureGrid,
  type CairaFeatureItem,
} from '@shared/components/caira-feature-grid/caira-feature-grid';
import {
  CairaStepsGrid,
  type CairaStep,
} from '@shared/components/caira-steps-grid/caira-steps-grid';
import {
  iconCairaBadge,
  iconCairaCpe,
  iconCairaLearn,
  iconCairaSignUp,
} from '@core/constants/caira-step-icons';
import { environment } from '@env/environment';
import { Faq } from '@shared/components/faq/faq';

@Component({
  selector: 'app-caira-landing',
  imports: [
    VideoListWrapper,
    PartnerContentList,
    PartnershipContent,
    CairaFeatureGrid,
    CairaStepsGrid,
    Faq,
  ],
  templateUrl: './caira-landing.html',
  styleUrl: './caira-landing.css',
})
export class CairaLanding {
  private readonly S3_BUCKET_URL = environment.S3_BUCKET_URL;

  // Reuses the home-hero clip so CAIRA's hero stays visually consistent with
  // the landing page CTA module. The portrait `hero-bg-mob` swaps in below md
  // so the aspect-9/16 mobile container shows a phone-shaped frame instead of
  // a cropped landscape one.
  protected readonly videoList = [
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero-web.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo.webp`,
      mobileVideoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/hero-bg-mob.mp4`,
      mobilePosterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero-sm.webp`,
    },
  ];

  protected readonly heroContent: PartnerContentItem[] = [
    {
      heading: 'Your LinkedIn Flex: Certified AI Ready Accountant',
      headingClass: 'text-white md:text-5xl text-3xl font-bold',
      itemClass: 'py-4',
    },
    {
      subHeading:
        'Earn your CAIRA Level 1 badge, flex your AI-powered skills, and let your profile do the talking! The future belongs to the AI-ready.',
      subHeadingClass: 'text-white text-xl font-semibold tracking-[0.2em]',
      itemClass: 'py-4 w-full mx-auto',
    },
  ];

  protected readonly sampleContent: PartnerContentItem[] = [
    {
      heading: 'How You Learn on Miles Masterclass',
      headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
      itemClass: 'text-center py-4',
    },
    {
      subHeading: 'One Platform. Built for How CPAs Actually Learn.',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'Binge when you can. Stream when it fits. Scroll when you need speed. Miles Masterclass brings together Master Classes, podcasts, and micro-learning, so CPAs can build AI readiness while earning CPE, on their own schedule.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ];

  protected readonly partnershipContent: PartnershipContentInput[] = [
    {
      type: 'TRACKS',
      heading: null,
    },
  ];

  protected readonly cairaFeaturesHeading: PartnerContentItem[] = [
    {
      heading: 'Get Certified. Get Noticed. Flex Your AI Readiness on LinkedIn!',
      headingClass: 'text-white md:text-[40px] text-2xl not-italic font-semibold leading-tight',
      itemClass: 'text-center md:w-3/5 w-full mx-auto',
    },
  ];

  protected readonly cairaStepsHeading: PartnerContentItem[] = [
    {
      heading: 'Your Path to Earning the CAIRA Level 1 Badge',
      headingClass: 'text-white md:text-[40px] text-2xl not-italic font-semibold leading-tight',
      itemClass: 'text-center w-full',
    },
    {
      paragraph:
        'Develop high-impact, in-demand AI-driven skills that bridge accounting and AI — no prerequisites required.',
      paragraphClass:
        'text-[#A8A8A8] sf_medium md:text-base text-sm not-italic font-medium leading-tight',
      itemClass: 'text-center w-full mt-3',
    },
  ];

  protected readonly cairaFeatures: CairaFeatureItem[] = [
    {
      title: '30 CPE Hours. Big Impact.',
      description:
        'Focused learning path designed to help you stay ahead in the AI-powered accounting era.',
      image: `${this.S3_BUCKET_URL}static-assests/web-app/caira/caira-1a.webp`,
    },
    {
      title: 'Flex Your AI Readiness on LinkedIn',
      description:
        'Showcase your achievement with a Credly digital badge - a verified, shareable proof of your AI readiness on LinkedIn.',
      image: `${this.S3_BUCKET_URL}static-assests/web-app/caira/caira-1b.webp`,
    },
    {
      title: 'Learn from Global Accounting & AI Leaders',
      description:
        'Gain insights, strategies, and frameworks from industry pioneers shaping the future of accounting and AI.',
      image: `${this.S3_BUCKET_URL}static-assests/web-app/caira/caira-1c.webp`,
    },
  ];

  protected readonly cairaSteps: CairaStep[] = [
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
      title: 'Complete 30 CPE hours',
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
