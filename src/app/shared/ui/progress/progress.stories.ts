import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { Progress } from './progress';

const meta: Meta<Progress> = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: { value: { control: { type: 'range', min: 0, max: 100 } }, label: { control: 'text' } },
  args: { value: 40, label: 'Chapter 5 of 12' },
  render: (args) => ({
    props: args,
    template: `<div class="w-80"><app-progress ${argsToTemplate(args)} /></div>`,
  }),
};

export default meta;
type Story = StoryObj<Progress>;

export const Default: Story = {};

export const Complete: Story = { args: { value: 100, label: 'Course complete' } };

export const Indeterminate: Story = {
  args: { value: null, label: undefined, ariaLabel: 'Loading', size: 'sm' },
  render: (args) => ({
    props: args,
    template: `<div class="w-80"><app-progress ${argsToTemplate(args)} /></div>`,
  }),
};
