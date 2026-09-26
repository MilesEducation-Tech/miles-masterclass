import { environment } from '@env/environment';
import { logo } from '@core/constants/icon';
import {
  PartnerLevelCard,
  PartnerLevelPanel,
} from '../components/partner-level-panel/partner-level-panel';
import {
  iconAiEthical,
  iconAiLeadership,
  iconAiReadiness,
  iconAppliedAiFunctions,
  iconAutomation,
  iconChangeManagement,
  iconCoreAiTools,
  iconDataInsight,
  iconFirmWideAiModel,
  iconFunctionSpecificCases,
  iconHowAiWorks,
  iconStandards,
} from '@core/constants/partner-icons';
import type { PlanPointer } from '@shared/components/plan-benefits/plan-benefits';
import type { PartnerShowcaseConfig } from '../models/partner-showcase.model';

const S3_BUCKET_URL = environment.S3_BUCKET_URL;

const level1Cards: PartnerLevelCard[] = [
  {
    iconSvg: iconAiReadiness,
    heading: 'AI-Readiness for Accountants',
    paragraph:
      'Build individual fluency with CPA-grade judgment - so AI enhances decision-making, not replaces it.',
  },
  {
    iconSvg: iconHowAiWorks,
    heading: 'How AI Works in Accounting',
    paragraph: 'Understand how AI models function within accounting workflows, not just in theory.',
  },
  {
    iconSvg: iconAiEthical,
    heading: 'Responsible & Ethical AI Use',
    paragraph:
      'Learn CPA-grade guardrails for using AI safely, ethically, and credibly in client work.',
  },
  {
    iconSvg: iconCoreAiTools,
    heading: 'Core AI Tools & Fundamentals',
    paragraph:
      'Build hands-on confidence with tools like Copilot, Power BI, and workflow automation.',
  },
];

const level2Cards: PartnerLevelCard[] = [
  {
    iconSvg: iconAppliedAiFunctions,
    heading: 'Applied AI Across Functions',
    paragraph: 'Move from individual productivity to team-level impact.',
  },
  {
    iconSvg: iconFunctionSpecificCases,
    heading: 'Function-Specific AI Use Cases',
    paragraph: 'Apply AI across audit, tax, close, CAS, and FP&A with real, role-based workflows.',
  },
  {
    iconSvg: iconAutomation,
    heading: 'Controlled Automation',
    paragraph:
      'Design workflows with approvals, controls, and exception handling, built to standards.',
  },
  {
    iconSvg: iconDataInsight,
    heading: 'Full-Population Insight',
    paragraph: 'Move beyond sampling to analyze entire datasets for greater accuracy and insight.',
  },
];

const level3Cards: PartnerLevelCard[] = [
  {
    iconSvg: iconFirmWideAiModel,
    heading: 'Firm-Wide AI Operating Model',
    paragraph:
      'Turn AI tools into a durable, firm-wide capability with clear governance and standards.',
  },
  {
    iconSvg: iconStandards,
    heading: 'AI Governance & Standards',
    paragraph:
      'Establish firm-wide policies, controls, and operating norms for responsible AI use.',
  },
  {
    iconSvg: iconChangeManagement,
    heading: 'Change Management at Scale',
    paragraph: 'Drive adoption across roles and teams while managing risk and readiness.',
  },
  {
    iconSvg: iconAiLeadership,
    heading: 'AI-Assisted Leadership Decisions',
    paragraph:
      'Enable partners and leaders to make better strategic decisions using AI responsibly.',
  },
];

