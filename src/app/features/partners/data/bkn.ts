import { environment } from '@env/environment';
import { logo } from '@core/constants/icon';
import { ForFirmsPanel } from '../components/for-firms-panel/for-firms-panel';
import {
  PartnerLevelCard,
  PartnerLevelPanel,
} from '../components/partner-level-panel/partner-level-panel';
import {
  iconAdminGear,
  iconBook,
  iconCaira,
  iconChart,
  iconLaptop,
  iconLearners,
} from '@core/constants/partner-icons';
import type { PartnerShowcaseConfig } from '../models/partner-showcase.model';

const S3_BUCKET_URL = environment.S3_BUCKET_URL;

const employeesCards: PartnerLevelCard[] = [
  {
    iconSvg: iconBook,
    heading: 'Learning that inspires.',
    paragraph:
      "Say goodbye to dull slides. Our storytelling-led lessons don't just teach — they stick. Real stories, real experts, real impact.",
  },
  {
    iconSvg: iconLaptop,
    heading: 'Learn anywhere, anytime.',
    paragraph:
      'Seamlessly switch between desktop and mobile. Your learning journey moves with you.',
  },
  {
    iconSvg: iconCaira,
    heading: "Upskill for what's next.",
    paragraph:
      'Get AI-ready with CAIRA. Earn CPE credits, claim your digital badge, and showcase your readiness on LinkedIn',
  },
  {
    iconSvg: iconLearners,
    heading: 'Content for Every Kind of Learner',
    paragraph:
      "From binge-watchers to podcast junkies to doom-scrollers! We've got a learning format for everyone.",
  },
];

const adminsCards: PartnerLevelCard[] = [
  {
    iconSvg: iconBook,
    heading: "Learning that actually sticks (and doesn't snooze).",
    paragraph:
      'Say goodbye to checkbox training. Our multi-format lessons make compliance and upskilling something your team will actually look forward to.',
  },
  {
    iconSvg: iconCaira,
    heading: 'Build your AI dream team with CAIRA.',
    paragraph:
      "Turn curiosity into capability. With our Certified AI Readiness Associate (CAIRA) program — complimentary for all subscribers — your employees don't just learn AI, they live it.",
  },
  {
    iconSvg: iconAdminGear,
    heading: 'Admin made easy-peasy.',
    paragraph:
      'Add users, remove them, create teams, pull reports — all with a few clicks. No tech headaches, no spreadsheets from 1998.',
  },
  {
    iconSvg: iconChart,
    heading: 'Insights that mean business.',
    paragraph:
      'Dive into engagement stats, progress reports, and performance data that actually tell a story — so you can coach, not just count.',
  },
];

export const BKN: PartnerShowcaseConfig = {
  hero: {
    content: [
      {
        heading: "Finally CPE that's AI in Accounting",
        headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
        itemClass: 'text-center py-4',
      },
      {
        logos: [
          {
            src: logo,
            type: 'svg',
            alt: 'Miles Masterclass Inc.',
            class: 'md:h-16! h-10! w-auto!',
          },
          {
            src: `${S3_BUCKET_URL}static-assests/web-app/commons/boomer-consulting-logo-light.webp`,
            type: 'image',
            alt: 'Boomer Consulting, Inc.',
            class: 'md:h-16! h-10! w-auto!',
          },
        ],
        logosClass: 'flex items-center justify-center gap-12',
        separatorClass: 'text-4xl font-thin text-muted-foreground/40',
        itemClass: 'py-8',
      },
      {
        subHeading:
          'Bring the Miles Masterclass × Boomer Knowledge Network Partnership to Your Firm',
        subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
        itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
      },
      {
        paragraph:
          'Through this partnership, firms can build AI fluency across teams with real tool demos, workflow-based learning, and cinematic Master Classes, accelerating AI readiness and helping professionals work smarter, adapt faster, and lead the future of accounting.',
        paragraphClass: 'text-white md:text-lg text-base font-normal',
        itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
      },
    ],
    glowClass: 'bg-[radial-gradient(circle,#AB8862_30%,transparent_80%)]',
  },
  complianceContent: [
    {
      heading: 'Compliance has never been this exciting',
      headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
      itemClass: 'text-center py-4',
    },
    {
      subHeading: 'Let the world’s best bring out your people’s best',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'Transform routine CPE into real impact. With Miles Masterclass your teams learn from global accounting and AI leaders building future-ready skills that go way beyond compliance.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],

  partnershipMeansContent: [
    {
      heading: 'What this partnership means for you',
      headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
      itemClass: 'text-center py-4',
    },
    {
      subHeading: 'Experience learning that captivates, empowers, and transforms',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'We help organizations create future-ready employees and leaders through hands-on digital learning taught by the world’s best, where education meets inspiration.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],
  partnershipTabs: [
    { id: 'firms', heading: 'For Firms', content: ForFirmsPanel },
    {
      id: 'employees',
      heading: 'For Employees',
      content: PartnerLevelPanel,
      contentInputs: { cards: employeesCards },
    },
    {
      id: 'admins',
      heading: 'For Admins',
      content: PartnerLevelPanel,
      contentInputs: { cards: adminsCards },
    },
  ],
  selectedTab: 'firms',

  sampleContent: [
    {
      heading: 'SAMPLE MILES MASTERCLASS CONTENT',
      headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
      itemClass: 'text-center py-4',
    },
    {
      subHeading: 'One Platform. Infinite Ways to Learn.',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        "Binge it. Stream it. Scroll it. Your learning journey is yours to shape.Whether it’s long-form Master Classes, on-the-go Podcasts, or short Micro Learning bursts, our content adapts to your employees' attention span (and their calendar).",
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],
  contentSectionId: 'content-section',

  footerContent: [
    {
      subHeading: 'Bring the Miles Masterclass × Boomer Knowledge Network Partnership to Your Firm',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'Want your firm to access AI-focused, Hollywood-style CPE? Fill in your details and we’ll reach out to your L&D leaders, or, if you are an L&D leader, book a 30-minute session with us to explore how this partnership can elevate your firm’s learning ecosystem.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
    {
      paragraphHtml:
        'For partnership or access support, write to us at: <a href="mailto:partnerships@milesmasterclass.com" class="text-accent underline">partnerships@milesmasterclass.com</a>',
      paragraphClass: 'text-muted-foreground md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
    {
      paragraph: 'OR',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],
  sectionId: 'bkn-content-section',
  enquiryType: 'Boomer Knowledge Network',
  orContent: [
    {
      paragraph: 'OR',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
    {
      paragraph:
        'Schedule a 30-minute consultation to see how Miles Masterclass × ICPAS can support your firm’s AI-ready upskilling.',
      paragraphClass: 'text-muted-foreground md:text-lg text-base font-normal',
      itemClass: 'text-center  md:w-1/2 w-full mx-auto',
    },
  ],
};
