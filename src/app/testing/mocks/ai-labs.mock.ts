import { Provider, signal } from '@angular/core';
import {
  AiLabAgent,
  AiLabAssignmentBrief,
  AiLabAssignmentStatus,
  AiLabAttempts,
  AiLabCourseDetail,
  AiLabCourseProgress,
  AiLabCourseStarted,
  AiLabCtaStage,
  AiLabExamPaper,
  AiLabExamResult,
  AiLabFeedbackQuestion,
  AiLabFeedbackResult,
  AiLabFlow,
  AiLabPracticalProgress,
  AiLabQuizGrade,
  AiLabQuizQuestion,
  AiLabTokenBalance,
  AiLabTokenRequest,
} from '@features/ai-labs/models/ai-labs.model';
import { AiLabAuth } from '@core/services/ai-lab-auth/ai-lab-auth';
import { AiLabAccount } from '@features/ai-labs/services/ai-lab-account';
import { AiLabCourseFacade } from '@features/ai-labs/services/ai-lab-course-facade';
import { AiLabCredits } from '@features/ai-labs/services/ai-lab-credits';
import { AiLabQuizFacade } from '@features/ai-labs/services/ai-lab-quiz-facade';
import { AiLabAssessmentFacade } from '@features/ai-labs/services/ai-lab-assessment-facade';
import { AiLabFeedbackFacade } from '@features/ai-labs/services/ai-lab-feedback-facade';

/**
 * Sample data for the AI Labs progress panel and token meter stories.
 *
 * Story-only: `testing/` is importable from `*.stories.ts` and nowhere else, which is the point —
 * neither component is mounted on a page yet, so this is how the design gets reviewed without
 * showing a learner invented credit balances and scores.
 *
 * The rows are deliberately a spread rather than happy paths: a graded lab whose best beats its
 * latest, one being graded, one untouched, and two that aren't in this catalogue (which must render
 * without a link).
 */

const S3 = 'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/';

/**
 * The `progress` object of `practical-progress/`, in the guide's shape (`docs/AI_LABS_API.md` §8):
 * percentages as decimal strings, and the `ai_lab_*` trio only on rows that match a lab in this
 * catalogue. `total_submissions` and `last_activity_at` are left out, as on the wire, so the
 * stories show the panel without those two.
 */
export const MOCK_AI_LAB_PROGRESS: AiLabPracticalProgress = {
  assignments_available: 5,
  assignments_attempted: 3,
  assignments_completed: 1,
  average_percentage: '49.00',
  assignments: [
    {
      assignment_id: 'b5e1c7a9-2d43-4f6e-8a1b-c9d0e3f72a54',
      slug: 'lease-audit-agent-la-01',
      status: 'graded',
      attempts: 15,
      best_percentage: '49.00',
      latest_percentage: '42.50',
      latest_submission_id: '3d7e9b42-6c1a-4f85-9e2b-7a4c1d8f0e63',
      ai_lab_course_id: 'f6570df7-0ad9-4463-9a4d-75df10e14d59',
      ai_lab_course_name: 'Lease Audit Agent',
      ai_lab_square_thumbnail_url: `${S3}processed_045cdbcababa4009a8fd343770aef3ac.webp`,
    },
    {
      assignment_id: '7c2f9e14-58ab-4d3c-b6e0-1f4a8d92c375',
      slug: 'revenue-recognition-agent-la-02',
      status: 'grading',
      attempts: 2,
      best_percentage: '61.00',
      latest_percentage: '61.00',
      latest_submission_id: 'a91d5c3e-0f72-4b68-9d14-6e2a8c7b3f05',
      ai_lab_course_id: '47ecd850-08ff-4342-abf2-9a432ba43e6a',
      ai_lab_course_name: 'Revenue Recognition Agent',
      ai_lab_square_thumbnail_url: `${S3}processed_0b68423183ee4f93944e29a940c8bab4.webp`,
    },
    {
      assignment_id: '2f8b6d1e-4c9a-4e7b-a3d5-0b1c9e8f7a62',
      slug: 'fixed-asset-rollforward-la-03',
      status: 'not_started',
      attempts: 0,
      best_percentage: null,
      latest_percentage: null,
      latest_submission_id: null,
      ai_lab_course_id: '9a3e5c7b-1d2f-4a6e-8b0c-3d5f7a9c1e2b',
      ai_lab_course_name: 'Fixed Asset Rollforward Agent',
      ai_lab_square_thumbnail_url: null,
    },
    // Not in this catalogue — no name (the slug is humanised), no thumbnail, no CTA.
    {
      assignment_id: '6e4a2c8f-0b7d-4f1e-9c3a-5d7b9f1e3a4c',
      slug: 'pbc-chaser-agent-la-04',
      status: 'failed',
      attempts: 1,
      best_percentage: null,
      latest_percentage: null,
      latest_submission_id: '8c6a4e2f-1b3d-4f5a-9e7c-0d2b4f6a8c1e',
    },
    // A status this build has never been told about: it must humanise rather than vanish.
    {
      assignment_id: '1a3c5e7f-9b2d-4f6a-8c0e-2b4d6f8a0c3e',
      slug: 'variance-explainer-la-05',
      status: 'needs_review',
      attempts: 1,
      best_percentage: '73.00',
      latest_percentage: '73.00',
      latest_submission_id: '5b7d9f1a-3c5e-4a7b-9d1f-3e5a7c9e1b5d',
    },
  ],
};

