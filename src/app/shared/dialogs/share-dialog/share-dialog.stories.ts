import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ShareDialog } from './share-dialog';
import { MockDialogRef } from '@testing/mocks/dialog.mock';
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
    (story) => ({
      template: `<div style="width: 450px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<ShareDialog>;

export const Default: Story = {
  render: () => ({
    props: {
      init(component: ShareDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          url: 'https://miles.education/masterclass/advanced-cpa-strategies',
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-share-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const LongUrl: Story = {
  render: () => ({
    props: {
      init(component: ShareDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          url: 'https://miles.education/masterclass/advanced-cpa-exam-strategies-for-financial-reporting?ref=share&utm_source=platform',
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-share-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};
