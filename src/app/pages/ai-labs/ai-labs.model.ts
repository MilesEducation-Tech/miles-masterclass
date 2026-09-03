import { environment } from '../../../environments/environment';
import { CommonResponse, RouteConfig } from '../../shared/core/models/http.model';
import { lucideLayers } from '@ng-icons/lucide';
import { iconCopilotOutline } from '../../shared/core/constant/icon';

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
   * Resets the AI Lab password and emails the new credentials. Separate
   * endpoint from `createAccount` because it acts on an account that already
   * exists — the UI confirms before calling it, since it invalidates whatever
   * password the user is currently holding.
   */
  resendAccountEmail: {
    path: 'ai-lab/account/retrigger-email/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<null>>,

  /** The learner's agents — the lab picker's options. */
  agents: {
    path: 'ai-lab/agents/',
    method: 'GET',
  } as RouteConfig<void, AiLabApiResponse<AiLabAgentsResponse>>,

  /** Starts an evaluation of one agent against this course's lab. */
  submitAssignment: {
    path: 'ai-lab/assignments/submit/',
    method: 'POST',
  } as RouteConfig<AiLabAssignmentSubmitRequest, AiLabApiResponse<unknown>>,

  /** Evaluation state for `?course_id=` — polled while `in_progress`. */
  assignmentStatus: {
    path: 'ai-lab/assignments/status/',
    method: 'GET',
  } as RouteConfig<void, AiLabApiResponse<AiLabAssignmentStatus>>,
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
 * Envelope of the AI Lab endpoints (`ai-lab/agents/`, `ai-lab/assignments/*`):
 * `status_code` is a boolean here, not the `status` the rest of the API uses.
 */
export interface AiLabApiResponse<T> {
  status_code: boolean;
  data: T;
  message: string;
}

/**
 * One agent the learner has built in their Copilot environment — a row of
 * `GET ai-lab/agents/`.
 *
 * `id` is the only field unique per agent: everyone shares the one Miles lab
 * environment, so `envId` repeats across the list and cannot key a picker.
 * Submission sends the other two back, renamed the way `agent_schema` renames
 * `schemaName`: `envId` → `agent_env_id`, `schemaName` → `agent_schema`.
 */
export interface AiLabAgent {
  id: string;
  name: string;
  schemaName: string;
  published: boolean;
  envId: string;
  /** Human name of the environment, e.g. "the shared Miles AI Labs environment". */
  envLabel: string;
}

/**
 * `data` of `GET ai-lab/agents/`. `is_provisioned` is false until the
 * learner's Copilot environment exists — `agents` is then empty for a reason
 * the page can explain, rather than merely being empty.
 */
export interface AiLabAgentsResponse {
  is_provisioned: boolean;
  agents: AiLabAgent[];
}

/** Body of `POST ai-lab/assignments/submit/`. `course_id` is the AI Lab course's id. */
export interface AiLabAssignmentSubmitRequest {
  course_id: number;
  agent_env_id: string;
  agent_schema: string;
}

/** `in_progress` is the only live state — the status poll runs while it holds. */
export type AiLabLabStatus = 'not_started' | 'in_progress' | 'completed' | 'error';

/**
 * `data` of `GET ai-lab/assignments/status/?course_id=`. Everything past
 * `lab_status` is null / empty until the evaluation completes.
 */
export interface AiLabAssignmentStatus {
  lab_status: AiLabLabStatus;
  submission_id?: string;
  /** Headline mark, out of 10. */
  score?: number | null;
  percentage?: number | null;
  /** The evaluator's verdict. */
  master_comment?: string;
  /** Secondary remarks — smaller points that didn't change the verdict. */
  minor_comment?: string;
  grade_card_pdf_url?: string | null;
  evaluated_at?: string | null;
}

export interface AiLabSection {
  heading: string;
  /**
   * Track whose `course_type=ai_lab` courses are this section's cards
   * (`v2/tracks/:id/courses/`), one card per course. A section with no track
   * id, or whose track answers empty, isn't rendered at all.
   */
  trackId?: number;
}

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
  /** Count-up number. Omitted when the tile shows a `logo` instead. */
  value?: number;
  suffix?: string;
  label: string;
  /** Raw SVG markup shown in place of the number, via `ng-icon [svg]`. */
  logo?: string;
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

/** Logo tiles — swap the placeholder glyphs for the real logo SVGs (add them to
 * `shared/core/constant/icon.ts` alongside `iconCopilot`). */
export const AI_LAB_STATS: AiLabStat[] = [
  { logo: iconCopilotOutline, label: '3 Tracks: Audit, Tax, CFO Teams' },
  { logo: lucideLayers, label: '10 Courses Agents you can launch and rebuild' },
  // { value: 3, label: 'Microsoft tools: Copilot, Copilot Studio, Power Automate' },
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

/**
 * The catalogue, section by section. Every card comes from the track's
 * published `ai_lab` courses — there is no static fallback, so a track that
 * isn't published yet simply doesn't appear. Add its id to
 * `environment.AI_LABS.catalogueTracks` and name it here to turn it on.
 */
export const AI_LAB_SECTIONS: AiLabSection[] = [
  {
    heading: 'AI Agents & Workflows for Audit',
    trackId: environment.AI_LABS.catalogueTracks.audit,
  },
  {
    heading: 'AI Agents & Workflows for CFO Teams',
    trackId: environment.AI_LABS.catalogueTracks.cfo,
  },
  { heading: 'AI Agents & Workflows for Tax', trackId: environment.AI_LABS.catalogueTracks.tax },
];
