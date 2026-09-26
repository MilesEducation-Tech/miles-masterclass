import { MGI_PARTNER_OFFERINGS } from '@core/constants/offerings.config';
import { ALLINIAL_GLOBAL_LOGO } from '@core/constants/icon';
import type { PartnerLandingConfig } from '../models/partner-landing.model';

export const ALLINIAL_GLOBAL: PartnerLandingConfig = {
  pill: { brand: 'Allinial' },
  heroContent: [
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
  ],

  contentSectionId: 'allinial-content-section',

  benefits: { heading: 'Exclusive Benefits for Member Firms of Allinial Global' },
  audience: 'firm',
  planPointers: [
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
  ],

  offeringContent: [
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
  ],
  offerings: MGI_PARTNER_OFFERINGS,

  footerContent: [
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
  ],
  sectionId: 'allinial-global-section',
  enquiryType: 'Allinial Global',
};