/** The `tokens` object of `tokens/`, in the guide's shape. */
export const MOCK_AI_LAB_BALANCE: AiLabTokenBalance = {
  cap: 2500,
  used: '1840.75',
  remaining: '659.25',
  non_billable: '12.50',
  as_of: '2026-10-19',
  synced_at: '2026-10-20T06:00:12Z',
  locked: false,
  pending_request: null,
};

/** An open top-up, as `tokens-request/` answers it, plus the `created_at` the panel shows when sent. */
export const MOCK_AI_LAB_PENDING_REQUEST: AiLabTokenRequest = {
  id: 'e8a41f36-9b2c-4d57-a0e3-6f1b2c9d84a7',
  credits_requested: 500,
  status: 'pending',
  source: 'learner',
  created_at: '2026-10-18T09:30:00Z',
};

/* ---------------------------------------------------------------------------
   AI Lab course page.
   --------------------------------------------------------------------------- */

export const MOCK_AI_LAB_BRIEF: AiLabAssignmentBrief = {
  slug: 'lease-audit-agent',
  name: 'Lease Audit Agent',
  details: 'Build an agent that compares lease contracts to schedules and flags exceptions.',
  problem_statement:
    '## Scenario\n\nThe audit team tests 40 leases a quarter against the lease schedule. Build a ' +
    'Copilot Studio agent that reads each contract, compares it to the schedule and routes every ' +
    'mismatch to a reviewer.\n\n- Extract commencement date, term and payments\n' +
    '- Flag any clause that changes the **ASC 842** classification\n' +
    '- Hand back a short summary a reviewer can act on',
  guardrails:
    'The agent must not approve or reject a lease, and must not invent figures that are not in ' +
    'the files provided.',
  requirements: null,
  exercise_files: [
    {
      url: 'https://example.com/ai-labs/lease-schedule.csv',
      doc_type: 'csv',
      filename: 'lease-schedule.csv',
      content_type: 'text/csv',
      size_bytes: 4096,
      sort_order: 0,
    },
    {
      url: 'https://example.com/ai-labs/lease-contracts.pdf',
      doc_type: 'pdf',
      filename: 'lease-contracts.pdf',
      content_type: 'application/pdf',
      size_bytes: 812_000,
      sort_order: 1,
    },
  ],
  build_guides: [],
  sharepoint_links: [
    { url: 'https://example.sharepoint.com/sites/leases', label: 'Lease library', sort_order: 2 },
  ],
  sample_grade_card: null,
  flow_chart: null,
  tools: { trigger_email: false },
};

/** The same brief with every optional part AI Labs can send. */
export const MOCK_AI_LAB_BRIEF_FULL: AiLabAssignmentBrief = {
  ...MOCK_AI_LAB_BRIEF,
  requirements: ['A Copilot Studio trial', 'The lease schedule CSV'],
  build_guides: [
    {
      url: 'https://example.com/ai-labs/build-guide.pdf',
      doc_type: 'pdf',
      filename: 'build-guide.pdf',
      content_type: 'application/pdf',
      size_bytes: 182_044,
      sort_order: 1,
    },
  ],
  sample_grade_card: {
    url: 'https://example.com/ai-labs/sample-grade-card.pdf',
    doc_type: 'pdf',
    filename: 'sample-grade-card.pdf',
    content_type: 'application/pdf',
    size_bytes: 96_211,
    sort_order: 3,
    sample_grade: '7.85',
  },
  flow_chart: {
    url: 'https://example.com/ai-labs/flow-chart.pdf',
    doc_type: 'pdf',
    filename: 'flow-chart.pdf',
    content_type: 'application/pdf',
    size_bytes: 55_302,
    sort_order: 4,
  },
  tools: { trigger_email: true },
};

