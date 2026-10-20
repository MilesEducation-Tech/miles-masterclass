import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { AiLabTokenRequestDialog } from './ai-lab-token-request-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';
import { MOCK_AI_LAB_BALANCE } from '@testing/mocks/ai-labs.mock';

/**
 * The Copilot Credits top-up. Pick an add-on to enable Send; a reason past 500 characters turns
 * the counter red and disables it again.
 */
const meta: Meta<AiLabTokenRequestDialog> = {
  title: 'AI Labs/Token request dialog',
  component: AiLabTokenRequestDialog,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<AiLabTokenRequestDialog>;

export const Default: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          remaining: MOCK_AI_LAB_BALANCE.remaining,
          cap: MOCK_AI_LAB_BALANCE.cap,
        }),
      ],
    }),
  ],
  render: () => ({ template: `<app-ai-lab-token-request-dialog />` }),
};
