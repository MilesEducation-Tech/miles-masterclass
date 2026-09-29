import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { Textarea } from './textarea';

type TextareaArgs = Textarea & { disabled: boolean; placeholder: string };

const meta: Meta<TextareaArgs> = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: { placeholder: 'Tell us more', disabled: false },
  render: (args) => ({
    props: args,
    template: `<div class="w-72"><textarea app-textarea aria-label="Example" ${argsToTemplate(args)}></textarea></div>`,
  }),
};

export default meta;
type Story = StoryObj<TextareaArgs>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };
