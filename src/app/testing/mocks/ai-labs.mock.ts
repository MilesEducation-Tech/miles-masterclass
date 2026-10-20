import {
  AiLabAgent,
  AiLabAssignmentBrief,
  AiLabAssignmentCourse,
  AiLabAssignmentStatus,
  AiLabAssignmentProgress,
  AiLabFlow,
  AiLabProgressTotals,
  AiLabTokenBalance,
} from '@features/ai-labs/models/ai-labs.model';

/**
 * Sample data for the AI Labs progress panel and token meter stories.
 *
 * Story-only: `testing/` is importable from `*.stories.ts` and nowhere else, which is the point —
 * neither component is mounted on a page yet, so this is how the design gets reviewed without
 * showing a learner invented credit balances and scores.
 *
 * The rows are deliberately a spread rather than four happy paths: a graded lab whose best beats
 * its latest, one mid-evaluation, one untouched, and one the backend hasn't mapped to a course yet
 * (which must render without a link).
 */

const S3 = 'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/';

/**
 * The two crops are deliberately different images, as they are on the wire — the row tile is 9:16
 * and must pick the portrait one, and a sample that set both to the same file could never catch
 * that going wrong.
 */
const course = (
  id: number,
  title: string,
  portrait: string,
  landscape: string,
): AiLabAssignmentCourse => ({
  id,
  title,
  thumbnail: portrait,
  horizontal_thumbnail: landscape,
});

export const MOCK_AI_LAB_TOTALS: AiLabProgressTotals = {
  assignments_available: 5,
  assignments_attempted: 3,
  assignments_completed: 1,
  total_submissions: 15,
  average_percentage: 49,
  last_activity_at: '2026-09-16T13:34:02.343822+00:00',
};

export const MOCK_AI_LAB_ASSIGNMENTS: AiLabAssignmentProgress[] = [
  {
    course: course(
      78,
      'Lease Audit Agent',
      `${S3}processed_045cdbcababa4009a8fd343770aef3ac.webp`,
      `${S3}processed_bc84899509a048efa2130d0e8385b5e1.webp`,
    ),
    assignment_id: 'lease-audit-agent-la-01-bcsi',
    title: 'Lease Audit Agent (LA-01)',
    status: 'graded',
    attempts: 15,
    best_percentage: 49,
    latest_percentage: 42,
    last_submitted_at: '2026-09-16T13:34:02.343822+00:00',
  },
  {
    course: course(
      84,
      'Revenue Recognition Agent',
      `${S3}processed_0b68423183ee4f93944e29a940c8bab4.webp`,
      `${S3}processed_946d21ebdf8c4f408403f5653369e9fe.webp`,
    ),
    assignment_id: 'revenue-recognition-agent-la-02-mzmn',
    title: 'Revenue Recognition Agent (LA-02)',
    status: 'in_progress',
    attempts: 2,
    best_percentage: 61,
    latest_percentage: 61,
    last_submitted_at: '2026-09-19T09:12:40.000000+00:00',
  },
  {
    course: course(
      78,
      'Fixed Asset Rollforward Agent',
      `${S3}processed_045cdbcababa4009a8fd343770aef3ac.webp`,
      `${S3}processed_bc84899509a048efa2130d0e8385b5e1.webp`,
    ),
    assignment_id: 'fixed-asset-rollforward-la-03-qptr',
    title: 'Fixed Asset Rollforward Agent (LA-03)',
    status: 'not_started',
    attempts: 0,
    best_percentage: null,
    latest_percentage: null,
    last_submitted_at: null,
  },
  // Not mapped to a course — must render without a CTA and without a thumbnail.
  {
    course: null,
    assignment_id: 'pbc-chaser-agent-la-04-wknd',
    title: 'PBC Chaser Agent (LA-04)',
    status: 'not_started',
    attempts: 0,
    best_percentage: null,
    latest_percentage: null,
    last_submitted_at: null,
  },
  // A status this build has never been told about: it must humanise rather than vanish.
  {
    course: null,
    assignment_id: 'variance-explainer-la-05-ytqa',
    title: 'Variance Explainer Agent (LA-05)',
    status: 'needs_review',
    attempts: 1,
    best_percentage: 73,
    latest_percentage: 73,
    last_submitted_at: '2026-10-02T08:00:00.000000+00:00',
  },
];

export const MOCK_AI_LAB_BALANCE: AiLabTokenBalance = {
  allotted: 5000,
  used: 1850,
  remaining: 3150,
  pendingTokens: null,
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
