import type { Meta, StoryObj } from '@storybook/angular';
import { Autocomplete } from './autocomplete';

const meta: Meta<Autocomplete> = {
  title: 'UI/Autocomplete',
  component: Autocomplete,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    id: { control: 'text' },
    placeholder: { control: 'text', description: 'Placeholder text' },
    label: { control: 'text', description: 'Floating label' },
    hint: { control: 'text', description: 'Help text' },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
    multiple: { control: 'boolean', description: 'Allow multiple selections' },
    showClear: { control: 'boolean', description: 'Show clear button' },
    emptyMessage: { control: 'text', description: 'Message when no results' },
    forceSelection: { control: 'boolean', description: 'Force selection from dropdown' },
    completeOnFocus: { control: 'boolean', description: 'Show suggestions on focus' },
  },
};

export default meta;
type Story = StoryObj<Autocomplete>;

export const Default: Story = {
  args: {
    id: 'course-search',
    placeholder: 'Search courses...',
    label: 'Course',
    options: [
      { label: 'Advanced CPA Strategies', value: 'cpa-101' },
      { label: 'CMA Preparation Guide', value: 'cma-101' },
      { label: 'EA Exam Fundamentals', value: 'ea-101' },
      { label: 'CIA Review Course', value: 'cia-101' },
      { label: 'Financial Statement Analysis', value: 'fsa-101' },
    ],
    completeOnFocus: true,
  },
};

export const WithHint: Story = {
  args: {
    id: 'instructor-search',
    placeholder: 'Search instructors...',
    label: 'Instructor',
    hint: 'Start typing to search',
    options: [
      { label: 'Sarah Johnson', value: 'sarah' },
      { label: 'Michael Chen', value: 'michael' },
      { label: 'Emily Davis', value: 'emily' },
    ],
  },
};

export const Disabled: Story = {
  args: {
    id: 'disabled-search',
    placeholder: 'Search...',
    label: 'Disabled Autocomplete',
    disabled: true,
    options: [],
  },
};

export const Required: Story = {
  args: {
    id: 'required-search',
    placeholder: 'Select a topic...',
    label: 'Topic',
    required: true,
    forceSelection: true,
    options: [
      { label: 'Auditing', value: 'auditing' },
      { label: 'Taxation', value: 'taxation' },
      { label: 'Financial Reporting', value: 'reporting' },
    ],
  },
};

export const EmptyState: Story = {
  args: {
    id: 'empty-search',
    placeholder: 'Search...',
    label: 'Search',
    emptyMessage: 'No matching courses found',
    options: [],
    completeOnFocus: true,
  },
};