export const MOCK_AI_LAB_AGENTS: AiLabAgent[] = [
  {
    kind: 'agent',
    id: 'cr7a2_leasereviewassistant',
    name: 'Lease Review Assistant',
    published: true,
    modified_on: '2026-10-18T14:22:10Z',
  },
  {
    kind: 'agent',
    id: 'cr7a2_leasereviewassistantv2',
    name: 'Lease Review Assistant (v2)',
    published: false,
    modified_on: '2026-10-16T09:05:47Z',
  },
];

export const MOCK_AI_LAB_FLOWS: AiLabFlow[] = [
  {
    kind: 'flow',
    id: 'f3c9_leaseintakesharepoint',
    name: 'Lease intake → SharePoint',
    enabled: true,
    modified_on: '2026-10-17T11:40:02Z',
  },
  // Disabled: the picker must skip it, so it never appears in the select.
  {
    kind: 'flow',
    id: 'f3c9_archiveprocessedleases',
    name: 'Archive processed leases',
    enabled: false,
    modified_on: '2026-10-15T16:28:39Z',
  },
];

/** `assignment-status/` while the evaluator is still working. */
export const MOCK_AI_LAB_EVALUATING: AiLabAssignmentStatus = {
  assessment_status: 'in_progress',
  ai_assessment_completed: false,
  submission_id: '3d7e9b42-6c1a-4f85-9e2b-7a4c1d8f0e63',
  artefact_kind: 'agent',
  submitted_at: '2026-10-20T10:12:04.318265Z',
  completed_at: null,
  evaluated_at: null,
  score: null,
  percentage: null,
  master_comment: null,
  minor_comment: null,
  grade_card_pdf_url: null,
  grade_card_expires_at: null,
  grade_card_is_expired: false,
  can_resubmit: false,
};

/** `assignment-status/` once graded — the guide's sample, with the comments shortened. */
export const MOCK_AI_LAB_EVALUATED: AiLabAssignmentStatus = {
  ...MOCK_AI_LAB_EVALUATING,
  assessment_status: 'completed',
  ai_assessment_completed: true,
  completed_at: '2026-10-20T10:14:41.902117Z',
  evaluated_at: '2026-10-20T10:14:41.901884Z',
  score: 39.25,
  percentage: 78.5,
  master_comment: 'Solid lease agent with a clear exception summary.',
  minor_comment:
    'Classification flags fire on renewal options but miss termination-for-convenience.',
  grade_card_pdf_url: 'https://example.com/grade-card.pdf',
  grade_card_expires_at: '2026-10-27T10:15:30Z',
};

/* ---------------------------------------------------------------------------
   The lab page's reads, and a stand-in facade for its stories.
   --------------------------------------------------------------------------- */

