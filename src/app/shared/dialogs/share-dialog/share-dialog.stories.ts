import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ShareDialog } from './share-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';
import { MockLogger } from '@testing/mocks/services.mock';
import { Logger } from '@core/services/logger/logger';

const meta: Meta<ShareDialog> = {
  title: 'Dialog/Share',
  component: ShareDialog,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      providers: [{ provide: Logger, useClass: MockLogger }],
    }),
    // Spread, so a story's own `moduleMetadata` (its dialog-ref provider) survives the wrapper.
    (story) => {
      const result = story();
      return { ...result, template: `<div style="width: 450px;">${result.template ?? ''}</div>` };
    },
  ],
};

export default meta;
type Story = StoryObj<ShareDialog>;

export const Default: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          url: 'https://miles.education/masterclass/advanced-cpa-strategies',
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-share-dialog /></div>` }),
};

export const LongUrl: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          url: 'https://miles.education/masterclass/advanced-cpa-exam-strategies-for-financial-reporting?ref=share&utm_source=platform',
        }),
      ],
    }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-share-dialog /></div>` }),
};
