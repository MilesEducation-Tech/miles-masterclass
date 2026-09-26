import { Component, inject } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import {
  PartnerContentItem,
  PartnerContentList,
} from '@shared/components/partner-content-list/partner-content-list';
import { Offering } from '@shared/components/offerings/offerings';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { VideoListWrapper } from '@shared/components/video-list-wrapper/video-list-wrapper';
import {
  PartnershipContent,
  PartnershipContentInput,
} from '../../components/partnership-content/partnership-content';
import { PlanBenefits, PlanPointer } from '@shared/components/plan-benefits/plan-benefits';
import { environment } from '@env/environment';
import { ScrollService } from '@core/services/scroll/scroll';
import { MGI_PARTNER_OFFERINGS } from '@core/constants/offerings.config';
import { ALLINIAL_GLOBAL_LOGO } from '@core/constants/icon';

@Component({
  selector: 'app-allinial-global',
  imports: [
    Button,
    PartnerContentList,
    Offering,
    EnquiryForm,
    VideoListWrapper,
    PartnershipContent,
    PlanBenefits,
  ],
  templateUrl: './allinial-global.html',
})
export class AllinialGlobal {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;

  private readonly scrollService = inject(ScrollService);

  offerings = MGI_PARTNER_OFFERINGS;

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

  readonly heroContent: PartnerContentItem[] = [
    {
      heading: 'Making Your Team AI-Ready with Miles Masterclass',
      headingClass: 'text-white text-base',
      itemClass: 'py-1 w-full mx-auto',
    },
    // {
    //   logos: [
    //     {
    //       src: logo,
    //       type: 'svg',
    //       alt: 'Miles Masterclass Inc.',
    //       class: 'lg:h-16! md:h-12! h-10! w-auto!',
    //     },
    //     {
    //       src: ALLINIAL_GLOBAL_LOGO,
    //       type: 'svg',
    //       alt: 'Allinial Global',
    //       class: 'lg:h-16! md:h-12! h-10! w-auto!',
    //     },
    //   ],
    //   logosClass: 'flex items-center justify-start lg:gap-12 gap-6',
    //   separatorClass: 'text-4xl font-thin text-muted-foreground/40',
    //   itemClass: 'md:py-4 py-2',
    // },
    {
      heading: 'Exclusive partnership for',
      headingClass: 'text-white sm:text-4xl text-2xl font-bold',
      logos: [
        {
          src: ALLINIAL_GLOBAL_LOGO,
          type: 'svg',
          alt: 'Allinial Global',
          class: 'sm:h-14! h-11! w-auto! shrink-0',
        },
      ],
      // Render the logo inline at the end of the heading text so the two read
      // as one phrase and wrap together (see PartnerContentItem.logosInline).
      logosInline: true,
      logosClass: 'inline-flex items-center align-middle ml-2 gap-2',
      itemClass: 'py-1',
    },
  ];

  readonly offeringContent: PartnerContentItem[] = [
    {
      subHeading: 'One Platform.',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center pt-4 md:w-2/3 w-full mx-auto',
    },
    {
      subHeading: 'Built for how accounting teams actually learn. ',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold capitalize',
      itemClass: 'text-center pb-4 md:w-3/4 w-full mx-auto',
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
      subHeading: 'Unlock your Allinial Global member-firm benefit',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto capitalize',
    },
    {
      paragraph: 'CPE that turns compliance into competitive advantage.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
    // {
    //   paragraphHtml:
    //     'For partnership or access support, write to us at: <a href="mailto:rohan.singhai@milesmasterclass.com" class="text-accent underline">rohan.singhai@milesmasterclass.com</a>',
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

  planPointers: PlanPointer[] = [
    {
      id: 1,
      planfeature: {
        name: 'Unlimited CPE: On-demand, NASBA-approved credits.',
        description: null,
        icon: null,
      },
    },
    {
      id: 2,
      planfeature: {
        name: 'Cinematic Content: Hollywood style Master Classes and practitioner-led Podcasts built for real workflows.',
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
      id: 8,
      planfeature: {
        name: 'Live Webinars: Expert-led sessions across the full AI stack, with real-time Q&A.',
        description: null,
        icon: null,
      },
    },
    {
      id: 4,
      planfeature: {
        name: 'Gamified Challenges: Build a daily learning habit with 7-day AI in Accounting challenges, earning badges and leaderboard rankings as you earn CPE.',
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
        name: 'Always Current: Library updated with latest tech and regulations.',
        description: null,
        icon: null,
      },
    },
    {
      id: 7,
      planfeature: {
        name: 'CAIRA Credential: Exclusive access to the Certified AI-Ready Accountant status.',
        description: null,
        icon: null,
      },
    },
  ];
}
