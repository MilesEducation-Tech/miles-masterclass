import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { TrackerTable } from './tracker-table';
import { CpeCreditCourse, CpeCreditWire } from '@features/cpe-tracker/models/cpe-credit.model';

const course = (overrides: Partial<CpeCreditCourse>): CpeCreditCourse => ({
  id: 1,
  course_type: 'masterclass',
  title: '',
  thumbnail: null,
  is_free: false,
  is_subscription_excluded: false,
  has_plan: true,
  fields_of_study: [],
  ...overrides,
});

const sampleRows: CpeCreditWire[] = [
  {
    id: 1,
    course: course({
      id: 156,
      title: 'Intro to Accounting Ethics',
      fields_of_study: [{ id: 34, name: 'Accounting', cpe_credits: 2 }],
    }),
    credits: 2,
    allocated_on: '2026-02-10',
    was_caira_credit: true,
    badge: null,
    feedback_submitted: false,
  },
  {
    id: 2,
    course: course({
      id: 194,
      course_type: 'podcast',
      title: 'Financial Reporting Essentials',
      fields_of_study: [
        { id: 45, name: 'Information Technology', cpe_credits: 2 },
        { id: 36, name: 'Auditing', cpe_credits: 2 },
      ],
    }),
    credits: 4,
    allocated_on: '2026-01-15',
    was_caira_credit: true,
    badge: null,
    feedback_submitted: true,
  },
  {
    id: 3,
    course: course({
      id: 88,
      course_type: 'webinar',
      title: 'Tax Updates 2026',
      fields_of_study: [{ id: 48, name: 'Taxes', cpe_credits: 1.5 }],
    }),
    credits: 1.5,
    allocated_on: '2026-05-02',
    was_caira_credit: true,
    badge: {
      id: 6072,
      name: 'Tax Season Readiness',
      icon_url: null,
      status: 'earned',
      accept_url: 'https://www.credly.com/go/AbCdEfGh',
    },
    feedback_submitted: true,
  },
  {
    id: 4,
    course: course({
      id: 301,
      course_type: 'nano_learning',
      title: 'Micro-learning: Revenue Recognition',
      fields_of_study: [{ id: 40, name: 'Ethics', cpe_credits: 0.5 }],
    }),
    credits: 0.5,
    allocated_on: '2026-03-21',
    was_caira_credit: false,
    badge: null,
    feedback_submitted: false,
  },
];

const meta: Meta<TrackerTable> = {
  title: 'CPE Tracker/Table',
  component: TrackerTable,
  tags: ['autodocs'],
  render: (args) => ({
    props: args,
    template: `<div style="max-width: 960px;"><app-tracker-table ${argsToTemplate(args)}></app-tracker-table></div>`,
  }),
};

export default meta;
type Story = StoryObj<TrackerTable>;

export const Default: Story = {
  args: {
    rows: sampleRows,
    isLoading: false,
    currentPage: 1,
    totalPages: 3,
    pageWindow: { from: 1, to: 4, total: 42 },
  },
};

export const Loading: Story = {
  args: { rows: [], isLoading: true },
};

export const Empty: Story = {
  args: { rows: [], isLoading: false },
};