/** `course/<uuid>/` — the guide's real local capture, objectives trimmed. */
export const MOCK_AI_LAB_DETAIL: AiLabCourseDetail = {
  id: 'f6570df7-0ad9-4463-9a4d-75df10e14d59',
  ai_lab_course_name: 'Lease Audit Agent',
  ai_lab_course_agent_flow_name: 'Lease Audit Agent',
  ai_lab_course_mini_description:
    'Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review.',
  ai_lab_course_horizontal_thumbnail_url:
    'https://milesone-backend-assets.s3.ap-south-1.amazonaws.com/MilesOne/Masterclass/Chapter_Thumbnails/Horizontal/Episode_02_Vtgw3oB.jpg',
  ai_lab_course_vertical_thumbnail_url: null,
  ai_lab_course_square_thumbnail_url: null,
  ai_lab_course_total_duration: '44 minutes',
  ai_lab_course_order: 1,
  ai_lab_course_access_duration_days: 30,
  ai_lab_course_total_duration_seconds: 2640,
  ai_lab_course_description:
    'Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review.',
  ai_lab_course_problem_statement:
    "Build a lease assurance agent that compares lease contracts to schedules and flags exceptions for review. This lab is the hands-on build behind 'Smarter Lease Testing'.",
  ai_lab_course_sharepoint_artefact_url: 'https://example.sharepoint.com/sites/miles-ai-labs',
  ai_lab_course_trailer_url: null,
  ai_lab_course_trailer_thumbnail: null,
  ai_lab_course_exam_rules:
    'Complete the lab video, clear the AI assessment and submit the feedback form.\nThe assessment is scored by the Miles AI Labs service; a pass is required before credit is issued.',
  ai_lab_course_prerequisite_education: 'None.',
  ai_lab_course_advance_preparation: 'None.',
  ai_lab_course_hints: [],
  ai_lab_course_created_at: '2026-10-12T11:04:12.732249Z',
  levels: [],
  tracks: ['Applied AI Across Functions'],
  fields_of_study: [
    { id: '0c199ae8-74c7-4f03-ba25-6474685901e2', name: 'Information Technology', cpe_credit: 3 },
  ],
  total_cpe_credits: 3,
  instructors: [
    {
      id: 'bd07c788-8f7d-4baa-a258-52d8b35f7a2b',
      name: 'Uttam Pai',
      designation: null,
      bio: null,
      profile_image: null,
      horizontal_image_url: null,
      vertical_image_url: null,
      square_image_url: null,
      video_url: null,
      social_links: [],
      linkedin_url: null,
    },
  ],
  skills: [],
  tools: ['Copilot'],
  learning_objectives: [
    'Identify appropriate uses of generative AI in audit, focusing on validation, documentation, and regulatory compliance.',
    'Distinguish the core controls, decision points, and review boundaries in an AI-enabled lease assurance workflow.',
  ],
  masterclass_courses: [],
  ai_kit: null,
  // Not started: the link arrives on the detail re-read after `course-start/`.
  chapter: {
    id: '7944dd60-185b-42bd-be66-233019a8b61b',
    name: 'Building the Lease Assurance Agent',
    mini_description: null,
    description: null,
    hls_video_link: null,
    duration_seconds: 2640,
    transcript_url: null,
    transcript_text: null,
    order: 1,
  },
  lock_state: {
    locked: false,
    lock_reason: null,
    lock_remark: null,
    masterclass_course_id: '7158ee5b-5cff-442c-b217-9703379e2cf8',
    credit_source: null,
  },
};

/** A real UAT HLS rendition, so the player stories actually play. */
const MOCK_HLS =
  'https://d1n6nz3tw8nobo.cloudfront.net/videos/Uttam_Pai_Copilot_Studio_AI_Agents_for_Audits_Topic_Content/Uttam_Pai_Copilot_Studio_AI_Agents_for_Audits_Topic_Content.m3u8';

/** Before the start: a trailer, and no lab video link yet. */
export const MOCK_AI_LAB_DETAIL_WITH_TRAILER: AiLabCourseDetail = {
  ...MOCK_AI_LAB_DETAIL,
  ai_lab_course_trailer_url: MOCK_HLS,
};

/** The detail re-read after `course-start/`: the lab video link is filled in. */
export const MOCK_AI_LAB_DETAIL_WITH_VIDEO: AiLabCourseDetail = {
  ...MOCK_AI_LAB_DETAIL_WITH_TRAILER,
  chapter: { ...MOCK_AI_LAB_DETAIL.chapter!, hls_video_link: MOCK_HLS },
};

const lockFree = MOCK_AI_LAB_DETAIL.lock_state;

/** `course-started/` before a start. */
export const MOCK_AI_LAB_NOT_STARTED: AiLabCourseStarted = {
  ai_lab_course_id: MOCK_AI_LAB_DETAIL.id,
  started: false,
  can_start: true,
  enrollment: null,
  lock_state: lockFree,
};

/** `course-started/` once enrolled. */
export const MOCK_AI_LAB_STARTED: AiLabCourseStarted = {
  ...MOCK_AI_LAB_NOT_STARTED,
  started: true,
  can_start: false,
  enrollment: {
    id: 'b248d5ff-1911-48a4-921d-0ecaaa166596',
    ai_lab_enrollment_started_at: '2026-10-16T15:08:56.484018Z',
    ai_lab_enrollment_expires_at: '2026-11-15T15:08:56.484018Z',
    ai_lab_enrollment_active: true,
    ai_lab_enrollment_is_course_closed: false,
    released_from_ai_lab: false,
  },
};

