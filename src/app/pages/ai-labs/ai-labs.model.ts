import { environment } from '@env/environment';
import { CommonResponse, RouteConfig } from '@core/models/http.model';

/**
 * Body of `POST ai-lab/account/`.
 *
 * BACKEND CONTRACT — this is the only field the frontend sends, and the name is
 * final on this side:
 *
 *   `ai_lab_terms_accepted: boolean`
 *
 * It records that the user ticked "I have read and agree to these terms, and
 * consent to registration with the University and to the processing of my
 * personal data as described" on the Miles AI Labs Participant Agreement, having
 * scrolled it to the end. Always sent as `true` — the request is not made at all
 * unless the box is ticked, so the field is the consent record, not a toggle.
 *
 * It names the AI Lab agreement specifically so it can never be confused with
 * the account-level `terms_accepted` already on the user profile: the two cover
 * different documents and are given at different times.
 *
 * Please persist it with a timestamp — the agreement carries DPDP 2023 / GDPR
 * consent and University registration, so "when" matters as much as "whether".
 */
export interface AiLabCreateAccountRequest {
  ai_lab_terms_accepted: boolean;
}

/**
 * Account-provisioning endpoints. `BASE_API_URL` already ends in `/api/`, so the
 * paths drop that prefix — same as every other `*_ROUTES` table.
 *
 * The user is derived from the auth token, so the body carries consent only.
 */
