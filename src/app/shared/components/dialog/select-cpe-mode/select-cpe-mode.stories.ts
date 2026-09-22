import type { Meta, StoryObj } from '@storybook/angular';
import { SelectCpeMode } from './select-cpe-mode';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';

const meta: Meta<SelectCpeMode> = {
  title: 'Dialog/SelectCpeMode',
  component: SelectCpeMode,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 450px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<SelectCpeMode>;

export const Masterclass: Story = {
  render: () => ({
    props: {
      init(component: SelectCpeMode) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = { type: 'Masterclass' };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-select-cpe-mode #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const Podcast: Story = {
  render: () => ({
    props: {
      init(component: SelectCpeMode) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = { type: 'Podcast', format: 'audio' };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-select-cpe-mode #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const MicroLearning: Story = {
  render: () => ({
    props: {
      init(component: SelectCpeMode) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = { type: 'Micro Learning' };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-select-cpe-mode #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const FreeContent: Story = {
  render: () => ({
    props: {
      init(component: SelectCpeMode) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = { type: 'Masterclass', isFree: true };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-select-cpe-mode #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};
