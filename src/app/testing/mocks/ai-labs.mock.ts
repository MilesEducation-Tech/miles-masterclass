import {
  AiLabAgent,
  AiLabAssignmentBrief,
  AiLabAssignmentStatus,
  AiLabFlow,
  AiLabPracticalProgress,
  AiLabTokenBalance,
  AiLabTokenRequest,
} from '@features/ai-labs/models/ai-labs.model';

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
  problem_statement:
    'Build an agent that reads a lease contract, extracts the payment schedule, and flags any ' +
    'clause that would change the ASC 842 classification.\n\n' +
    'It should hand back a short summary a reviewer can act on — not a transcript of the ' +
    'contract, and not a pass/fail verdict.',
  requirements: [
    'Accept a PDF or Word lease as the input.',
    'Extract commencement date, term, and the full payment schedule.',
    'Flag any renewal or termination option that affects classification.',
    'Return a reviewer-ready summary of no more than ten lines.',
    'Log every clause it could not parse, rather than dropping it silently.',
  ],
  tools: { test_emails: true },
};

export const MOCK_AI_LAB_AGENTS: AiLabAgent[] = [
  {
    id: 'agent-lease-01',
    name: 'Lease Review Assistant',
    schemaName: 'crxxx_leaseReviewAssistant',
    published: true,
    envId: 'env-miles-shared',
    envLabel: 'the shared Miles AI Labs environment',
  },
  {
    id: 'agent-lease-02',
    name: 'Lease Review Assistant (v2)',
    schemaName: 'crxxx_leaseReviewAssistantV2',
    published: false,
    envId: 'env-miles-shared',
    envLabel: 'the shared Miles AI Labs environment',
  },
];

export const MOCK_AI_LAB_FLOWS: AiLabFlow[] = [
  {
    id: 'flow-intake-01',
    name: 'Lease intake → SharePoint',
    enabled: true,
    envId: 'env-miles-shared',
    environment: 'the shared Miles AI Labs environment',
    shared: true,
  },
  // Disabled: the picker must skip it, so it never appears in the select.
  {
    id: 'flow-archive-02',
    name: 'Archive processed leases',
    enabled: false,
    envId: 'env-miles-shared',
    environment: 'the shared Miles AI Labs environment',
    shared: false,
  },
];

export const MOCK_AI_LAB_EVALUATED: AiLabAssignmentStatus = {
  lab_status: 'completed',
  submission_id: 'sub-9f21c8',
  score: 7,
  percentage: 70,
  master_comment:
    'The agent extracts the schedule reliably and the summary is the right length. Classification ' +
    'flags fire on renewal options but miss termination-for-convenience.',
  minor_comment: 'Unparsed clauses are logged but not surfaced to the reviewer.',
  grade_card_pdf_url: null,
  evaluated_at: '2026-10-11T16:20:00.000000+00:00',
};