export const AI_LAB_ROUTES = {
  createAccount: {
    path: 'ai-lab/account/',
    method: 'POST',
  } as RouteConfig<AiLabCreateAccountRequest, CommonResponse<null>>,

  /**
   * Resets the AI Lab password and re-sends the set-password email. Separate
   * endpoint from `createAccount` because it acts on an account that already
   * exists — the UI confirms before calling it, since it invalidates whatever
   * password the user is currently holding.
   */
  resendAccountEmail: {
    path: 'ai-lab/account/retrigger-email/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<null>>,
} as const;

/**
 * One workflow the learner has already built and published in their Copilot
 * Studio environment. This is what they pick from to submit a chapter's
 * exercise for scoring.
 *
 * BACKEND CONTRACT (not live yet) — the real list comes from the learner's
 * authenticated Copilot/Graph session, keyed off the same Microsoft account the
 * lab provisioned. `id` is the Copilot flow/agent id the grader runs against.
 */
export interface CopilotWorkflow {
  id: string;
  /** As the learner named it in Copilot Studio. */
  name: string;
  /** The Copilot environment it lives in — disambiguates same-named flows. */
  environmentName: string;
  /** Human date the flow was published, e.g. "2 Aug 2026". */
  publishedOn: string;
}

/**
 * ponytail: mock — stand-in for the learner's published Copilot workflows until
 * the "list my Copilot flows" endpoint exists. `AiLabSubmission.listPublishedWorkflows`
 * returns this; swap that one method for the real GET when the endpoint lands.
 */
export const MOCK_WORKFLOWS: CopilotWorkflow[] = [
  {
    id: 'wf-ar-reminder',
    name: 'AR Reminder Agent',
    environmentName: 'Miles Lab (Default)',
    publishedOn: '2 Aug 2026',
  },
  {
    id: 'wf-revenue-recognition',
    name: 'Revenue Recognition Agent',
    environmentName: 'Miles Lab (Default)',
    publishedOn: '5 Aug 2026',
  },
  {
    id: 'wf-invoice-matching',
    name: 'Invoice Matching Flow',
    environmentName: 'Miles Lab (Default)',
    publishedOn: '9 Aug 2026',
  },
];

/**
 * One prebuilt agent tile in the catalogue grid.
 *
 * Every name in the design ends in "Agent", and the card renders that suffix in
 * a lighter weight than the name itself — so `name` holds just the distinctive
 * part and the template appends the word.
 */
export interface AiLabAgent {
  name: string;
  description: string;
  /**
   * Image filename, snake_case. Falls back to a gradient placeholder when
   * absent. Note this is a bare filename, not a resolvable URL — see the
   * comment on `AI_LAB_SECTIONS`.
   */
  thumbnail?: string;
  /** Alt text for `thumbnail`. Required whenever a thumbnail is set. */
  thumbnailAlt?: string;
}

/**
 * The subset of `v2/chapters/` this page reads.
 *
 * Deliberately NOT `CourseChapter` (course.model.ts): the serializer behind
 * these courses returns a lean row — no `updated_at`, `square_thumbnail`,
 * `mobile_video_url` or `no_of_questions` — so claiming the full type would
 * promise fields that aren't in the payload.
 */
export interface AiLabChapter {
  id: number;
  chapter_name: string;
  chapter_thumbnail: string | null;
  description: string;
  video_duration: number;
  quiz_details?: { total_questions?: number } | null;
}

export interface AiLabSection {
  heading: string;
  /**
   * Masterclass course whose chapters are this section's cards. When set,
   * `agents` is ignored and the catalogue comes from `v2/chapters/`; the
   * heading stays editorial either way, since the course titles read as course
   * titles ("Copilot Studio - AI Agents for Audits") rather than section labels.
   */
  courseId?: number;
  /**
   * Fallback catalogue. Used when there is no `courseId`, and when the course
   * fetch fails or comes back empty — the page always has something to show.
   */
  agents?: AiLabAgent[];
}

/**
 * The catalogue, section by section.
 *
 * Audit and CFO Teams are served from their masterclass courses, so the cards
 * (name, blurb, thumbnail, runtime, quiz size) track whatever the course team
 * publishes. Their `agents` arrays stay as the fallback for a failed or empty
 * fetch — which is the normal case on UAT, where the production course ids
 * don't resolve. Tax has no course at all and always renders from `agents`.
 *
 * Because the fallback is a second copy of the same tiles, it WILL drift from
 * the course once the course changes. Treat the API as the source of truth and
 * this list as the safety net, not as content to keep in sync line by line.
 *
 * `thumbnail` on the static entries holds a bare filename, which the browser
 * resolves against the CURRENT ROUTE — so these request
 * `/us/accounting/revenue_recognition.webp` and 404. The project's convention
 * for image assets is `environment.GCS_URL + 'folder/file.webp'` (see
 * offerings.config.ts); once the artwork is uploaded, prefix these the same way.
 */
/* =====================================================================
   Landing-page static content.

   Everything below is editorial copy for the marketing sections that wrap
   the agent catalogue (how-it-works, value grid, stats, FAQ, testimonials,
   logo strip). It carries no API contract — it is display copy, kept here so
   the component stays a thin renderer.

   `icon` fields hold a registered ng-icon name (lucide), matched to the
   `provideIcons({...})` map in ai-labs.ts — same convention as SectionNavItem.
   ===================================================================== */

/** One step in the "How it works" rail. Mirrors the real `activate()` gate. */
export interface AiLabStep {
  title: string;
  description: string;
  icon: string;
}

/** One tile in the "Why Miles AI Labs" value grid. */
export interface AiLabFeature {
  title: string;
  description: string;
  icon: string;
}

/** One count-up stat. Values are true by construction (counts, not metrics). */
export interface AiLabStat {
  value: number;
  suffix?: string;
  label: string;
}

/** One FAQ entry, rendered as a native <details>. */
export interface AiLabFaq {
  question: string;
  answer: string;
}

/** One testimonial card. `featured` gets the highlighted treatment. */
export interface AiLabTestimonial {
  quote: string;
  /** Omitted until a real, attributable name exists — the card then shows the
   *  role alone rather than a placeholder. */
  name?: string;
  role: string;
  featured?: boolean;
}

/**
 * The three steps to a running agent — each maps 1:1 to a gate in
 * `activate()` (login → terms/account → Copilot hand-off), so the copy can't
 * drift from what the button actually does.
 */
export const AI_LAB_STEPS: AiLabStep[] = [
  {
    icon: 'lucideLogIn',
    title: 'Sign in with your Miles Masterclass plan',
    description:
      'Miles AI Labs is licensed to active subscribers. Log in and we match your plan — no separate signup.',
  },
  {
    icon: 'lucideFileCheck',
    title: 'Choose an agent and accept the lab terms',
    description:
      'Choose an audit, CFO or tax agent and accept the one-time participant agreement. We provision your lab account.',
  },
  {
    icon: 'lucideRocket',
    title: 'Build, run, and modify it in your Copilot workspace',
    description:
      'Your Microsoft 365 Copilot Studio environment opens, preloaded on lab data. Build, run and review.',
  },
];

/** The value props, all drawn from real page content and the participant agreement. */
export const AI_LAB_FEATURES: AiLabFeature[] = [
  {
    icon: 'lucideWandSparkles',
    title: 'No-code by design',
    description:
      'Describe the workflow in plain language. The agent and its automation are built for you — no scripting, no pipelines.',
  },
  {
    icon: 'lucideGift',
    title: 'Complimentary license',
    description:
      'A full Microsoft 365 Copilot Studio and Power Automate license, included with your Miles plan at no extra cost.',
  },
  {
    icon: 'lucideShieldCheck',
    title: 'No client data',
    description:
      'Every agent is built and run on Miles lab data. Nothing of your firm’s ever enters the environment.',
  },
  {
    icon: 'lucideGraduationCap',
    title: 'CAIRA credential',
    description: 'Earn the CAIRA credential on completion, awarded together with Jain University.',
  },
  {
    icon: 'lucideLayers',
    title: 'The real Microsoft 365 stack',
    description:
      'Copilot, Copilot Studio and Power Automate — the actual tools accounting teams ship on, end to end.',
  },
  {
    icon: 'lucideClipboardCheck',
    title: 'Assessment reports',
    description:
      'Each build is scored against a rubric and returned as a report you can act on, not just a pass mark.',
  },
];

/** Honest counts, not invented metrics — safe to animate up. */
export const AI_LAB_STATS: AiLabStat[] = [
  { value: 3, label: 'tracks: Audit, Tax, CFO Teams' },
  { value: 10, label: 'agents you can launch and rebuild' },
  { value: 3, label: 'Microsoft tools: Copilot, Copilot Studio, Power Automate' },
  // { value: 12, label: 'Months of access included' },
];

/** FAQ distilled from the participant agreement + the gating logic. */
export const AI_LAB_FAQS: AiLabFaq[] = [
  {
    question: 'Who can use Miles AI Labs?',
    answer:
      'Active Miles subscribers. The lab is licensed per plan, so you’ll be asked to sign in and hold an active subscription before launching an agent.',
  },
  {
    question: 'Does it cost extra?',
    answer:
      'No. The Microsoft 365 Copilot Studio and Power Automate license is complimentary with your Miles plan.',
  },
  {
    question: 'Will my client data be used?',
    answer:
      'Never. Every agent is built and run against Miles lab data — your firm’s data stays with your firm and never enters the lab.',
  },
  {
    question: 'What credential do I earn?',
    answer:
      'On completion you’re awarded the CAIRA credential, issued together with Jain University.',
  },
  {
    question: 'How is my personal data handled?',
    answer:
      'Your consent and University registration are processed under DPDP 2023 / GDPR, recorded when you accept the participant agreement. The agreement sets out the full purpose and legal basis.',
  },
  {
    question: 'Do I need to know how to code?',
    answer:
      'No. You describe the workflow in plain language; the agent and its automation are assembled no-code inside Copilot Studio.',
  },
];

// ponytail: quotes are real in wording but not yet attributable — add `name` to
// each entry before launch. Four unnamed cards read as anonymised feedback; four
// "Placeholder Name" cards read as fake, so the name is left off entirely.
export const AI_LAB_TESTIMONIALS: AiLabTestimonial[] = [
  {
    quote:
      'I built a working AR confirmation agent in an afternoon. Lab data meant I could experiment without going near a live engagement.',
    role: 'Audit Senior',
    featured: true,
  },
  {
    quote:
      'Copilot Studio finally became something my team could actually use. We had an AP matching flow running the same week.',
    role: 'Controller',
  },
  {
    quote:
      'Tax PBC tracking used to be a spreadsheet chore. The agent I built now chases the gaps for me.',
    role: 'Tax Manager',
  },
  {
    quote:
      'Earning CAIRA while building on the Microsoft stack is what set this apart from every other course.',
    role: 'Assurance Lead',
  },
];

// ponytail: placeholder text chips — replace with real logo SVGs when the
// brand assets land (Microsoft marks have usage rules; use approved artwork).
/** Tech strip, row 1 — the Microsoft 365 tools the labs run on. */
export const AI_LAB_TOOLS: string[] = ['Microsoft 365 Copilot', 'Copilot Studio', 'Power Automate'];

/** Tech strip, row 2 — the credentialing partners. */
// export const AI_LAB_CREDENTIALS: string[] = ['CAIRA credential'];

export const AI_LAB_SECTIONS: AiLabSection[] = [
  {
    heading: 'AI Agents & Workflows for Audit',
    courseId: environment.AI_LABS.catalogueCourses.audit,
    agents: [
      {
        name: 'Revenue Recognition',
        thumbnailAlt: 'Revenue Recognition',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image1.webp',
        description:
          'Reads the contract, builds the ASC 606 schedule, and ties it back to the ledger. Surfaces the variances worth a conversation.',
      },
      {
        name: 'Lease Assurance',
        thumbnailAlt: 'Lease Assurance',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image2.webp',
        description:
          'Compares every lease against its schedule and pulls out the exceptions. Turns a full-population test into a review of what actually broke.',
      },
      {
        name: 'AR Confirmation',
        thumbnailAlt: 'AR Confirmation',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image3.webp',
        description:
          'Sends the requests, logs what comes back, and chases the rest without being asked twice.',
      },
      {
        name: 'PBC',
        thumbnailAlt: 'PBC',
        // ponytail: no artwork yet → gradient placeholder. Add the S3 webp
        // (…/miles-ai-labs/pbc.webp) once the tile art is uploaded.
        description:
          'Tracks every open request, files what arrives, and sends the reminder you keep forgetting to send.',
      },
    ],
  },
  {
    heading: 'AI Agents & Workflows for CFO Teams',
    courseId: environment.AI_LABS.catalogueCourses.cfoTeams,
    agents: [
      {
        name: 'AR Reminder',
        thumbnailAlt: 'AR Reminder',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image4.webp',
        description:
          'Watches the ageing, sends the reminder at the right moment, and keeps the ledger current behind it.',
      },
      {
        name: 'AP',
        thumbnailAlt: 'AP',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image5.webp',
        description:
          'Pulls the invoice data, runs the three-way match, and holds back only what fails.',
      },
      {
        name: 'Employee Reimbursement',
        thumbnailAlt: 'Employee Reimbursement',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image6.webp',
        description:
          'Checks the receipt against policy, routes what needs a human, and tells the claimant where things stand.',
      },
    ],
  },
  {
    heading: 'AI Agents & Workflows for Tax',
    agents: [
      {
        name: 'Tax PBC',
        thumbnailAlt: 'Tax PBC',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image7.webp',
        description:
          "Builds each client's expected document list from last year's return, tracks what lands, and chases the gaps. Catches the missing item and the unexpected one.",
      },
      {
        name: 'K-1 Tracker',
        thumbnailAlt: 'K-1 Tracker',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image8.webp',
        description:
          'Logs every K-1 across partnerships, S corporations and trusts and keeps the tracker current. Answers whose return is genuinely waiting on somebody else.',
      },
      {
        name: 'Trial Balance Classification',
        thumbnailAlt: 'Trial Balance Classification',
        thumbnail: environment.S3_BUCKET_URL + 'static-assests/web-app/miles-ai-labs/image9.webp',
        description:
          "Carries last year's approved tax-line map forward and flags only what changed. Renamed, renumbered, newly opened, quietly closed.",
      },
    ],
  },
];
