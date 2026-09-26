import type { Meta, StoryObj } from '@storybook/angular';
import { AriaInput } from './aria-input';

const meta: Meta<AriaInput> = {
  title: 'UI/Aria/Input',
  component: AriaInput,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    id: { control: 'text', description: 'Unique field identifier' },
    type: {
      control: 'select',
      options: ['text', 'number', 'textarea', 'checkbox', 'radio'],
      description: 'Input type',
    },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    required: { control: 'boolean' },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<AriaInput>;

export const Text: Story = {
  args: {
    id: 'name',
    type: 'text',
    label: 'Full Name',
    placeholder: 'Enter your full name',
  },
};

export const Number: Story = {
  args: {
    id: 'age',
    type: 'number',
    label: 'Age',
    min: 0,
    max: 120,
  },
};

export const Textarea: Story = {
  args: {
    id: 'bio',
    type: 'textarea',
    label: 'Bio',
    placeholder: 'Tell us about yourself…',
    rows: 4,
  },
};

export const Checkbox: Story = {
  args: {
    id: 'terms',
    type: 'checkbox',
    label: 'I agree to the terms and conditions',
  },
};

export const Radio: Story = {
  args: {
    id: 'plan',
    type: 'radio',
    label: 'Pick a plan',
    options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
      { value: 'team', label: 'Team' },
    ],
  },
};

export const CheckboxChecked: Story = {
  args: {
    id: 'terms-checked',
    type: 'checkbox',
    label: 'I agree to the terms and conditions',
    value: true,
  },
};

/** Arrow keys move and select within the group; the disabled option is skipped. */
export const RadioSelected: Story = {
  args: {
    id: 'plan-selected',
    type: 'radio',
    label: 'Pick a plan',
    value: 'pro',
    options: [
      { value: 'free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
      { value: 'team', label: 'Team', disabled: true },
    ],
  },
};

export const WithError: Story = {
  args: {
    id: 'email',
    type: 'text',
    label: 'Email Address',
    placeholder: 'you@example.com',
    invalid: true,
    touched: true,
    errors: [{ message: 'Please enter a valid email address' }],
  },
};

export const Disabled: Story = {
  args: {
    id: 'disabled',
    type: 'text',
    label: 'Disabled Field',
    placeholder: 'Cannot edit this',
    disabled: true,
  },
};
