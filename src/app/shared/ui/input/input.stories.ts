import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { Input } from './input';

type InputArgs = Input & { disabled: boolean; placeholder: string; type: string };

const meta: Meta<InputArgs> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password', 'number', 'search', 'date'] },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: { type: 'text', placeholder: 'Type here', disabled: false },
  render: (args) => ({
    props: args,
    template: `<div class="w-72"><input app-input aria-label="Example" ${argsToTemplate(args)} /></div>`,
  }),
};

export default meta;
type Story = StoryObj<InputArgs>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
