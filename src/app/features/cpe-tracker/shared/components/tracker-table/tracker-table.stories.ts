import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { TrackerTable } from './tracker-table';
import { TrackerTableRow } from '../../mappers/report-to-table';

const sampleRows: TrackerTableRow[] = [
  {
    key: 'masterclass-1',
    id: 1,
    courseName: 'Intro to Accounting Ethics',
    fieldsOfStudy: [{ id: 1, name: 'Ethics', cpe_credits: 2 }],
    deliveryMethod: 'QAS Self Study',
    totalCredits: 2,
    completedAt: '2026-02-10T10:00:00Z',
    registeredAt: null,
    actionKind: 'feedback',
    cairaLevel: 1,
    raw: {} as TrackerTableRow['raw'],
  },
  {
    key: 'masterclass-2',
    id: 2,
    courseName: 'Financial Reporting Essentials',
    fieldsOfStudy: [{ id: 2, name: 'Accounting', cpe_credits: 4 }],
    deliveryMethod: 'QAS Self Study',
    totalCredits: 4,
    completedAt: '2026-01-15T09:00:00Z',
    registeredAt: null,
    actionKind: 'download',
    cairaLevel: 1,
    raw: {} as TrackerTableRow['raw'],
  },
  {
    key: 'webinar-3',
    id: 3,
    courseName: 'Tax Updates 2026',
    fieldsOfStudy: [{ id: 3, name: 'Taxes', cpe_credits: 1.5 }],
    deliveryMethod: 'Group Internet Based',
    totalCredits: 1.5,
    completedAt: null,
    registeredAt: '2026-05-02T14:00:00Z',
    actionKind: 'registered',
    cairaLevel: 1,
    raw: {} as TrackerTableRow['raw'],
  },
  {
    key: 'nano-4',
    id: 4,
    courseName: 'Micro-learning: Revenue Recognition',
    fieldsOfStudy: [{ id: 4, name: 'Accounting', cpe_credits: 0.5 }],
    deliveryMethod: 'QAS Self Study',
    totalCredits: 0.5,
    completedAt: null,
    registeredAt: null,
    actionKind: 'resume',
    cairaLevel: 1,
    raw: {} as TrackerTableRow['raw'],
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
  args: { rows: sampleRows, isLoading: false },
};

export const Loading: Story = {
  args: { rows: sampleRows, isLoading: true },
};

export const Empty: Story = {
  args: { rows: [], isLoading: false },
};
