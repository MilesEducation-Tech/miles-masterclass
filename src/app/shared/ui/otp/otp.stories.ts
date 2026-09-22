import type { Meta, StoryObj } from '@storybook/angular';
import { Otp } from './otp';

const meta: Meta<Otp> = {
  title: 'UI/OTP',
  component: Otp,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    id: { control: 'text', description: 'Unique component identifier' },
    length: { control: { type: 'number', min: 4, max: 8 }, description: 'Number of OTP digits' },
    type: {
      control: 'select',
      options: ['number', 'text', 'alphanumeric'],
      description: 'Allowed input type',
    },
    label: { control: 'text', description: 'Label text above the input' },
    hint: { control: 'text', description: 'Hint text below the input' },
    description: { control: 'text', description: 'Description text' },
    required: { control: 'boolean', description: 'Whether the field is required' },
    disabled: { control: 'boolean', description: 'Whether the input is disabled' },
    readonly: { control: 'boolean', description: 'Whether the input is readonly' },
  },
};

export default meta;
type Story = StoryObj<Otp>;

export const Default: Story = {
  args: {
    id: 'otp-default',
    length: 6,
    type: 'number',
    label: 'Enter OTP',
  },
};

export const FourDigit: Story = {
  args: {
    id: 'otp-four',
    length: 4,
    type: 'number',
    label: 'Verification Code',
    hint: 'Enter the 4-digit code sent to your phone',
  },
};

export const Alphanumeric: Story = {
  args: {
    id: 'otp-alpha',
    length: 6,
    type: 'alphanumeric',
    label: 'Alphanumeric Code',
    hint: 'Letters and numbers accepted',
  },
};

export const WithDescription: Story = {
  args: {
    id: 'otp-desc',
    length: 6,
    type: 'number',
    label: 'OTP Verification',
    description: 'We sent a code to your email address',
    hint: 'Check your spam folder if not received',
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    id: 'otp-disabled',
    length: 6,
    type: 'number',
    label: 'Disabled OTP',
    disabled: true,
  },
};

export const Readonly: Story = {
  args: {
    id: 'otp-readonly',
    length: 6,
    type: 'number',
    label: 'Readonly OTP',
    readonly: true,
  },
};
