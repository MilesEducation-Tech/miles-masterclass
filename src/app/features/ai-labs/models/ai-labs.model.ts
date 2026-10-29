import { lucideLayers } from '@ng-icons/lucide';
import { iconCopilotOutline } from '@core/constants/icon';

/* =====================================================================
   Catalogue + lab account.

   Wire types from `docs/AI_LABS_API.md` §3 and §7. The guest catalogue is
   core's `MasterclassCourse` (the rail serves the `tracks-page/` card), so
   only the lab-side shapes live here.
   ===================================================================== */

/**
 * Why a lab can't be started. The lock is keyed on the lab's PARENT masterclass course, whose id
 * is always sent — it is also what the catalogue groups labs under.
 */
export interface AiLabLockState {
  locked: boolean;
  /** `credit_already_earned_via_course` | `started_via_masterclass_course` when locked. */
  lock_reason: string | null;
  /** The sentence to show for it. */
  lock_remark: string | null;
  masterclass_course_id: string | null;
  credit_source: string | null;
}

/** One row of `GET web-api/v1/ai-labs/courses/`. */
export interface AiLabCourseListItem {
  id: string;
  ai_lab_course_name: string;
  ai_lab_course_agent_flow_name: string | null;
  ai_lab_course_mini_description: string | null;
  ai_lab_course_horizontal_thumbnail_url: string | null;
  ai_lab_course_vertical_thumbnail_url: string | null;
  ai_lab_course_square_thumbnail_url: string | null;
  /** Display text ("44 minutes"). Preferred over the seconds field, which disagrees with it on UAT. */
  ai_lab_course_total_duration: string | null;
  ai_lab_course_order: number;
  ai_lab_course_access_duration_days: number;
  ai_lab_course_total_duration_seconds: number;
  lock_state: AiLabLockState;
}

/** The web pagination block — `data` itself, with the list under `results`. */
export interface AiLabWebPage<T> {
  slug: string;
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  results: T[];
}

/** Every `reason` the three account routes answer, success and error alike. */
export type AiLabAccountReason =
  | 'OK'
  | 'NO_CAIRA_ENROLLMENT'
  | 'MISSING_REQUIRED_FIELDS'
  | 'ACCOUNT_EXISTS'
  | 'ACCOUNT_NOT_CREATED'
  | 'PROVISIONING_STARTED'
  | 'PROVISIONING_IN_PROGRESS'
  | 'RESET_EMAIL_SENT'
  | 'RESET_EMAIL_RATE_LIMITED'
  | 'RESET_EMAIL_FAILED'
  | 'AI_LABS_DISABLED';

/**
 * `data` of `account-ensure/`, `account-create/` and `account-reset-password/` — on their error
 * statuses too (422, 429, 502, 503), so a caller reads `reason` off the error body as well.
 */
export interface AiLabAccountState {
  eligible: boolean;
  reason: AiLabAccountReason;
  account_created: boolean;
  /**
   * On `ACCOUNT_EXISTS`: the learner's token predates the AI Labs entitlement, which only a fresh
   * token carries. The guide's instruction is to force a re-login.
   */
  entitlement_refresh_required?: boolean;
  /** Only with `?include=labs_account`, and absent when AI Labs couldn't be asked. */
  labs_account?: AiLabLabsAccount;
}

/** The AI Labs side of the learner's account (guide §7, `account-ensure/?include=labs_account`). */
export interface AiLabLabsAccount {
  exists: boolean;
  /** `false`: the login token predates the account — a re-login fixes it. */
  entitled: boolean;
  enrolled: boolean;
  /** `false` (with `lab_email` null) while the account is still being built. */
  provisioned: boolean;
  /** The Microsoft account this learner's lab belongs to, e.g. `learner.4f2a@milesailabs.onmicrosoft.com`. */
  lab_email: string | null;
  /** The learner's own Copilot Studio environment. */
  environment_url: string | null;
}

