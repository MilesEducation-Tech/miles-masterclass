import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { AiLabTokenMeter } from './ai-lab-token-meter';
import { MOCK_AI_LAB_BALANCE, MOCK_AI_LAB_PENDING_REQUEST } from '@testing/mocks/ai-labs.mock';

/**
 * The floating Copilot Credits pill. It positions itself `fixed` at the bottom-start corner, so
 * every story shows it there rather than inline — that is the component, not a layout accident.
 */
const meta: Meta<AiLabTokenMeter> = {
  title: 'AI Labs/Token meter',
  component: AiLabTokenMeter,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="min-height: 220px;"><app-ai-lab-token-meter ${argsToTemplate(args)}></app-ai-lab-token-meter></div>`,
  }),
};

export default meta;
type Story = StoryObj<AiLabTokenMeter>;

export const Default: Story = {
  args: { balance: MOCK_AI_LAB_BALANCE },
};

/** Past 75% of the cap the bar warns. */
export const Warning: Story = {
  args: { balance: { ...MOCK_AI_LAB_BALANCE, used: '2000.00', remaining: '500.00' } },
};

/** Past 90% it alarms. */
export const Critical: Story = {
  args: { balance: { ...MOCK_AI_LAB_BALANCE, used: '2400.50', remaining: '99.50' } },
};

/** AI Labs paused the account: the pill reads "Paused" instead of a remaining figure. */
export const Locked: Story = {
  args: {
    balance: { ...MOCK_AI_LAB_BALANCE, used: '2500.00', remaining: '0.00', locked: true },
  },
};

/** While a request is open the Top up control is replaced, not disabled — one at a time. */
export const PendingRequest: Story = {
  args: { balance: { ...MOCK_AI_LAB_BALANCE, pending_request: MOCK_AI_LAB_PENDING_REQUEST } },
};

export const Submitting: Story = {
  args: { balance: MOCK_AI_LAB_BALANCE, submitting: true },
};

/** No allotment renders nothing at all, rather than a row of zeros. */
export const NoBalance: Story = {
  args: { balance: null },
};
