import type { Meta, StoryObj } from '@storybook/angular';
import { AriaAutocomplete } from './aria-autocomplete';

const meta: Meta<AriaAutocomplete> = {
  title: 'UI/Aria/Autocomplete',
  component: AriaAutocomplete,
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
    searchMinLength: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<AriaAutocomplete>;

const COUNTRIES = [
  { value: 'in', label: 'India' },
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'sg', label: 'Singapore' },
  { value: 'ae', label: 'United Arab Emirates' },
];

export const Basic: Story = {
  args: {
    id: 'country',
    label: 'Country',
    placeholder: 'Start typing…',
    options: COUNTRIES,
  },
};

export const WithError: Story = {
  args: {
    id: 'country-error',
    label: 'Country',
    placeholder: 'Start typing…',
    options: COUNTRIES,
    invalid: true,
    touched: true,
    errors: [{ message: 'Please select a country' }],
  },
};

export const Disabled: Story = {
  args: {
    id: 'country-disabled',
    label: 'Country',
    placeholder: 'Start typing…',
    options: COUNTRIES,
    disabled: true,
  },
};