/**
 * One catalogue tile: a masterclass course from the rail for a guest, a lab for a learner.
 *
 * `route` is what the click navigates to, relative to the locale prefix — the masterclass course
 * page, or the lab's own page. The optional fields are the ones a row may simply not carry — the
 * card renders without them rather than with a placeholder.
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
  /** Display text, as the API sends it ("44 minutes"). */
  duration?: string | null;
  questionCount?: number;
  /** Router commands after the locale prefix, e.g. `['masterclass', id, slug]`. */
  route: readonly string[];
}

/** One catalogue rail: a heading and its cards. */
export interface AiLabCatalogueSection {
  heading: string;
  cards: AiLabAgentCard[];
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
  /**
   * Our own counts (2026-10-28), on rows that match one of our labs — `attempts` above is AI Labs'
   * figure. The landing facade reads the row's attempts and best score from here when it's sent.
   */
  practical_attempts?: AiLabPracticalAttempts;
}

/** `practical_attempts` on a practical-progress row: the same figures `assignment-status/` answers. */
export interface AiLabPracticalAttempts {
  max_attempts: number;
  attempts_used: number;
  attempts_left: number;
  best_attempt_number: number | null;
  /** Numbers here (`9.0` of `10.0`, `90.0`), unlike the row's decimal strings. */
  best_score: number | null;
  best_max_score: number | null;
  best_percentage: number | null;
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
   The lab page.