/** `course-progress/` at a given step. The flags follow from it, as the backend's would. */
export function mockAiLabProgress(step: AiLabCourseProgress['next_step']): AiLabCourseProgress {
  const order = ['video', 'quiz', 'final_assessment', 'ai_assessment', 'feedback', 'done'];
  const past = (s: string) => order.indexOf(step) > order.indexOf(s);
  return {
    ai_lab_course_id: MOCK_AI_LAB_DETAIL.id,
    video_watched_seconds: past('video') ? 2640 : 1320,
    video_completed: past('video'),
    quiz_required: true,
    quiz_passed: past('quiz'),
    quiz_questions_to_show: 2,
    assessment_required: true,
    final_assessment_passed: past('final_assessment'),
    ai_assessment_completed: past('ai_assessment'),
    feedback_submitted: past('feedback'),
    cpe_awarded: step === 'done',
    is_course_closed: step === 'done',
    next_step: step,
    nasba: { eligible: step === 'done', delivery_method: 'QAS Self Study', outstanding: [] },
    lab_certificate_url: step === 'done' ? MOCK_AI_LAB_CERTIFICATE_URL : null,
  };
}

/** The issued certificate PDF on a closed lab's `course-progress/` (the guide's sample). */
export const MOCK_AI_LAB_CERTIFICATE_URL = `https://certificates.milesone.example/ai-labs/${MOCK_AI_LAB_DETAIL.id}/certificate.pdf`;

/** What a story sets on the stand-in facade. Anything left out takes the idle default. */
export interface AiLabCourseStoryState {
  lab?: AiLabCourseDetail | null;
  started?: AiLabCourseStarted | null;
  progress?: AiLabCourseProgress | null;
  ctaStage?: AiLabCtaStage | null;
  isLoading?: boolean;
  error?: boolean;
  lockRemark?: string | null;
  labMapped?: boolean;
  brief?: AiLabAssignmentBrief | null;
  briefUnavailable?: string | null;
  agents?: AiLabAgent[];
  flows?: AiLabFlow[];
  assignment?: AiLabAssignmentStatus | null;
  gradeCardBusy?: boolean;
  balance?: AiLabTokenBalance | null;
  /** Shows the quiz panel in the video frame, on this question. */
  quiz?: { questions: AiLabQuizQuestion[]; index: number; grade: AiLabQuizGrade | null };
  attempts?: AiLabAttempts | null;
  /** A running cool-off's end — pair it with `ctaStage: 'COOL_OFF'`. */
  coolOffEndsAt?: string | null;
  briefProblem?: string | null;
  attemptsProblem?: string | null;
  /** Signed in to the lab (Microsoft) as this account — shows the Copilot Studio account line. */
  labSignedInAs?: string;
}

/** The learner's lab account, as `account-ensure/?include=labs_account` names it. */
export const MOCK_AI_LAB_EMAIL = 'learner.4f2a@milesailabs.onmicrosoft.com';
export const MOCK_AI_LAB_ENVIRONMENT_URL =
  'https://copilotstudio.microsoft.com/environments/Default-4f2a';

/** Two lab quiz questions, as `course-quiz-questions/` sends them (HTML text, as in the guide). */
export const MOCK_AI_LAB_QUIZ: AiLabQuizQuestion[] = [
  {
    id: '10450851-df15-4b15-9135-1dc3ae4b0c7a',
    question_text:
      '<p>Which control best reduces the risk of an AI agent posting unapproved journal entries?</p>',
    question_type: 'single',
    is_answered: false,
    options: [
      { id: 'ba24cb7b', text: '<p>Require human approval before entries are posted</p>', order: 1 },
      { id: '9785bd80', text: "<p>Increase the model's temperature setting</p>", order: 2 },
      { id: '4c1d9e2a', text: '<p>Let the agent post below a value threshold</p>', order: 3 },
    ],
  },
  {
    id: '3ab00f3b-262b-47e6-87d4-c9a80cbdaad5',
    question_text: '<p>In Copilot Studio, what does a topic trigger phrase do?</p>',
    question_type: 'single',
    is_answered: false,
    options: [
      { id: 'daa71dbf', text: '<p>Routes a user message to the matching topic</p>', order: 1 },
      { id: '3ba86c08', text: '<p>Encrypts the conversation transcript</p>', order: 2 },
    ],
  },
];

