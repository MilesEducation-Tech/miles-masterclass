import type { Meta, StoryObj } from '@storybook/angular';
import { AriaMultiselect } from './aria-multiselect';

const meta: Meta<AriaMultiselect> = {
  title: 'UI/Aria/Multiselect',
  component: AriaMultiselect,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (story) => ({
      template: `<div style="width: 480px;">${story().template ?? ''}</div>`,
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
    maxChips: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<AriaMultiselect>;

const TOPICS = [
  { value: 'accounting', label: 'Accounting' },
  { value: 'audit', label: 'Audit' },
  { value: 'tax', label: 'Tax' },
  { value: 'finance', label: 'Finance' },
  { value: 'ethics', label: 'Ethics' },
  { value: 'leadership', label: 'Leadership' },
];

export const Basic: Story = {
  args: {
    id: 'topics',
    label: 'Topics of interest',
    placeholder: 'Pick one or more',
    options: TOPICS,
  },
};

export const Preselected: Story = {
  args: {
    id: 'topics-pre',
    label: 'Topics of interest',
    options: TOPICS,
    value: ['accounting', 'tax'],
  },
};

export const OverflowChips: Story = {
  args: {
    id: 'topics-overflow',
    label: 'Topics of interest',
    options: TOPICS,
    value: ['accounting', 'audit', 'tax', 'finance'],
    maxChips: 2,
  },
};
