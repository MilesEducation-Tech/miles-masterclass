import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { AiLabProgressPanel } from './ai-lab-progress-panel';
import {
  MOCK_AI_LAB_ASSIGNMENTS,
  MOCK_AI_LAB_BALANCE,
  MOCK_AI_LAB_TOTALS,
} from '@testing/mocks/ai-labs.mock';

/**
 * "Where your labs stand". Not mounted on a page yet — these stories are how the design is
 * reviewed until the progress read is bound.
 *
 * The heading uses `ai-metal-text`, which lives in the AI Labs landing page's own stylesheet, so
 * it renders plain here. That is expected, not a bug in the component.
 */
const meta: Meta<AiLabProgressPanel> = {
  title: 'AI Labs/Progress panel',
  component: AiLabProgressPanel,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<app-ai-lab-progress-panel ${argsToTemplate(args)}></app-ai-lab-progress-panel>`,
  }),
};

export default meta;
type Story = StoryObj<AiLabProgressPanel>;

export const Default: Story = {
  args: {
    totals: MOCK_AI_LAB_TOTALS,
    assignments: MOCK_AI_LAB_ASSIGNMENTS,
    balance: MOCK_AI_LAB_BALANCE,
  },
};

/** No allotment: the Copilot Credits card is dropped rather than zeroed. */
export const WithoutCredits: Story = {
  args: { totals: MOCK_AI_LAB_TOTALS, assignments: MOCK_AI_LAB_ASSIGNMENTS, balance: null },
};

export const PendingTopUp: Story = {
  args: {
    totals: MOCK_AI_LAB_TOTALS,
    assignments: MOCK_AI_LAB_ASSIGNMENTS,
    balance: { ...MOCK_AI_LAB_BALANCE, pendingTokens: 2000 },
  },
};

/**
 * Every figure zero. The tiles and the completion bar drop out, because a dashboard of zeros
 * reads as real data when the honest answer is that there is nothing there yet.
 */
export const NothingReported: Story = {
  args: {
    totals: {
      assignments_available: 0,
      assignments_attempted: 0,
      assignments_completed: 0,
      total_submissions: 0,
      average_percentage: 0,
      last_activity_at: null,
    },
    assignments: [],
    balance: null,
  },
};

export const Loading: Story = {
  args: { isLoading: true },
};

/** No totals at all — the whole section renders as absence. */
export const Absent: Story = {
  args: { totals: null },
};