/** The first question, answered wrong: the verdict, the right option and each explanation. */
export const MOCK_AI_LAB_QUIZ_GRADE: AiLabQuizGrade = {
  selected: ['9785bd80'],
  is_correct: false,
  explanation:
    'Posting rights stay with a human approver, so an agent can prepare an entry but not post it.',
  options: {
    ba24cb7b: { is_correct: true, explanation: 'A maker-checker step is a preventive control.' },
    '9785bd80': { is_correct: false, explanation: 'Temperature changes randomness, not posting.' },
    '4c1d9e2a': {
      is_correct: false,
      explanation: 'A threshold still lets entries post unreviewed.',
    },
  },
};

/* ---- The redesign's slots, filled — stories only; no route of ours serves these yet. ---- */

/** `ai_lab_course_hints` as the detail sends it: plain strings in display order. */
export const MOCK_AI_LAB_HINTS: string[] = [
  'Start from the lease schedule, not the contracts: match each schedule row to its contract first, then compare terms.',
  'Treat a missing commencement date as an exception for review, not a zero — the agent should never guess it.',
  'Keep the reviewer in the loop: post a summary of every flagged lease to the review channel before closing.',
];

const MOCK_FILE_URL = 'https://example.com/ai-labs/grade-cards/attempt.pdf';

/** Three graded attempts, best first, scored out of 10; five submitted against an allowance of 3. */
export const MOCK_AI_LAB_ATTEMPTS: AiLabAttempts = {
  is_provisioned: true,
  total_attempts: 5,
  allowed_attempt: 3,
  grade_card_urls_expire_at: '2099-01-01T00:00:00Z',
  attempts: [
    {
      attempt_number: 2,
      status: 'graded',
      score: '8.80',
      max_score: '10.00',
      percentage: '88.00',
      submitted_at: '2026-10-20T09:12:00Z',
      graded_at: '2026-10-20T09:16:00Z',
      grade_card_url: MOCK_FILE_URL,
      master_comment: 'Reconciles the schedule cleanly and escalates every unmatched lease.',
      minor_comment: 'Add a confidence threshold before auto-matching low-value items.',
    },
    {
      attempt_number: 3,
      status: 'graded',
      score: '7.60',
      max_score: '10.00',
      percentage: '76.00',
      submitted_at: '2026-10-21T14:02:00Z',
      graded_at: '2026-10-21T14:07:00Z',
      grade_card_url: MOCK_FILE_URL,
      master_comment: 'Solid, but the guardrail on missing dates regressed.',
      minor_comment: null,
    },
    {
      attempt_number: 1,
      status: 'graded',
      score: '5.40',
      max_score: '10.00',
      percentage: '54.00',
      submitted_at: '2026-10-19T11:40:00Z',
      graded_at: '2026-10-19T11:45:00Z',
      grade_card_url: null,
      master_comment: null,
      minor_comment: null,
    },
  ],
};

/**
 * Provides a stand-in `AiLabCourseFacade` and `AiLabCredits` holding fixed state, so a story
 * renders the page without HTTP. Their actions do nothing. Only the members the page reads are
 * present.
 */
