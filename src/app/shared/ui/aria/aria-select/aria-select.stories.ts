import type { Meta, StoryObj } from '@storybook/angular';
import { AriaSelect } from './aria-select';

const meta: Meta<AriaSelect> = {
  title: 'UI/Aria/Select',
  component: AriaSelect,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    id: { control: 'text' },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
    invalid: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<AriaSelect>;

const COURSES = [
  { value: 'cpa', label: 'CPA' },
  { value: 'cma', label: 'CMA' },
  { value: 'ea', label: 'EA' },
  { value: 'cia', label: 'CIA' },
];

export const Basic: Story = {
  args: {
    id: 'course',
    label: 'Select Course',
    placeholder: 'Choose…',
    options: COURSES,
  },
};

export const Preselected: Story = {
  args: {
    id: 'course-pre',
    label: 'Select Course',
    options: COURSES,
    value: 'cma',
  },
};

export const Disabled: Story = {
  args: {
    id: 'course-disabled',
    label: 'Select Course',
    options: COURSES,
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    id: 'course-error',
    label: 'Select Course',
    options: COURSES,
    invalid: true,
    touched: true,
    errors: [{ message: 'Please choose a course' }],
  },
};
