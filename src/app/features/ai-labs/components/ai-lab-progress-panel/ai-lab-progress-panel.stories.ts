import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { AiLabProgressPanel } from './ai-lab-progress-panel';
import {
  MOCK_AI_LAB_BALANCE,
  MOCK_AI_LAB_PENDING_REQUEST,
  MOCK_AI_LAB_PROGRESS,
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
  args: { progress: MOCK_AI_LAB_PROGRESS, balance: MOCK_AI_LAB_BALANCE },
};

/** No allotment: the Copilot Credits card is dropped rather than zeroed. */
export const WithoutCredits: Story = {
  args: { progress: MOCK_AI_LAB_PROGRESS, balance: null },
};

export const PendingTopUp: Story = {
  args: {
    progress: MOCK_AI_LAB_PROGRESS,
    balance: { ...MOCK_AI_LAB_BALANCE, pending_request: MOCK_AI_LAB_PENDING_REQUEST },
  },
};

/** AI Labs paused the account: the card says so, whatever the remaining figure reads. */
export const Locked: Story = {
  args: {
    progress: MOCK_AI_LAB_PROGRESS,
    balance: { ...MOCK_AI_LAB_BALANCE, used: '2500.00', remaining: '0.00', locked: true },
  },
};

/**
 * Every figure zero. The tiles and the completion bar drop out, because a dashboard of zeros
 * reads as real data when the honest answer is that there is nothing there yet.
 */
export const NothingReported: Story = {
  args: {
    progress: {
      assignments_available: 0,
      assignments_attempted: 0,
      assignments_completed: 0,
      average_percentage: '0.00',
      assignments: [],
    },
    balance: null,
  },
};

export const Loading: Story = {
  args: { isLoading: true },
};

/** No progress at all — the whole section renders as absence. */
export const Absent: Story = {
  args: { progress: null },
};