export function provideStoryAiLabCourse(state: AiLabCourseStoryState): Provider[] {
  const progress = state.progress ?? null;
  const watched = progress?.video_watched_seconds ?? 0;
  const total =
    state.lab?.chapter?.duration_seconds ?? state.lab?.ai_lab_course_total_duration_seconds ?? 0;
  const stub = {
    lab: signal(state.lab ?? null),
    started: signal(state.started ?? null),
    progress: signal(progress),
    isLoading: signal(state.isLoading ?? false),
    error: signal(state.error ?? false),
    ctaStage: signal(state.ctaStage ?? null),
    ctaLoading: signal(false),
    labVideoUrl: signal(
      state.started?.started ? (state.lab?.chapter?.hls_video_link ?? null) : null,
    ),
    completed: signal(!!progress?.video_completed),
    progressPercent: signal(total ? Math.min(100, Math.round((watched / total) * 100)) : 0),
    quizDone: signal(!!progress && (!progress.quiz_required || progress.quiz_passed)),
    examPassed: signal(!!progress?.final_assessment_passed),
    lockRemark: signal(state.lockRemark ?? null),
    labMapped: signal(state.labMapped ?? true),
    brief: signal(state.brief ?? null),
    briefLoading: signal(false),
    briefUnavailable: signal(state.briefUnavailable ?? null),
    agents: signal(state.agents ?? []),
    flows: signal(state.flows ?? []),
    artefactsLoading: signal(false),
    artefactsError: signal(false),
    artefactsErrorMessage: signal('We hit a snag reaching your Copilot environment.'),
    assignment: signal(state.assignment ?? null),
    statusLoading: signal(false),
    submitting: signal(false),
    gradeCardBusy: signal(state.gradeCardBusy ?? false),
    labProvisioned: signal(true),
    hints: signal((state.lab?.ai_lab_course_hints ?? []).map((hint, i) => ({ id: i + 1, hint }))),
    requirements: signal(state.brief?.requirements ?? []),
    buildGuides: signal(state.brief?.build_guides ?? []),
    exerciseFiles: signal(state.brief?.exercise_files ?? []),
    workspaceLinks: signal(state.brief?.sharepoint_links ?? []),
    flowChart: signal(state.brief?.flow_chart ?? null),
    sampleGradeCard: signal(state.brief?.sample_grade_card ?? null),
    briefProblem: signal(state.briefProblem ?? null),
    attempts: signal(state.attempts ?? null),
    attemptsProblem: signal(state.attemptsProblem ?? null),
    coolOffEndsAt: signal(state.coolOffEndsAt ?? null),
    open: () => undefined,
    retry: () => undefined,
    start: () => undefined,
    reportVideoProgress: () => undefined,
    submitPractical: () => undefined,
    refreshArtefacts: () => undefined,
    refreshStatus: () => undefined,
    downloadGradeCard: () => undefined,
    openFile: () => undefined,
    previewFile: () => undefined,
    openCertificate: () => Promise.resolve(),
    certificateUrl: signal(progress?.lab_certificate_url ?? null),
    openAttemptGradeCard: () => undefined,
    retryBrief: () => undefined,
    retryAttempts: () => undefined,
    sendTestEmails: () => undefined,
  };
  const account = {
    labEmail: signal(MOCK_AI_LAB_EMAIL),
    environmentUrl: signal(MOCK_AI_LAB_ENVIRONMENT_URL),
    isLoading: signal(false),
    signIn: () => Promise.resolve(),
    launch: () => undefined,
    copyLabLink: () => Promise.resolve(),
  };
  const credits = {
    balance: signal(state.balance ?? null),
    submitting: signal(false),
    requestTopUp: () => undefined,
  };
  const q = state.quiz;
  const quiz = {
    isOpen: signal(!!q),
    isLoading: signal(false),
    questions: signal(q?.questions ?? []),
    question: signal(q?.questions[q.index] ?? null),
    grade: signal(q?.grade ?? null),
    index: signal(q?.index ?? 0),
    isLast: signal(!!q && q.index >= q.questions.length - 1),
    progressLabel: signal(q ? `Question ${q.index + 1} of ${q.questions.length}` : ''),
    submitting: signal(false),
    completed: signal(false),
    countdown: signal(null),
    open: () => undefined,
    close: () => undefined,
    answer: () => Promise.resolve(),
    next: () => undefined,
    previous: () => undefined,
    proceed: () => undefined,
  };
  return [
    { provide: AiLabCourseFacade, useValue: stub },
    { provide: AiLabQuizFacade, useValue: quiz },
    { provide: AiLabCredits, useValue: credits },
    { provide: AiLabAccount, useValue: account },
    ...(state.labSignedInAs
      ? [
          {
            provide: AiLabAuth,
            useValue: {
              isSignedIn: signal(true),
              identity: signal(state.labSignedInAs),
              restoring: signal(false),
              signingIn: signal(false),
              error: signal(null),
              hint: signal(null),
              restoreSession: () => Promise.resolve(),
            },
          },
        ]
      : []),
  ];
}

/* ---------------------------------------------------------------------------
   The lab's final assessment, and a stand-in facade for its page's stories.
   --------------------------------------------------------------------------- */

/** `course-assessment-questions/` — the guide's sample, options completed. */
export const MOCK_AI_LAB_EXAM_PAPER: AiLabExamPaper = {
  ai_lab_course_id: MOCK_AI_LAB_DETAIL.id,
  questions_to_show: 2,
  pass_threshold_percent: 70,
  exam_rules: '<p>Answer all 2 questions. You need 70% to pass.</p>',
  previous_attempts: 0,
  questions: [
    {
      id: 'b4fcae42',
      question_text:
        '<p>An AI agent reconciles bank statements. Which evidence best supports reliance on its output during an audit?</p>',
      question_type: 'single',
      options: [
        {
          id: '756fcf51',
          text: "<p>Documented testing of the agent's matching logic</p>",
          order: 1,
        },
        { id: 'a01d062e', text: "<p>The vendor's marketing brochure</p>", order: 2 },
        { id: 'c3e9a1f7', text: "<p>The agent's own confidence score</p>", order: 3 },
      ],
    },
    {
      id: 'c0f57881',
      question_text:
        '<p>Which TWO practices reduce hallucination risk when an agent drafts variance commentary?</p>',
      question_type: 'multi',
      options: [
        {
          id: '82b00e71',
          text: '<p>Ground the agent on the trial balance and budget files</p>',
          order: 1,
        },
        {
          id: '584d6a2c',
          text: '<p>Require the agent to cite the source line for each figure</p>',
          order: 2,
        },
        { id: '9a7b3c5d', text: '<p>Raise the model temperature</p>', order: 3 },
      ],
    },
  ],
};

