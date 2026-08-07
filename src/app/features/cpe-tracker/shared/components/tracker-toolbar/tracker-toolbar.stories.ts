import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { TrackerToolbar } from './tracker-toolbar';

const credits: any = { total: 95, earned: 95, required: 120, pending: 25 };

const meta: Meta<TrackerToolbar> = {
  title: 'CPE Tracker/Toolbar',
  component: TrackerToolbar,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="background: #000; padding: 24px; max-width: 1100px;"><app-tracker-toolbar ${argsToTemplate(args)}></app-tracker-toolbar></div>`,
  }),
};

export default meta;
type Story = StoryObj<TrackerToolbar>;

export const Default: Story = {
  args: {
    selectedYear: 2026,
    yearOptions: [2026, 2025, 2024, 2023, 2022],
    credits,
    studyFilter: 'All',
  },
};

export const NoCredits: Story = {
  args: {
    selectedYear: 2026,
    yearOptions: [2026, 2025, 2024],
    credits: null,
    studyFilter: 'All',
  },
};
