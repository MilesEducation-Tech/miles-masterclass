import { Component, inject } from '@angular/core';
import { environment } from '@env/environment';
import { ScrollService } from '@core/services/scroll/scroll';
import { CPA_CANADA_OFFERINGS } from '@core/constants/offerings.config';
import {
  PartnerContentItem,
  PartnerContentList,
} from '@shared/components/partner-content-list/partner-content-list';
import {
  PartnershipContentInput,
  PartnershipContent,
} from '../../components/partnership-content/partnership-content';
import { PlanPointer, PlanBenefits } from '@shared/components/plan-benefits/plan-benefits';
import { Offering } from '@shared/components/offerings/offerings';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { Button } from '@shared/ui/button/button';
import { VideoListWrapper } from '@shared/components/video-list-wrapper/video-list-wrapper';

@Component({
  selector: 'app-cpa-canada',
  imports: [
    PartnerContentList,
    Offering,
    EnquiryForm,
    Button,
    PartnershipContent,
    PlanBenefits,
    VideoListWrapper,
  ],
  templateUrl: './cpa-canada.html',
})
export class CpaCanada {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;

  private readonly scrollService = inject(ScrollService);

  offerings = CPA_CANADA_OFFERINGS;

  readonly videoList = [
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo-sm1.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo.webp`,
      // Portrait-friendly source for the aspect-9/16 mobile container —
      // the desktop promo is 16:9 and gets cropped badly on phones.
      mobileVideoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/hero-bg-mob.mp4`,
      mobilePosterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero-sm.webp`,
    },
  ];

  /**
   * Three items, not one: `partner-content-list` renders a block logo row
   * ABOVE the heading, but the hero wants heading → logo → title. Splitting
   * them keeps that order without special-casing the shared component.
   */
  readonly heroContent: PartnerContentItem[] = [
    {
      heading: 'Exclusive Access For Members Of',
      headingClass: 'text-white sm:text-2xl text-lg font-bold',
      itemClass: 'py-1',
    },
    {
      logos: [
        {
          // Supplied direct from the milesmasterclass-assets bucket rather than
          // the CloudFront path the other partner logos use. Source PNG is
          // 7377x2427 / 4.3 MB — worth a resized WebP on CloudFront when
          // there's a moment, since this is a first-load hero image.
          src: 'https://milesmasterclass-assets.s3.us-west-1.amazonaws.com/CPACanadaLogo.png',
          type: 'image',
          alt: 'CPA Canada',
          class: 'sm:h-20! h-16! w-auto! shrink-0',
        },
      ],
      logosClass: 'flex items-center gap-2',
      itemClass: 'py-2',
    },
    {
      subHeading: "Finally, CPD That's AI in Accounting",
      subHeadingClass: 'text-white lg:text-5xl md:text-4xl sm:text-3xl text-2xl font-bold',
      itemClass: 'py-3 w-full mx-auto',
    },
  ];

  readonly offeringContent: PartnerContentItem[] = [
    {
      subHeading: 'One Platform. Built For How Accountants Actually Learn.',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        "Binge-worthy when there's time. Streamable on the go. Scrollable for speed. Live when it counts.",
      paragraphClass: 'text-muted-foreground md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ];
  readonly footerContent: PartnerContentItem[] = [
    {
      subHeadingHtml: 'Unlock your <span class="text-[#0064A7]">CPA Canada</span> member benefit',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph: 'CPD that turns compliance into competitive advantage.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
    // {
    //   paragraphHtml:
    //     'For partnership or access support, write to us at: <a href="mailto:partnerships@milesmasterclass.com" class="text-accent underline">partnerships@milesmasterclass.com</a>',
    //   paragraphClass: 'text-muted-foreground md:text-lg text-base font-normal',
    //   itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    // },
    // {
    //   paragraph: 'OR',
    //   paragraphClass: 'text-white md:text-lg text-base font-normal',
    //   itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    // },
  ];

  readonly partnershipContent: PartnershipContentInput[] = [
    {
      type: 'TRACKS',
      heading: null,
    },
  ];

  scrollTo(id: string): void {
    this.scrollService.scrollToId(id, { offset: 96 });
  }

  /** Copy from the CPA Canada marketing deck. */
  planPointers: PlanPointer[] = [
    {
      id: 1,
      planfeature: {
        name: 'Verifiable CPD: On-demand learning, with a certificate for every eligible activity to support your annual reporting.',
        description: null,
        icon: null,
      },
    },
    {
      id: 2,
      planfeature: {
        name: 'Cinematic Content: Hollywood-style Master Classes and practitioner-led podcasts built for real workflows.',
        description: null,
        icon: null,
      },
    },
    {
      id: 3,
      planfeature: {
        name: 'Micro-Learning (Reels): Short, focused lessons for quick insights and immediate application.',
        description: null,
        icon: null,
      },
    },
    {
      id: 4,
      planfeature: {
        name: 'Live Webinars: Expert-led sessions across the full AI stack, with real-time Q&A.',
        description: null,
        icon: null,
      },
    },
    {
      id: 5,
      planfeature: {
        name: 'Workflow-First: Real accounting use cases, not generic demos.',
        description: null,
        icon: null,
      },
    },
    {
      id: 6,
      planfeature: {
        name: 'Miles AI Labs: Where the master classes get applied. Build agents and workflows in Copilot Studio and Power Automate on lab data, with no code, no client data, and no setup.',
        description: null,
        icon: null,
      },
    },
    {
      id: 7,
      planfeature: {
        name: 'Always Current: Library updated with the latest tech and regulations.',
        description: null,
        icon: null,
      },
    },
    {
      id: 8,
      planfeature: {
        name: 'CAIRA Credential: Three levels leading to Certified AI-Ready Accountant status, each shareable as a digital badge.',
        description: null,
        icon: null,
      },
    },
  ];
}
