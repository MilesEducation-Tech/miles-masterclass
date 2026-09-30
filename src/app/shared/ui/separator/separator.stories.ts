import type { Meta, StoryObj } from '@storybook/angular';
import { Separator } from './separator';

const meta: Meta<Separator> = {
  title: 'UI/Separator',
  component: Separator,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<Separator>;

export const Horizontal: Story = {
  render: () => ({
    template: `
      <div class="w-72 text-sm">
        <p>Above the line</p>
        <div app-separator class="my-3"></div>
        <p>Below the line</p>
      </div>
    `,
  }),
};

export const Vertical: Story = {
  render: () => ({
    template: `
      <div class="flex h-8 items-center gap-3 text-sm">
        <span>Left</span>
        <div app-separator orientation="vertical"></div>
        <span>Right</span>
      </div>
    `,
  }),
};
