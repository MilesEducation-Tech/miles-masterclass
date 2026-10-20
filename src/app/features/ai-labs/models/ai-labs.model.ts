import { lucideLayers } from '@ng-icons/lucide';
import { environment } from '@env/environment';
import { CommonResponse, RouteConfig } from '@core/models/http.model';
import { iconCopilotOutline } from '@core/constants/icon';

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

/**
 * One catalogue tile, flattened from a masterclass chapter.
 *
 * Every tile has a course page behind it, so `courseId` is what the click navigates to. The
 * optional fields are the ones a course may simply not carry — the card renders without them
 * rather than with a placeholder.
 *
 * It used to live beside `AiLabAgentDialog` in `shared/dialogs/`; that dialog is retired now that a
 * card opens the course page, and the type moved down to the one feature that uses it (AGENTS.md
 * §3: code lives at the lowest level that uses it).
 */
export interface AiLabAgentCard {
  name: string;
  /** Muted suffix after the name, for titles that read as "<name> Agent". */
  nameSuffix?: string;
  description: string;
  /** Portrait (9:16) crop — both catalogue surfaces are poster-shaped. */
  portraitThumbnail?: string | null;
  thumbnail?: string | null;
  thumbnailAlt?: string;
  /** Runtime in seconds, from the chapter's `video_duration`. */
  durationSeconds?: number;
  questionCount?: number;
  /** The course this tile came from — the page the tile opens. */
  courseId?: number;
}

export interface AiLabSection {
  heading: string;
  /**
   * Masterclass course whose chapters are this section's cards, read from `v2/chapters/`. The
   * heading stays editorial, since the course titles read as course titles ("Copilot Studio - AI
   * Agents for Audits") rather than section labels.
   *
   * There is no static fallback any more. A section with no `courseId`, or whose fetch settles
   * empty, is dropped from the page entirely — heading included.
   */
  courseId?: number;
}

/**
 * The catalogue, section by section.
 *
 * Audit and CFO Teams are served from their masterclass courses, so the cards (name, blurb,
 * thumbnail, runtime, quiz size) track whatever the course team publishes. Tax has no course yet.
 *
 * The ten hand-written fallback tiles that used to back these headings are gone, matching the
 * source design. The API is now the only source of cards, so **a section whose fetch settles empty
 * renders nothing at all** — on UAT, where the production course ids don't resolve, that is the
 * whole catalogue. Binding the catalogue read is what brings it back.
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

/** One hero tile: either a count-up number or a logo glyph, never both. */
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

/**
 * Logo tiles. The third numeric tile (Microsoft tools) was dropped with the move to glyphs, so
 * the grid renders two columns — see `heroStats` in `ai-labs.ts`.
 */
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

export const AI_LAB_SECTIONS: AiLabSection[] = [
  {
    heading: 'AI Agents & Workflows for Audit',
    courseId: environment.AI_LABS.catalogueCourses.audit,
  },
  {
    heading: 'AI Agents & Workflows for Tax',
  },
  {
    heading: 'AI Agents & Workflows for CFO Teams',
    courseId: environment.AI_LABS.catalogueCourses.cfoTeams,
  },
];

/* =====================================================================
   Learner progress + Copilot Credits.

   Wire types, straight from `docs/AI_LABS_API.md` §8: `progress` of
   `GET web-api/v1/ai-labs/practical-progress/` and `tokens` of
   `GET web-api/v1/ai-labs/tokens/`. The panel and the meter take them as
   inputs unchanged, so binding them is passing the field through.
   ===================================================================== */

/**
 * One row of the assignment list.
 *
 * `status` is an open string: the guide shows `graded`, and upstream's design names `not_started`,
 * `draft`, `submitted`, `grading` and `failed`. One the backend adds later renders as itself rather
 * than vanishing — see `statusUi` in the panel.
 *
 * The `ai_lab_*` trio is stamped only on rows that match a lab in this catalogue. The read spans every
 * assignment the learner ever attempted, so a row without them has no page to open.
 */
export interface AiLabPracticalAssignment {
  assignment_id: string;
  slug: string;
  status: string;
  attempts: number;
  /** Decimal strings (`"78.50"`), null until the first graded submission — render a dash, never 0%. */
  best_percentage: string | null;
  latest_percentage: string | null;
  latest_submission_id: string | null;
  ai_lab_course_id?: string;
  ai_lab_course_name?: string;
  ai_lab_square_thumbnail_url?: string | null;
}

/**
 * The learner's totals and rows. `average_percentage` is server-owned — never recompute it from the
 * rows, for the same reason `remaining` credits aren't derived from `cap - used`.
 *
 * `total_submissions` and `last_activity_at` are in upstream's design but not in the guide's
 * payload. They stay optional so the tile and the "Last active" line drop out rather than read 0.
 */
export interface AiLabPracticalProgress {
  assignments_available: number;
  assignments_attempted: number;
  assignments_completed: number;
  average_percentage: string;
  assignments: AiLabPracticalAssignment[];
  total_submissions?: number;
  last_activity_at?: string | null;
}

/** An open top-up request. Only `credits_requested` and `status` are evidenced in the guide. */
export interface AiLabTokenRequest {
  id: string;
  credits_requested: number;
  status: 'pending' | 'approved' | 'rejected';
  source: 'learner' | 'admin';
  /** ISO timestamp; not in the guide's sample, so "pending since" only shows when it is sent. */
  created_at?: string;
}

/**
 * The Copilot Credits balance. Amounts are decimal strings — formatted by `DecimalPipe` and never
 * computed with, except the meter's percentage. `null` where one of these is expected means "no
 * allotment", which both surfaces render as absence rather than a row of zeros.
 */
export interface AiLabTokenBalance {
  cap: number;
  used: string;
  remaining: string;
  non_billable: string;
  /** The day the usage covers. Null until the first sync. */
  as_of: string | null;
  /** When AI Labs last pulled usage from Microsoft. Null until the first sync. */
  synced_at: string | null;
  /** Lab access paused. Reported, not derived — "0.00" left is not the same as locked. */
  locked: boolean;
  pending_request: AiLabTokenRequest | null;
}

/** The two add-on sizes `tokens-request/` accepts. */
export type AiLabTokenAddOn = 500 | 1000;

/** Body of `POST api/v1/ai-labs/tokens-request/`. Strict: no other keys. */
export interface AiLabTokenRequestBody {
  tokens: AiLabTokenAddOn;
  reason?: string;
}

/* =====================================================================
   AI Lab course page.

   View models for `pages/ai-lab-course`. As with the progress panel, these
   describe what the page renders rather than what any endpoint returns — the
   reads behind them are not bound.
   ===================================================================== */

/**
 * Where the learner is in the course, which is what the primary CTA reads from.
 *
 * A local union rather than offerings' `ActionStatus` enum: a feature may not import another
 * feature (AGENTS.md §3), and promoting that enum to `core/` would be a refactor riding on a
 * feature change. The spellings match the API's `action_status` so the binding ticket is a cast,
 * not a translation.
 */
export type AiLabCtaStage =
  'TAKE_QUIZ' | 'TAKE_EXAM' | 'REWATCH' | 'RETAKE_EXAM' | 'FEEDBACK' | 'DOWNLOAD';

/** The stages that sit past the chapter quiz — reaching any of them means it is behind the learner. */
export const AI_LAB_QUIZ_BEHIND: readonly AiLabCtaStage[] = [
  'TAKE_EXAM',
  'RETAKE_EXAM',
  'FEEDBACK',
  'DOWNLOAD',
];

/** One Copilot Studio agent — a row of `agents` on `web-api/v1/ai-labs/agents/`. */
export interface AiLabAgent {
  kind: 'agent';
  /** What `assignment-submit/` takes as `agent_ref`. */
  id: string;
  name: string;
  published: boolean;
  /** ISO timestamp. */
  modified_on: string;
}

/** One Power Automate flow — a row of `flows` on `web-api/v1/ai-labs/flows/`. */
export interface AiLabFlow {
  kind: 'flow';
  id: string;
  name: string;
  /** A disabled flow cannot run, so it cannot be evaluated — the picker skips it. */
  enabled: boolean;
  modified_on: string;
  /** In upstream's design, not in the guide's sample — rendered only when sent. */
  description?: string;
}

/**
 * Body of `POST api/v1/ai-labs/assignment-submit/<uuid>/`: the picked row's `id` and which list it
 * came from. Strict — the old `artefact_env_id` / `artefact_schema` are refused.
 */
export interface AiLabSubmitBody {
  artefact_kind: 'agent' | 'flow';
  agent_ref: string;
}

/** Which panel the evaluation section shows. Derived from `assessment_status` on the page. */
export type AiLabLabStatus = 'not_started' | 'in_progress' | 'completed' | 'error';

/**
 * `data` of `GET web-api/v1/ai-labs/assignment-status/<uuid>/` (`docs/AI_LABS_API.md` §8).
 *
 * `assessment_status` is an open string: the guide evidences `in_progress` and `completed`.
 * Everything past it is null until the evaluation completes. A learner who hasn't started the lab
 * gets a 404 `no_ai_lab_enrollment` instead of this body.
 */
export interface AiLabAssignmentStatus {
  assessment_status: string;
  /** Latched once graded — stays true while a resubmission is being evaluated. */
  ai_assessment_completed: boolean;
  submission_id: string | null;
  artefact_kind: 'agent' | 'flow' | null;
  submitted_at: string | null;
  completed_at: string | null;
  evaluated_at: string | null;
  /** Raw marks — not out of 10, and not what the page leads with. */
  score: number | null;
  percentage: number | null;
  /** The evaluator's verdict. */
  master_comment: string | null;
  /** Secondary remarks — smaller points that didn't change the verdict. */
  minor_comment: string | null;
  grade_card_pdf_url: string | null;
  grade_card_expires_at: string | null;
  grade_card_is_expired: boolean;
  /** The backend refuses another submit (409 `practical_already_completed`) unless this is true. */
  can_resubmit: boolean;
}

/** One file the learner builds against. The URL is signed and expires (~1 h). */
export interface AiLabInputFile {
  name: string;
  url: string;
}

/**
 * `brief` of `GET web-api/v1/ai-labs/assignment-brief/<uuid>/` — what the learner is asked to
 * build. The mark scheme is stripped server-side.
 *
 * Absent by design when the lab has no practical configured (409 `ai_lab_assignment_not_configured`)
 * — the page then renders one line instead of a brief block.
 */
export interface AiLabAssignmentBrief {
  slug: string;
  name: string;
  details: string | null;
  /** Prose. May carry newlines — rendered with `whitespace-pre-line`. */
  problem_statement: string;
  logic_flow: string | null;
  guardrails: string | null;
  difficulty: string | null;
  version: number;
  published_date: string | null;
  input_files: AiLabInputFile[];
  /** Plain sentences on our backend; upstream's design had marks and expected behaviour too. */
  scenarios: string[];
  tools: string[];
}

/**
 * One row of the lab-materials block: either a plain outbound link carried by the course payload,
 * or an action that has to go through a service.
 */
export type AiLabMaterial =
  | { kind: 'link'; label: string; hint: string; url: string }
  | { kind: 'action'; label: string; hint: string; action: 'exercise' | 'workspace' };