const planPointers: PlanPointer[] = [
  {
    id: 1,
    planfeature: {
      name: 'Unlimited, on-demand NASBA-approved CPE',
      description: null,
      icon: 'unlimited-1.svg',
    },
  },
  {
    id: 2,
    planfeature: {
      name: 'Cinematic, practitioner-led Netflix-style Master Classes and podcasts',
      description: null,
      icon: 'cinematic-2.svg',
    },
  },
  {
    id: 3,
    planfeature: {
      name: 'Instagram-style reel-based micro-learning for fast insight and daily momentum',
      description: null,
      icon: 'instagram-3.svg',
    },
  },
  {
    id: 4,
    planfeature: {
      name: 'Coverage across AI, audit, tax, advisory, leadership, and firm strategy',
      description: null,
      icon: 'coverage-4.svg',
    },
  },
  {
    id: 5,
    planfeature: {
      name: 'Real-world AI workflows - not theory or generic demos',
      description: null,
      icon: 'real-world-5.svg',
    },
  },
  {
    id: 6,
    planfeature: {
      name: 'Seamless access across desktop and mobile',
      description: null,
      icon: 'seamless-6.svg',
    },
  },
  {
    id: 7,
    planfeature: {
      name: 'Continuously updated content aligned with regulatory and technology shifts',
      description: null,
      icon: 'continuously-7.svg',
    },
  },
  {
    id: 8,
    planfeature: {
      name: 'Automated certificates, tracking, and NASBA-compliant reporting',
      description: null,
      icon: 'automated-8.svg',
    },
  },
  {
    id: 9,
    planfeature: {
      name: 'Exclusive access to CAIRA - Certified AI-Ready Accountant',
      description: null,
      icon: 'exclusive-9.svg',
    },
  },
];

export const ILLINOIS: PartnerShowcaseConfig = {
  hero: {
    content: [
      {
        heading: 'CPE That Turns Compliance Into Competitive Advantage',
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
            src: `${S3_BUCKET_URL}static-assests/web-app/partners/illinois_cpa_society_logo.webp`,
            type: 'image',
            alt: 'Illinois CPA Society',
            class: 'md:h-16! h-10! w-auto!',
          },
        ],
        logosClass: 'flex items-center justify-center gap-12',
        separatorClass: 'text-4xl font-thin text-muted-foreground/40',
        itemClass: 'py-8',
      },
      {
        subHeading: 'Building the AI-Ready CPA',
        subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
        itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
      },
      {
        paragraph:
          'Exclusive access for ICPAS members to NASBA-approved CPE that makes CPAs AI-ready - through practical, workflow-driven learning, real tools used in modern firms, and CPA-grade standards that protect judgment and trust.',
        paragraphClass: 'text-white md:text-lg text-base font-normal',
        itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
      },
    ],
    glowClass: 'bg-[radial-gradient(circle,#00a1e8_30%,transparent_80%)]',
  },
  complianceContent: [
    {
      heading: "The Profession Is Changing. Here's the Path Forward for CPAs.",
      headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
      itemClass: 'text-center py-4',
    },
    {
      subHeading:
        'AI, automation, and rising client expectations are reshaping how accounting work gets done.',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'But most education still explains what AI is - not how CPAs apply it safely, credibly, and responsibly in real client work. Now, ICPAS members have a clear, practical path to real AI readiness.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],

  partnershipMeansContent: [
    {
      heading: 'A Structured Path to Real AI Readiness',
      headingClass: 'text-accent md:text-2xl text-xl font-semibold tracking-[0.2em] uppercase',
      itemClass: 'text-center py-4',
    },
    {
      subHeading: 'The Miles AI in Accounting Framework',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        'Empower → Optimize → Scale Building AI readiness that begins with individual capability and scales across teams and firms.',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
  ],
  partnershipTabs: [
    {
      id: 'level1',
      heading: 'Level 1',
      content: PartnerLevelPanel,
      contentInputs: { cards: level1Cards },
    },
    {
      id: 'level2',
      heading: 'Level 2',
      content: PartnerLevelPanel,
      contentInputs: { cards: level2Cards },
    },
    {
      id: 'level3',
      heading: 'Level 3',
      content: PartnerLevelPanel,
      contentInputs: { cards: level3Cards },
    },
  ],
  selectedTab: 'level1',

  benefits: {
    heading: 'Exclusive Benefits for ICPAS Members',
    planPointers,
    offer: {
      lead: 'Become AI-Ready - with',
      highlight: '$1,000 off the Annual Subscription.',
      lines: [
        'This is not another content library.',
        'This is career infrastructure for the next decade of accounting.',
      ],
    },
  },

  sampleContent: [
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
  ],
  contentSectionId: 'illinois-content-section',

  footerContent: [
    {
      subHeading: 'Unlock Your ICPAS Member Benefit',
      subHeadingClass: 'text-white md:text-5xl text-3xl font-bold ',
      itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto',
    },
    {
      paragraph:
        "Bring AI-ready, cinematic, NASBA-approved CPE to your firm. Share your details and we'll reach out, or book a 30-minute call to explore how Miles Masterclass can elevate your firm's learning experience.",
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
  sectionId: 'illinois-section',
  enquiryType: "Illinois Societies of CPA's",
};
