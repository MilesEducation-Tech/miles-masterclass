import type { Meta, StoryObj } from '@storybook/angular';
import { FormField } from './form-field';

const meta: Meta<FormField> = {
  title: 'UI/FormField',
  component: FormField,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    id: {
      control: 'text',
      description: 'Unique field identifier',
    },
    type: {
      control: 'select',
      options: [
        'text',
        'email',
        'password',
        'number',
        'tel',
        'url',
        'search',
        'date',
        'time',
        'datetime-local',
        'textarea',
        'select',
        'multi-select',
        'checkbox',
        'radio',
      ],
      description: 'Input field type',
    },
    label: {
      control: 'text',
      description: 'Floating label text',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    hint: {
      control: 'text',
      description: 'Help text shown below the field',
    },
    required: {
      control: 'boolean',
      description: 'Whether the field is required',
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
      description: 'Field height size',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the field is disabled',
    },
    invalid: {
      control: 'boolean',
      description: 'Whether to show error styling',
    },
  },
};

export default meta;
type Story = StoryObj<FormField>;

export const Text: Story = {
  args: {
    id: 'name',
    type: 'text',
    label: 'Full Name',
    placeholder: 'Enter your full name',
    required: false,
    size: 'default',
    disabled: false,
  },
};

export const Email: Story = {
  args: {
    id: 'email',
    type: 'email',
    label: 'Email Address',
    placeholder: 'you@example.com',
    required: true,
  },
};

export const Password: Story = {
  args: {
    id: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'Enter your password',
    required: true,
    showPasswordToggle: true,
  },
};

export const Number: Story = {
  args: {
    id: 'age',
    type: 'number',
    label: 'Age',
    placeholder: 'Enter your age',
    min: 0,
    max: 120,
  },
};

export const Textarea: Story = {
  args: {
    id: 'bio',
    type: 'textarea',
    label: 'Bio',
    placeholder: 'Tell us about yourself...',
    rows: 4,
  },
};

export const Select: Story = {
  args: {
    id: 'course',
    type: 'select',
    label: 'Select Course',
    options: [
      { label: 'CPA', value: 'cpa' },
      { label: 'CMA', value: 'cma' },
      { label: 'EA', value: 'ea' },
      { label: 'CIA', value: 'cia' },
    ],
  },
};

export const MultiSelect: Story = {
  args: {
    id: 'topics',
    type: 'multi-select',
    label: 'Topics of interest',
    options: [
      { label: 'Accounting', value: 'accounting' },
      { label: 'Audit', value: 'audit' },
      { label: 'Tax', value: 'tax' },
      { label: 'Finance', value: 'finance' },
    ],
  },
};

export const Checkbox: Story = {
  args: {
    id: 'terms',
    type: 'checkbox',
    label: 'I agree to the terms and conditions',
  },
};

export const Disabled: Story = {
  args: {
    id: 'disabled-field',
    type: 'text',
    label: 'Disabled Field',
    placeholder: 'Cannot edit this',
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    id: 'error-field',
    type: 'email',
    label: 'Email Address',
    placeholder: 'you@example.com',
    invalid: true,
    errors: ['Please enter a valid email address'],
  },
};

export const SmallSize: Story = {
  args: {
    id: 'small',
    type: 'text',
    label: 'Small Field',
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    id: 'large',
    type: 'text',
    label: 'Large Field',
    size: 'lg',
  },
};

export const Phone: Story = {
  args: {
    id: 'phone',
    type: 'tel',
    label: 'Phone Number',
    placeholder: '+91 XXXXX XXXXX',
  },
};

export const Date: Story = {
  args: {
    id: 'dob',
    type: 'date',
    label: 'Date of Birth',
  },
};

export const FormFieldShowcase: Story = {
  render: () => ({
    template: `
      <div class="flex flex-col gap-6 w-96">
        <app-form-field id="name" type="text" label="Full Name" placeholder="John Doe" />
        <app-form-field id="email" type="email" label="Email" placeholder="john@example.com" [required]="true" />
        <app-form-field id="pass" type="password" label="Password" placeholder="Enter password" />
        <app-form-field id="phone" type="tel" label="Phone" placeholder="+91 XXXXX XXXXX" />
        <app-form-field id="bio" type="textarea" label="Bio" placeholder="Tell us about yourself..." />
        <app-form-field id="terms" type="checkbox" label="I agree to the terms" />
      </div>
    `,
  }),
};