/** A failed attempt: the first answer wrong, the second right. */
export const MOCK_AI_LAB_EXAM_RESULT: AiLabExamResult = {
  passed: false,
  score_percent: 50,
  pass_threshold_percent: 70,
  next_step: 'final_assessment',
  answers: [
    {
      question_id: 'b4fcae42',
      is_correct: false,
      explanation:
        "Testing the agent's matching logic against known exceptions is direct evidence that its output can be relied on.",
      correct_option_ids: ['756fcf51'],
      options_feedback: [],
    },
    {
      question_id: 'c0f57881',
      is_correct: true,
      explanation:
        'Grounding the agent in source data and requiring citations both reduce unsupported statements.',
      correct_option_ids: ['82b00e71', '584d6a2c'],
      options_feedback: [],
    },
  ],
};

/** What the exam page's stories set on the stand-in facade. */
export interface AiLabExamStoryState {
  paper?: AiLabExamPaper | null;
  result?: AiLabExamResult | null;
  sent?: Record<string, string[]>;
  loadError?: string | null;
}

/** Provides a stand-in `AiLabAssessmentFacade` holding fixed state. Its actions do nothing. */
export function provideStoryAiLabExam(state: AiLabExamStoryState): Provider {
  const stub = {
    paper: signal(state.paper ?? null),
    isLoading: signal(false),
    loadError: signal(state.loadError ?? null),
    result: signal(state.result ?? null),
    sent: signal(state.sent ?? {}),
    open: () => undefined,
    retake: () => undefined,
    submit: () => Promise.resolve(null),
  };
  return { provide: AiLabAssessmentFacade, useValue: stub };
}

/* ---------------------------------------------------------------------------
   The lab's feedback, and a stand-in facade for its page's stories.
   --------------------------------------------------------------------------- */

/** `course-feedback-questions/` — four NASBA ratings and one text question. */
export const MOCK_AI_LAB_FEEDBACK_QUESTIONS: AiLabFeedbackQuestion[] = [
  'Were the stated learning objectives met?',
  'Was the lab content relevant and up to date?',
  'Were the materials and the brief clear?',
  'Was the time allotted to the lab appropriate?',
]
  .map((text, i) => ({
    id: `rating-${i + 1}`,
    feedback_question: text,
    feedback_question_type: 'rating',
    feedback_question_order: i + 1,
  }))
  .concat({
    id: 'text-1',
    feedback_question: 'What one change would make this lab more useful in your accounting work?',
    feedback_question_type: 'text',
    feedback_question_order: 5,
  });

/** What the feedback page's stories set on the stand-in facade. */
export interface AiLabFeedbackStoryState {
  questions?: AiLabFeedbackQuestion[];
  notYet?: string | null;
  alreadySubmitted?: boolean;
  done?: { result: AiLabFeedbackResult | null; notice: string | null } | null;
}

/** Provides a stand-in `AiLabFeedbackFacade` holding fixed state. Its actions do nothing. */
export function provideStoryAiLabFeedback(state: AiLabFeedbackStoryState): Provider {
  const stub = {
    lab: signal(MOCK_AI_LAB_DETAIL),
    learnerName: signal('Priya Sharma'),
    questions: signal(state.questions ?? []),
    alreadySubmitted: signal(state.alreadySubmitted ?? false),
    notYet: signal(state.notYet ?? null),
    isLoading: signal(false),
    loadError: signal(null),
    submitting: signal(false),
    done: signal(state.done ?? null),
    open: () => undefined,
    reload: () => undefined,
    submit: () => Promise.resolve(),
  };
  return { provide: AiLabFeedbackFacade, useValue: stub };
}
