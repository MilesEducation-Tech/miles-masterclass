import { Component, inject } from '@angular/core';
import { environment } from '@env/environment';
import { ScrollService } from '@core/services/scroll/scroll';
import { MGI_PARTNER_OFFERINGS } from '@features/home/components/offerings/offerings.config';
import {
  PartnerContentItem,
  PartnerContentList,
} from '../../components/partner-content-list/partner-content-list';
import {
  PartnershipContentInput,
  PartnershipContent,
} from '../../components/partnership-content/partnership-content';
import { PlanPointer, PlanBenefits } from '@shared/components/plan-benefits/plan-benefits';
import { Button } from '@shared/components/ui/button/button';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { Offering } from '@features/home/components/offerings/offerings';
import { VideoListWrapper } from '../../components/video-list-wrapper/video-list-wrapper';

@Component({
  selector: 'app-mgi-world',
  imports: [
    Button,
    PartnerContentList,
    EnquiryForm,
    Offering,
    PlanBenefits,
    PartnershipContent,
    VideoListWrapper,
  ],
  templateUrl: './mgi-world.html',
  styleUrl: './mgi-world.css',
})
export class MgiWorld {
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
      heading: 'Making Your Team AI-Ready',
      headingClass: 'text-white text-base',
      itemClass: 'pb-4 w-full mx-auto',
    },
    {
      logos: [
        {
          src: `${this.S3_BUCKET_URL}static-assests/web-app/partners/MGI-LOGO-NETWORK-WHITE.webp`,
          type: 'image',
          alt: 'MGI World Wide',
          class: 'lg:h-14! md:h-12! h-10! w-auto! shrink-0',
        },
      ],
    },
    {
      heading: 'Exclusive access for member firms',
      headingClass: 'text-white sm:text-4xl text-2xl font-bold',
      itemClass: 'py-1 flex flex-col',
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
      subHeading: 'Unlock your MGI Worldwide member-firm benefit',
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
