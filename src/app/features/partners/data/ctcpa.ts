import { PARTNER_OFFERINGS } from '@core/constants/offerings.config';
import { environment } from '@env/environment';
import type { PartnerLandingConfig } from '../models/partner-landing.model';

const S3_BUCKET_URL = environment.S3_BUCKET_URL;

export const CTCPA: PartnerLandingConfig = {
  pill: { brand: 'CTCPA' },
  heroContent: [
    {
      heading: 'Exclusive access for members of',
      headingClass: 'text-white sm:text-4xl text-2xl font-bold',
      logos: [
        {
          src: `${S3_BUCKET_URL}static-assests/web-app/partners/ctcpa-icon.webp`,
          type: 'image',
          alt: 'Connecticut Society of CPAs',
          class: 'sm:h-14! h-11! w-auto! shrink-0',
        },
      ],
      // Render the logo inline at the end of the heading text so the two read
      // as one phrase and wrap together (see PartnerContentItem.logosInline).
      logosInline: true,
      logosClass: 'inline-flex items-center align-middle ml-2 gap-2',
      itemClass: 'py-1',
    },
    {
      subHeading: "Finally, CPE, That's AI in Accounting",
      subHeadingClass: 'text-white lg:text-5xl md:text-4xl sm:text-3xl text-2xl font-bold',
      itemClass: 'py-3 w-full mx-auto',
    },
  ],

  contentSectionId: 'connecticut-content-section',

  benefits: { heading: 'Exclusive Benefits for Members of the Connecticut Society of CPAs' },
  audience: 'society',
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
        name: 'Cinematic Content: Netflix-style Master Classes and practitioner-led podcasts built for real workflows.',
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
      subHeading: 'CPE for the AI-Powered Accountant',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'Master AI and Analytics with insights from top industry experts. Learn practical tools and strategies while earning your CPE credits.',
      paragraphClass: 'text-muted-foreground md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],
  offerings: PARTNER_OFFERINGS,

  footerContent: [
    {
      subHeading: 'Unlock your CTCPA Member Benefit',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph: 'CPE that turns compliance into competitive advantage.',
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
  ],
  sectionId: 'connecticut-section',
  enquiryType: 'Connecticut Society of CPAs',
};