   Wire types from `docs/AI_LABS_API.md` §3–4: `course/<uuid>/`,
   `course-started/<uuid>/`, `course-start/<uuid>/`, `course-progress/<uuid>/`
   and `course-video-progress/`.
   ===================================================================== */

/** A field of study and the credit it carries. */
export interface AiLabFieldOfStudy {
  id: string;
  name: string;
  cpe_credit: number;
}

/** The parent masterclass course a lab hangs off. */
export interface AiLabParentCourse {
  id: string;
  name: string;
  mini_description: string | null;
  thumbnail: string | null;
  duration: string | null;
  duration_seconds: number;
}

/** One of an instructor's profile links. */
export interface AiLabSocialLink {
  title: string;
  url: string;
  icon_url: string | null;
}

/** An instructor on the lab. Only the detail read carries these; unfilled fields are `null`. */
export interface AiLabInstructor {
  id: string;
  name: string;
  designation: string | null;
  bio: string | null;
  profile_image: string | null;
  horizontal_image_url: string | null;
  vertical_image_url: string | null;
  square_image_url: string | null;
  video_url: string | null;
  social_links: AiLabSocialLink[];
  linkedin_url: string | null;
}

/**
 * The lab's one video. `hls_video_link` is what `course-video-progress/` measures, against
 * `duration_seconds` — and it is `null` until the lab is started, so the detail is re-read after
 * `course-start/`.
 */
export interface AiLabChapter {
  id: string;
  name: string;
  mini_description: string | null;
  description: string | null;
  hls_video_link: string | null;
  duration_seconds: number;
  transcript_url: string | null;
  transcript_text: string | null;
  order: number;
}

/** The starter kit that ships with a lab: prompts, sample files. */
export interface AiLabKit {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  url: string | null;
  pdf_url: string | null;
}

/**
 * `data` of `GET web-api/v1/ai-labs/course/<uuid>/`. The trailer plays before the start; the lab
 * video is `chapter.hls_video_link`. Video, trailer and instructor fields are on this read only —
 * the list and card reads don't carry them.
 */
export interface AiLabCourseDetail extends AiLabCourseListItem {
  ai_lab_course_description: string | null;
  ai_lab_course_problem_statement: string | null;
  /** The SharePoint workspace the learner builds in, once configured. */
  ai_lab_course_sharepoint_artefact_url: string | null;
  ai_lab_course_trailer_url: string | null;
  ai_lab_course_trailer_thumbnail: string | null;
  ai_lab_course_exam_rules: string | null;
  ai_lab_course_prerequisite_education: string | null;
  ai_lab_course_advance_preparation: string | null;
  /**
   * The Hints card, in display order — plain text, the same for every learner, sent whether or
   * not the lab is started. Always present; `[]` when the lab has none (then the card is hidden).
   */
  ai_lab_course_hints: string[];
  ai_lab_course_created_at: string;
  levels: string[];
  tracks: string[];
  fields_of_study: AiLabFieldOfStudy[];
  /** The total, summed by the API. Render it as sent; never re-sum. */
  total_cpe_credits: number;
  /** Can be `[]`. */
  instructors: AiLabInstructor[];
  skills: string[];
  tools: string[];
  learning_objectives: string[];
  masterclass_courses: AiLabParentCourse[];
  ai_kit: AiLabKit | null;
  chapter: AiLabChapter | null;
  /**
   * The final assessment's size and pass mark (2026-10-28), so the page can say them before the
   * learner starts. `null` when the lab has no MCQ set up.
   */
  assessment_questions_to_show?: number | null;
  assessment_pass_threshold_percent?: number | null;
  /** The NASBA delivery method — the same value as progress's `nasba.delivery_method`. */
  delivery_method?: string;
  /** Per learner: when they passed the final assessment; `null` before. */
  final_assessment_passed_at?: string | null;
  /** Per learner: `locked` until started. */
  final_assessment_status?: AiLabFinalAssessmentStatus;
}

/** The learner's enrolment on one lab, as `course-started/` reports it. */
export interface AiLabEnrollment {
  id: string;
  ai_lab_enrollment_started_at: string;
  ai_lab_enrollment_expires_at: string;
  ai_lab_enrollment_active: boolean;
  ai_lab_enrollment_is_course_closed: boolean;
  released_from_ai_lab: boolean;
}

/** `data` of `GET web-api/v1/ai-labs/course-started/<uuid>/`. Start vs Continue. */
export interface AiLabCourseStarted {
  ai_lab_course_id: string;
  started: boolean;
  can_start: boolean;
  enrollment: AiLabEnrollment | null;
  lock_state: AiLabLockState;
}

/**
 * Which step the backend says comes next. An open string beyond the evidenced ones. The practical
 * left this flow on 2026-10-27: a passed final assessment answers `feedback`, never `ai_assessment`.
 */
export type AiLabNextStep =
  'video' | 'quiz' | 'final_assessment' | 'feedback' | 'done' | (string & {});

/** One NASBA condition still outstanding before credit can be awarded. */
export interface AiLabNasbaOutstanding {
  rule: string;
  code: string;
  message: string;
}

/**
 * `final_assessment_status` — what the final-assessment button should be (`docs/AI_LABS_API.md`
 * §1a). On the lab detail, `course-progress/` and the assessment submit. Descriptive only: the
 * routes still enforce every rule.
 */
export type AiLabFinalAssessmentState =
  'locked' | 'start' | 'cool_off' | 'retake' | 'passed' | 'ended' | (string & {});

export interface AiLabFinalAssessmentStatus {
  final_assessment_enum_values: AiLabFinalAssessmentState;
  /** UTC; set while `cool_off`. */
  final_assessment_cool_off_ends_at: string | null;
}

/**
 * `data` of `GET web-api/v1/ai-labs/course-progress/<uuid>/` — the gate flags the whole page runs
 * on. A learner who hasn't started gets a 404 `no_ai_lab_enrollment` instead of this body.
 */
export interface AiLabCourseProgress {
  ai_lab_course_id: string;
  video_watched_seconds: number;
  video_completed: boolean;
  quiz_required: boolean;
  quiz_passed: boolean;
  quiz_questions_to_show: number;
  assessment_required?: boolean;
  final_assessment_passed: boolean;
  /** When the final assessment was passed (2026-10-28); `null` before. */
  final_assessment_passed_at?: string | null;
  /** A latch from before the practical left the flow — set with no graded attempt behind it. Unread. */
  ai_assessment_completed: boolean;
  feedback_submitted: boolean;
  /**
   * The CPE credited for this lab: a number since 2026-10-28 (`0.0` until it closes with credit),
   * a boolean before. Both shapes until UAT runs the new build.
   */
  cpe_awarded: number | boolean;
  is_course_closed: boolean;
  next_step: AiLabNextStep;
  nasba: {
    eligible: boolean;
    delivery_method: string | null;
    outstanding: AiLabNasbaOutstanding[];
  };
  /**
   * The learner's issued lab certificate PDF (2026-10-27). `null` before feedback, for a few seconds
   * after it while the PDF is generated, if generation failed, or when the lab has no template.
   */
  lab_certificate_url: string | null;
  final_assessment_status?: AiLabFinalAssessmentStatus;
}

/** Body of `POST api/v1/ai-labs/course-video-progress/`. Strict: no other keys. */
export interface AiLabVideoProgressBody {
  ai_lab_course_id: string;
  watched_duration_seconds: number;
}

/* =====================================================================
   AI Lab course page.

   View models and the practical's wire types for `pages/ai-lab-course`.
   ===================================================================== */

/**
 * Where the learner is in the lab, which is what the primary CTA reads from. Derived from
 * `course-progress/`'s `next_step` by `AiLabCourseFacade`.
 *
 * The first six are upstream's, from the micro-learning `action_status`. The rest are ours:
 *  - `START` — no enrolment yet; `course-start/` creates it.
 *  - `COOL_OFF` — the last exam attempt failed and the wait is still running
 *    (`final_assessment_status: cool_off`): the button is disabled and says until when.
 *  - `DOWNLOAD` / `CERTIFICATE_PENDING` — the lab is closed (`next_step: done`) and
 *    `lab_certificate_url` is a link / still `null` while the PDF is generated.
 */
export type AiLabCtaStage =
  | 'START'
  | 'TAKE_QUIZ'
  | 'TAKE_EXAM'
  | 'REWATCH'
  | 'RETAKE_EXAM'
  | 'COOL_OFF'
  | 'FEEDBACK'
  | 'DOWNLOAD'
  | 'CERTIFICATE_PENDING';

/** The stages that sit past the chapter quiz — reaching any of them means it is behind the learner. */
export const AI_LAB_QUIZ_BEHIND: readonly AiLabCtaStage[] = [
  'TAKE_EXAM',
  'RETAKE_EXAM',
  'COOL_OFF',
  'FEEDBACK',
  'DOWNLOAD',
  'CERTIFICATE_PENDING',
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
 * Since 2026-10-27 the score, comments and grade card are the BEST graded attempt's. A learner who
 * hasn't started the lab gets a 404 `no_ai_lab_enrollment` instead of this body.
 *
 * `completed` alone doesn't mean graded: learners latched before the practical left the CPE flow
 * read `completed` with no submission and `attempts_used: 0`. `attempts_used` is what counts.
 */
export interface AiLabAssignmentStatus {
  assessment_status: string;
  /** The pre-split latch (see above) — unread. */
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
  /** The best attempt's denominator (2026-10-28): `score` 8.0 of `max_score` 10.0. */
  max_score?: number | null;
  /** The lab's allowance of graded attempts (admin "Max practical attempts"). */
  max_attempts: number;
  /** Graded attempts so far — one still grading, or one AI Labs failed to grade, doesn't count. */
  attempts_used: number;
  /** At 0 the submit answers 409 `practical_attempts_exhausted`. */
  attempts_left: number;
  /** The final assessment is passed, nothing is grading, and attempts are left. */
  can_resubmit: boolean;
}

/**
 * One brief file. Exercise files, the flow chart and the sample card are signed links that die in
 * ~15 minutes; build guides are public. Every key is always present.
 */
export interface AiLabFile {
  url: string;
  /** `excel` / `csv` / `pdf` / `text` / `json` / `image` / `other`. */
  doc_type: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  sort_order: number;
}

/** An external (SharePoint) link. Not signed. */
export interface AiLabLink {
  url: string;
  /** Link text; fall back to the URL when null. */
  label: string | null;
  sort_order: number;
}

/** A worked example of how work is marked — not the learner's own grade card. */
export interface AiLabSampleGradeCard extends AiLabFile {
  /** Decimal string out of 10, e.g. `"7.85"`. */
  sample_grade: string | null;
}

/**
 * `brief` of `GET web-api/v1/ai-labs/assignment-brief/<uuid>/` — AI Labs' learner brief, relayed
 * as is (`docs/AI_LABS_API.md` §8, re-cut 2026-10-22/23). The marking scheme is never sent.
 *
 * `Cache-Control: no-store`, and its file links expire — re-read it rather than reuse an old link.
 * A learner with no AI Labs account gets `brief: {}` (`is_provisioned: false`); a lab with no
 * practical configured gets a 409 `ai_lab_assignment_not_configured` instead of this body.
 */
export interface AiLabAssignmentBrief {
  slug: string;
  name: string;
  details: string | null;
  /** Markdown — rendered, never shown raw. */
  problem_statement: string;
  guardrails: string | null;
  requirements: string[] | null;
  exercise_files: AiLabFile[];
  build_guides: AiLabFile[];
  sharepoint_links: AiLabLink[];
  sample_grade_card: AiLabSampleGradeCard | null;
  flow_chart: AiLabFile | null;
  /** Whether AI Labs' "send me test e-mails" helper applies (`assignment-trigger-email/`). */
  tools: { trigger_email: boolean } | null;
}

/**
 * `data` of `POST assignment-trigger-email/<uuid>/` (2026-10-29): AI Labs accepted one batch of
 * sample emails for the lab mailbox. They arrive minutes later; there is nothing to poll.
 */
export interface AiLabTestEmailRun {
  status: 'ok';
  ai_lab_course_id: string;
  /** Written by AI Labs for the learner — it names the mailbox and warns about the delay. */
  message: string | null;
  run: {
    /** For support only; never shown. */
    id: string;
    /** The lab mailbox (`…@mileslabs.ai`), never the learner's own address. */
    recipient: string;
    requested_at: string;
  };
}

/**
 * One build hint as the Hints card shows it: an entry of the detail's `ai_lab_course_hints`, numbered
 * by its place (the API sends plain strings). Plain text — rendered as text, never as HTML.
 */
export interface AiLabHint {
  id: number;
  hint: string;
}

/**
 * One graded practical attempt, from `assignment-attempts/`. Decimals are strings: `score` out of
 * `max_score` (`"8.80"` of `"10.00"`) and `percentage` (`"88.00"`).
 */
export interface AiLabAttempt {
  attempt_number: number;
  status: string;
  score: string | null;
  max_score: string | null;
  percentage: string | null;
  submitted_at: string;
  graded_at: string;
  /** Signed grade-card PDF, dead at `grade_card_urls_expire_at`; `null` means no PDF. */
  grade_card_url: string | null;
  /** The grader's headline and the line under it, as on the PDF. Either may be `null`. */
  master_comment: string | null;
  minor_comment: string | null;
}

/**
 * `data` of `GET web-api/v1/ai-labs/assignment-attempts/<uuid>/`: EVERY graded attempt, oldest
 * first (2026-10-27). The best one (`best_attempt_number`) is the learner's result.
 * `is_provisioned: false` answers an empty list.
 */
export interface AiLabAttempts {
  is_provisioned: boolean;
  /** AI Labs' own count, relayed — the allowance we show is `max_attempts`. */
  total_attempts: number;
  /** AI Labs' own number, relayed. `null` without a lab account. */
  allowed_attempt: number | null;
  /** When every `grade_card_url` in this response stops working. */
  grade_card_urls_expire_at: string | null;
  /** The lab's allowance of graded attempts. */
  max_attempts: number;
  attempts_used: number;
  attempts_left: number;
  /** The attempt whose score is the result; `null` before any grade. */
  best_attempt_number: number | null;
  attempts: AiLabAttempt[];
}

/* =====================================================================
   The lab quiz.

   Wire types from `docs/AI_LABS_API.md` §5: `course-quiz-questions/<uuid>/`
   and `course-quiz-submit/`. Formative — one answer per call, graded
   server-side, with every option's explanation in the answer.
   ===================================================================== */

/** One option. Graded fields arrive only on a resumed form's answered questions. */
export interface AiLabQuizOption {
  id: string;
  /** May carry HTML (`<p>…</p>`) — rendered through Angular's sanitiser. */
  text: string;
  order: number;
  is_correct?: boolean;
  explanation?: string | null;
}

export interface AiLabQuizQuestion {
  id: string;
  /** May carry HTML — rendered through Angular's sanitiser. */
  question_text: string;
  /** `single` answers on one click; anything else is a set of checkboxes. */
  question_type: string;
  options: AiLabQuizOption[];
  is_answered: boolean;
  /** On an answered question of a resumed form. */
  explanation?: string | null;
  is_correct?: boolean | null;
  selected_option_ids?: string[];
}

/** `data` of `GET web-api/v1/ai-labs/course-quiz-questions/<uuid>/`. */
export interface AiLabQuiz {
  ai_lab_course_id: string;
  ai_lab_chapter_id: string;
  questions_to_show: number;
  /** Some questions were answered on an earlier visit; their grades come back with them. */
  resumed: boolean;
  answered_count: number;
  questions: AiLabQuizQuestion[];
}

/** Body of `POST api/v1/ai-labs/course-quiz-submit/`. Strict: no other keys. */
export interface AiLabQuizAnswerBody {
  ai_lab_course_id: string;
  question_id: string;
  selected_option_ids: string[];
}

/** `data` of `course-quiz-submit/`: the verdict on one answer, and where the attempt stands. */
export interface AiLabQuizAnswerResult {
  question_id: string;
  is_correct: boolean;
  correct_option_ids: string[];
  explanation: string | null;
  options_feedback: { id: string; text: string; is_correct: boolean; explanation: string | null }[];
  answers_submitted: number;
  total_questions: number;
  is_quiz_completed: boolean;
  score_percent: number | null;
}

/**
 * One question's grade, as the panel shows it. `is_correct` is null for a resumed question whose
 * verdict the form didn't carry — the options still show their explanations.
 */
export interface AiLabQuizGrade {
  selected: string[];
  is_correct: boolean | null;
  explanation: string | null;
  options: Record<string, { is_correct: boolean; explanation: string | null }>;
}

/** A resumed form's answered question, as a grade — or null if it isn't answered. */
export function gradeOfAnsweredLabQuestion(question: AiLabQuizQuestion): AiLabQuizGrade | null {
  if (!question.is_answered) return null;
  return {
    selected: question.selected_option_ids ?? [],
    is_correct: question.is_correct ?? null,
    explanation: question.explanation ?? null,
    options: Object.fromEntries(
      question.options.map((o) => [
        o.id,
        { is_correct: o.is_correct === true, explanation: o.explanation ?? null },
      ]),
    ),
  };
}

/** A submit's verdict, as a grade. */
export function gradeOfLabQuizResult(
  selected: string[],
  result: AiLabQuizAnswerResult,
): AiLabQuizGrade {
  const correct = new Set(result.correct_option_ids);
  return {
    selected,
    is_correct: result.is_correct,
    explanation: result.explanation,
    options: Object.fromEntries(
      result.options_feedback.map((o) => [
        o.id,
        { is_correct: o.is_correct || correct.has(o.id), explanation: o.explanation },
      ]),
    ),
  };
}

/* =====================================================================
   The lab's final assessment.

   Wire types from `docs/AI_LABS_API.md` §6: `course-assessment-questions/<uuid>/`
   and `course-assessment-submit/<uuid>/`. No sittings: one read, one submit,
   and the submit's answer carries the whole review.
   ===================================================================== */

export interface AiLabExamOption {
  id: string;
  /** May carry HTML — rendered through Angular's sanitiser. */
  text: string;
  order: number;
}

export interface AiLabExamQuestion {
  id: string;
  /** May carry HTML — rendered through Angular's sanitiser. */
  question_text: string;
  /** `single`, or `multi` (checkboxes). */
  question_type: string;
  options: AiLabExamOption[];
}

/** `data` of `GET web-api/v1/ai-labs/course-assessment-questions/<uuid>/`. */
export interface AiLabExamPaper {
  ai_lab_course_id: string;
  questions_to_show: number;
  pass_threshold_percent: number;
  /** May carry HTML. */
  exam_rules: string | null;
  previous_attempts: number;
  questions: AiLabExamQuestion[];
}

/** One answer of `POST course-assessment-submit/<uuid>/`. Every answer must carry a selection. */
export interface AiLabExamAnswer {
  question_id: string;
  selected_option_ids: string[];
}

/** `data` of `course-assessment-submit/`: the score, and the review of every answer. */
export interface AiLabExamResult {
  passed: boolean;
  score_percent: number;
  pass_threshold_percent: number;
  answers: {
    question_id: string;
    is_correct: boolean;
    explanation: string | null;
    correct_option_ids: string[];
    options_feedback: {
      id: string;
      text: string;
      is_correct: boolean;
      explanation: string | null;
    }[];
  }[];
  next_step: AiLabNextStep;
  ai_assessment_completed?: boolean;
  /** `passed`, or `cool_off` (with its end) / `retake` after a fail. */
  final_assessment_status?: AiLabFinalAssessmentStatus;
}

/** One option of a report answer. The answer key's fields are absent when it is withheld. */
export interface AiLabExamReportOption {
  id: string;
  /** May carry HTML. */
  text: string;
  was_selected: boolean;
  is_correct?: boolean;
  explanation?: string | null;
}

/** One question of the latest attempt, as `course-assessment-report/` returns it. */
export interface AiLabExamReportAnswer {
  question_id: string;
  /** May carry HTML; "[Question no longer available]" with no options when it was deleted. */
  question_text: string;
  is_skipped: boolean;
  /** `null` when the answer key is withheld. */
  is_correct: boolean | null;
  explanation: string | null;
  selected_option_ids: string[];
  correct_option_ids: string[];
  options: AiLabExamReportOption[];
}

/**
 * `data` of `GET web-api/v1/ai-labs/course-assessment-report/<uuid>/` (2026-10-28): the learner's
 * latest final-assessment attempt, read back at any time. Always a 200 for a lab they can see.
 *
 * `feedback_withheld`: after a failed attempt the key is shown only when the paper is drawn from a
 * question bank (NASBA 6.01.2(1)(ii)); otherwise the score and choices stay and the key goes.
 */
export interface AiLabExamReport {
  ai_lab_course_id: string;
  ai_lab_course_name: string;
  has_final_assessment: boolean;
  status: 'passed' | 'failed' | 'not_attempted' | (string & {});
  attempt_count: number;
  pass_threshold_percent: number | null;
  questions_to_show: number | null;
  attempt_id: string | null;
  score_percent: number | null;
  attempted_at: string | null;
  passed_at: string | null;
  total_questions: number;
  correct_count: number;
  skipped_count: number;
  feedback_withheld: boolean;
  answers: AiLabExamReportAnswer[];
}

/**
 * One question as the review lists it — the masterclass report's item. `skipped` and `withheld`
 * (the answer key hidden after a failed attempt) come only from a report read back.
 */
export interface AiLabExamReviewItem {
  id: string;
  /** Its position in the paper, from 1. */
  number: number;
  question: string;
  status: 'correct' | 'incorrect' | 'skipped' | 'withheld';
  yourAnswer: string[];
  /** The correct options' texts, for a missed question. */
  correctAnswer: string[];
  /** The question's explanation, else the correct option's. */
  explanation: string | null;
}

/** The review, in paper order, from the paper, what was sent, and the submit's answer. */
export function labExamReview(
  paper: AiLabExamPaper,
  sent: Record<string, string[]>,
  result: AiLabExamResult,
): AiLabExamReviewItem[] {
  const graded = new Map(result.answers.map((a) => [a.question_id, a]));
  return paper.questions.map((question, i) => {
    const answer = graded.get(question.id);
    const textOf = (id: string) =>
      question.options.find((o) => o.id === id)?.text ??
      answer?.options_feedback.find((o) => o.id === id)?.text ??
      '';
    const correct = answer?.correct_option_ids ?? [];
    const correctExplanation =
      answer?.options_feedback.find((o) => o.is_correct)?.explanation ?? null;
    return {
      id: question.id,
      number: i + 1,
      // A heading is plain text; the question may carry HTML.
      question: question.question_text.replace(/<[^>]*>/g, '').trim(),
      status: answer?.is_correct ? 'correct' : 'incorrect',
      yourAnswer: (sent[question.id] ?? []).map(textOf),
      correctAnswer: answer?.is_correct ? [] : correct.map(textOf),
      explanation: answer?.explanation ?? correctExplanation,
    };
  });
}

/** The review of a report read back, in the order the questions were asked. */
export function labReportReview(report: AiLabExamReport): AiLabExamReviewItem[] {
  return report.answers.map((answer, i) => {
    const textOf = (id: string) => answer.options.find((o) => o.id === id)?.text ?? '';
    const status: AiLabExamReviewItem['status'] = answer.is_skipped
      ? 'skipped'
      : answer.is_correct === null
        ? 'withheld'
        : answer.is_correct
          ? 'correct'
          : 'incorrect';
    return {
      id: answer.question_id,
      number: i + 1,
      question: answer.question_text.replace(/<[^>]*>/g, '').trim(),
      status,
      yourAnswer: answer.selected_option_ids.map(textOf),
      // The key, for a missed question — empty when it is withheld.
      correctAnswer: answer.is_correct ? [] : answer.correct_option_ids.map(textOf),
      explanation:
        answer.explanation ?? answer.options.find((o) => o.is_correct)?.explanation ?? null,
    };
  });
}

/* =====================================================================
   Feedback, which closes the lab.

   Wire types from `docs/AI_LABS_API.md` §9: `course-feedback-gate/<uuid>/`,
   `course-feedback-questions/<uuid>/` and `course-feedback-submit/<uuid>/`.
   ===================================================================== */

/**
 * `data` of `GET web-api/v1/ai-labs/course-feedback-gate/<uuid>/`. A refusal is a 200 with
 * `allowed: false`: `reason` is `no_ai_lab_enrollment` or `final_assessment_not_passed`, and
 * `remark` is the sentence to show.
 */
export interface AiLabFeedbackGate {
  ai_lab_course_id: string;
  allowed: boolean;
  reason: string | null;
  remark: string | null;
  ai_assessment_completed: boolean;
  already_submitted: boolean;
}

export interface AiLabFeedbackQuestion {
  id: string;
  feedback_question: string;
  /** `rating` (1–5 stars) or `text`. */
  feedback_question_type: string;
  feedback_question_order: number;
}

/** One response. A rating question sends `rating`; a text question sends `text_response`. */
export interface AiLabFeedbackResponse {
  question_id: string;
  rating?: number;
  text_response?: string;
}

/** One stored answer of `course-feedback-responses/`. The unused field is `null` / `""`. */
export interface AiLabFeedbackAnswer {
  question_id: string;
  question: string;
  question_type: 'rating' | 'text' | (string & {});
  question_order: number;
  rating: number | null;
  text_response: string;
  submitted_at: string | null;
}

/**
 * `data` of `GET web-api/v1/ai-labs/course-feedback-responses/<uuid>/` (2026-10-28): what the
 * learner submitted. A question shared by every lab is stored once per learner, so `responses` can
 * be shorter than the form while `submitted` is true — the gap is not "unsubmitted".
 */
export interface AiLabFeedbackAnswers {
  ai_lab_course_id: string;
  submitted: boolean;
  submitted_at: string | null;
  question_count: number;
  answered_count: number;
  responses: AiLabFeedbackAnswer[];
}

/** Body of `POST api/v1/ai-labs/course-feedback-submit/<uuid>/`. Strict: no other keys. */
export interface AiLabFeedbackBody {
  responses: AiLabFeedbackResponse[];
  optional_feedback_text: string;
}

/**
 * `data` of `course-feedback-submit/`: the lab is closed. `lab_certificate_url` is null while the
 * certificate is generated (`lab_certificate_triggered`).
 */
export interface AiLabFeedbackResult {
  feedback_submitted: boolean;
  already_submitted: boolean;
  cpe_awarded: number;
  lab_certificate_triggered?: boolean;
  lab_certificate_url?: string | null;
  badge_issued?: boolean;
  certificate_triggered?: boolean;
  masterclass_course_closed?: boolean;
  next_step: AiLabNextStep;
}
