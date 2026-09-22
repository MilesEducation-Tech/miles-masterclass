import type { Meta, StoryObj } from '@storybook/angular';
import { UtilsDialog } from './utils-dialog';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';

const meta: Meta<UtilsDialog> = {
  title: 'Dialog/Utils',
  component: UtilsDialog,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 500px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<UtilsDialog>;

export const Confirmation: Story = {
  render: () => ({
    props: {
      init(component: UtilsDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          title: 'Confirm Action',
          containerClass: '',
          content: [
            { type: 'text', value: 'Are you sure you want to remove this course from your cart?' },
          ],
          buttons: [
            { label: 'Cancel', variant: 'outline', action: 'cancel' as const },
            { label: 'Confirm', variant: 'default', action: 'confirm' as const },
          ],
        };
      },
    },
    template: `
      <div style="width: 500px;">
        <app-utils-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const InfoWithList: Story = {
  render: () => ({
    props: {
      init(component: UtilsDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          title: 'Course Requirements',
          containerClass: '',
          content: [
            { type: 'heading', value: 'Prerequisites', level: 3 },
            {
              type: 'text',
              value:
                'Before starting this course, please ensure you meet the following requirements:',
            },
            {
              type: 'list',
              items: [
                'Basic accounting knowledge',
                'Access to a calculator',
                'Minimum 10 hours of study time per week',
                'Stable internet connection for video content',
              ],
            },
            {
              type: 'note',
              value:
                'CPE credits are only awarded after passing the assessment with 75% or higher.',
              variant: 'info',
            },
          ],
          buttons: [{ label: 'Got It', variant: 'default', action: 'close' as const }],
        };
      },
    },
    template: `
      <div style="width: 500px;">
        <app-utils-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const WarningNote: Story = {
  render: () => ({
    props: {
      init(component: UtilsDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          title: 'Important Notice',
          containerClass: '',
          content: [
            {
              type: 'note',
              value:
                'Your subscription will expire in 3 days. Renew now to continue accessing all courses.',
              variant: 'warning',
            },
            {
              type: 'description',
              value: 'You can renew from the subscription page or contact support for assistance.',
            },
          ],
          buttons: [
            { label: 'Later', variant: 'ghost', action: 'cancel' as const },
            { label: 'Renew Now', variant: 'default', action: 'confirm' as const },
          ],
        };
      },
    },
    template: `
      <div style="width: 500px;">
        <app-utils-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const WithTable: Story = {
  render: () => ({
    props: {
      init(component: UtilsDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          title: 'CPE Credit Summary',
          containerClass: '',
          content: [
            { type: 'text', value: 'Your CPE credit progress for the current period:' },
            {
              type: 'table',
              headers: ['Course', 'Credits', 'Status'],
              rows: [
                ['CPA Exam Strategies', '4', 'Completed'],
                ['Ethics in Accounting', '2', 'In Progress'],
                ['Tax Season Tips', '1', 'Not Started'],
              ],
            },
          ],
          buttons: [{ label: 'Close', variant: 'outline', action: 'close' as const }],
        };
      },
    },
    template: `
      <div style="width: 500px;">
        <app-utils-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};
