import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { SelectCpeMode } from './select-cpe-mode';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';

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
  decorators: [moduleMetadata({ providers: [provideStoryDialogRef({ type: 'Masterclass' })] })],
  render: () => ({ template: `<div style="width: 450px;"><app-select-cpe-mode /></div>` }),
};

export const Podcast: Story = {
  decorators: [
    moduleMetadata({ providers: [provideStoryDialogRef({ type: 'Podcast', format: 'audio' })] }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-select-cpe-mode /></div>` }),
};

export const MicroLearning: Story = {
  decorators: [moduleMetadata({ providers: [provideStoryDialogRef({ type: 'Micro Learning' })] })],
  render: () => ({ template: `<div style="width: 450px;"><app-select-cpe-mode /></div>` }),
};

export const FreeContent: Story = {
  decorators: [
    moduleMetadata({ providers: [provideStoryDialogRef({ type: 'Masterclass', isFree: true })] }),
  ],
  render: () => ({ template: `<div style="width: 450px;"><app-select-cpe-mode /></div>` }),
};
