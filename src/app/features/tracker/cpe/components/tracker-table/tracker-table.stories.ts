import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { TrackerTable } from './tracker-table';
import { CpeCreditCourse, CpeCreditWire } from '@features/tracker/cpe/models/cpe-credit.model';

const course = (overrides: Partial<CpeCreditCourse>): CpeCreditCourse => ({
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  course_type: 'course',
  title: '',
  slug: 'a-course',
  thumbnail: null,
  is_archived: false,
  fields_of_study: [],
  ...overrides,
});

const row = (overrides: Partial<CpeCreditWire>): CpeCreditWire => ({
  id: '3f1e2d4c-0000-4000-8000-000000000001',
  course: course({}),
  credits: 1,
  allocated_on: '2026-01-01',
  was_caira_credit: true,
  delivery_method: 'QAS Self Study',
  badge: null,
  certificate_available: false,
  feedback_required: true,
  feedback_submitted: true,
  ...overrides,
});

const sampleRows: CpeCreditWire[] = [
  row({
    id: 'award-1',
    course: course({
      title: 'Intro to Accounting Ethics',
      slug: 'intro-to-accounting-ethics',
      fields_of_study: [{ id: 'fos-34', name: 'Accounting', cpe_credits: 2 }],
    }),
    credits: 2,
    allocated_on: '2026-02-10',
    feedback_submitted: false,
  }),
  row({
    id: 'award-2',
    course: course({
      course_type: 'podcast',
      title: 'Financial Reporting Essentials',
      slug: 'financial-reporting-essentials',
      fields_of_study: [
        { id: 'fos-45', name: 'Information Technology', cpe_credits: 2 },
        { id: 'fos-36', name: 'Auditing', cpe_credits: 2 },
      ],
    }),
    credits: 4,
    allocated_on: '2026-01-15',
    certificate_available: true,
  }),
  // Claimed badge → the only row with a "View Badge" action.
  row({
    id: 'award-3',
    course: course({
      course_type: 'webinar',
      title: 'Tax Updates 2026',
      slug: 'tax-updates-2026',
      fields_of_study: [{ id: 'fos-48', name: 'Taxes', cpe_credits: 1.5 }],
    }),
    credits: 1.5,
    allocated_on: '2026-05-02',
    delivery_method: 'Group Internet Based',
    badge: {
      id: 'badge-6072',
      name: 'Tax Season Readiness',
      image_url: null,
      state: 'CLAIMED',
      claimed: true,
      accept_url: 'https://www.credly.com/go/AbCdEfGh',
    },
  }),
  // Archived legacy content: no course type, no slug — the title must render as plain text.
  row({
    id: 'award-4',
    course: course({
      id: null,
      course_type: null,
      title: 'Micro-learning: Revenue Recognition',
      slug: null,
      is_archived: true,
      fields_of_study: [{ id: 'fos-40', name: 'Ethics', cpe_credits: 0.5 }],
    }),
    credits: 0.5,
    allocated_on: '2026-03-21',
    delivery_method: 'Nano Learning',
    was_caira_credit: false,
    feedback_required: false,
    feedback_submitted: false,
  }),
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
