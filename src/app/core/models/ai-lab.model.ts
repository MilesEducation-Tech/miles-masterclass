/**
 * The two AI-Lab types that cross a top-level boundary.
 *
 * They live in `core/` rather than with the rest of `ai-labs.model.ts` because
 * BOTH `core/services/ai-lab-submission` and `shared/dialogs/ai-lab-agent-dialog`
 * need them. Leaving them in `features/ai-labs/models/` would force a
 * `shared -> features` import, which the structure rules ban outright; the rest of
 * that file is page copy and stays with the feature.
 */

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
