import type { Meta, StoryObj } from '@storybook/angular';
import { FilterDialog } from './filter-dialog';
import { MockDialogRef } from '../../../../testing/mocks/dialog.mock';

const meta: Meta<FilterDialog> = {
  title: 'Dialog/Filter',
  component: FilterDialog,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 450px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<FilterDialog>;

export const Default: Story = {
  render: () => ({
    props: {
      init(component: FilterDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          topics: [
            { id: 1, name: 'Auditing', selected: false },
            { id: 2, name: 'Taxation', selected: false },
            { id: 3, name: 'Financial Reporting', selected: true },
            { id: 4, name: 'Business Law', selected: false },
          ],
          experts: [
            { id: 1, name: 'Sarah Johnson', selected: false },
            { id: 2, name: 'Michael Chen', selected: true },
            { id: 3, name: 'Emily Davis', selected: false },
          ],
          cpe_credits: [
            { id: 1, name: '1 Credit', selected: false },
            { id: 2, name: '2 Credits', selected: false },
            { id: 4, name: '4 Credits', selected: false },
          ],
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-filter-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};

export const WithSelections: Story = {
  render: () => ({
    props: {
      init(component: FilterDialog) {
        component.dialogRef = new MockDialogRef() as any;
        component.data = {
          topics: [
            { id: 1, name: 'Auditing', selected: true },
            { id: 2, name: 'Taxation', selected: true },
            { id: 3, name: 'Financial Reporting', selected: false },
          ],
          cpe_credits: [{ id: 4, name: '4 Credits', selected: true }],
        };
      },
    },
    template: `
      <div style="width: 450px;">
        <app-filter-dialog #comp />
        {{ init(comp) }}
      </div>
    `,
  }),
};
