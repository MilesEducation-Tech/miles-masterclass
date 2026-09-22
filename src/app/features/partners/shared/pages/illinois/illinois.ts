import { Component, inject } from '@angular/core';
import {
  CalendlyDialog,
  CalendlyDialogData,
} from '@shared/components/dialog/calendly-dialog/calendly-dialog';
import {
  PartnerContentItem,
  PartnerContentList,
} from '../../components/partner-content-list/partner-content-list';
import { environment } from '@env/environment';
import { Dialog } from '@core/services/dialog/dialog';
import { ScrollService } from '@core/services/scroll/scroll';
import { logo } from '@core/constants/icon';
import {
  PartnershipContentInput,
  PartnershipContent,
} from '../../components/partnership-content/partnership-content';
import {
  ForPartnershipTabs,
  PartnershipTab,
} from '../../components/for-partnership-tabs/for-partnership-tabs';
import {
  PartnerLevelCard,
  PartnerLevelPanel,
} from '../../components/partner-level-panel/partner-level-panel';
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
} from '../../models/partner-icons';
import { Button } from '@shared/components/ui/button/button';
import { VideoListWrapper } from '../../components/video-list-wrapper/video-list-wrapper';
import { EnquiryForm } from '@shared/components/enquiry-form/enquiry-form';
import { PlanBenefits, PlanPointer } from '@shared/components/plan-benefits/plan-benefits';

@Component({
  selector: 'app-illinois',
  imports: [
    PartnerContentList,
    Button,
    VideoListWrapper,
    PartnershipContent,
    EnquiryForm,
    ForPartnershipTabs,
    PlanBenefits,
  ],
  templateUrl: './illinois.html',
  styleUrl: './illinois.css',
})
export class Illinois {
  S3_BUCKET_URL = environment.S3_BUCKET_URL;

  private readonly dialog = inject(Dialog);
  private readonly scrollService = inject(ScrollService);

  readonly heroContent: PartnerContentItem[] = [
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
          src: `${this.S3_BUCKET_URL}static-assests/web-app/partners/illinois_cpa_society_logo.webp`,
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
  ];

  readonly complianceContent: PartnerContentItem[] = [
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
  ];
  readonly partnershipMeansContent: PartnerContentItem[] = [
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
  ];

  readonly sampleContent: PartnerContentItem[] = [
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
  readonly footerContent: PartnerContentItem[] = [
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
  ];
  readonly OrContent: PartnerContentItem[] = [
    {
      paragraph: 'OR',
      paragraphClass: 'text-white md:text-lg text-base font-normal',
      itemClass: 'text-center py-4 md:w-1/2 w-full mx-auto',
    },
    {
      paragraph:
        'Schedule a 30-minute consultation to see how Miles Masterclass × ICPAS can support your firm’s AI-ready upskilling.',
      paragraphClass: 'text-muted-foreground md:text-lg text-base font-normal',
      itemClass: 'text-center md:w-1/2 w-full mx-auto',
    },
  ];

  readonly partnershipContent: PartnershipContentInput[] = [
    {
      type: 'MASTERCLASS',
      heading: 'Cinematic Master Classes',
      subheading: 'Long-form lessons from the world’s best, made to binge.',
    },
    {
      type: 'PODCAST',
      heading: 'On-the-Go Podcasts',
      subheading: 'Sharpen your edge between calls, commutes, and coffee runs.',
    },
    {
      type: 'MICRO-LEARNING',
      heading: 'Micro-Learning Bursts',
      subheading: 'Bite-sized lessons that fit any calendar.',
    },
  ];

  readonly level1Cards: PartnerLevelCard[] = [
    {
      iconSvg: iconAiReadiness,
      heading: 'AI-Readiness for Accountants',
      paragraph:
        'Build individual fluency with CPA-grade judgment - so AI enhances decision-making, not replaces it.',
    },
    {
      iconSvg: iconHowAiWorks,
      heading: 'How AI Works in Accounting',
      paragraph:
        'Understand how AI models function within accounting workflows, not just in theory.',
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

  readonly level2Cards: PartnerLevelCard[] = [
    {
      iconSvg: iconAppliedAiFunctions,
      heading: 'Applied AI Across Functions',
      paragraph: 'Move from individual productivity to team-level impact.',
    },
    {
      iconSvg: iconFunctionSpecificCases,
      heading: 'Function-Specific AI Use Cases',
      paragraph:
        'Apply AI across audit, tax, close, CAS, and FP&A with real, role-based workflows.',
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
      paragraph:
        'Move beyond sampling to analyze entire datasets for greater accuracy and insight.',
    },
  ];

  readonly level3Cards: PartnerLevelCard[] = [
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

  readonly partnershipTabs: PartnershipTab[] = [
    {
      id: 'level1',
      heading: 'Level 1',
      content: PartnerLevelPanel,
      contentInputs: { cards: this.level1Cards },
    },
    {
      id: 'level2',
      heading: 'Level 2',
      content: PartnerLevelPanel,
      contentInputs: { cards: this.level2Cards },
    },
    {
      id: 'level3',
      heading: 'Level 3',
      content: PartnerLevelPanel,
      contentInputs: { cards: this.level3Cards },
    },
  ];

  readonly videoList = [
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo-sm1.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/masterclass-promo.webp`,
      mobileVideoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/hero-bg-mob.mp4`,
      mobilePosterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/home/home-hero-sm.webp`,
    },
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/gary-boomer-sm1.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/gary-boomer.webp`,
    },
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/jeff-sm1.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/jeff.webp`,
    },
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/ellen-sm1.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/ellen.webp`,
    },
    {
      videoSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/scott-sm1.mp4`,
      posterSrc: `${this.S3_BUCKET_URL}static-assests/web-app/partners/scott.webp`,
    },
  ];

  scrollTo(id: string): void {
    this.scrollService.scrollToId(id, { offset: 96 });
  }

  openScheduler(): void {
    this.dialog.open<CalendlyDialog, boolean>(CalendlyDialog, {
      width: 'min(95vw, 760px)',
      ariaLabel: 'Schedule a demo',
      data: {
        url: 'https://calendly.com/rohan-singhai-milesmasterclass/30min',
        closeAction: true,
      } satisfies CalendlyDialogData,
    });
  }

  planPointers: PlanPointer[] = [
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
}
