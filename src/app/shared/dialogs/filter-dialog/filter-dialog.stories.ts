import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { FilterDialog } from './filter-dialog';
import { provideStoryDialogRef } from '@testing/mocks/dialog.mock';

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
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
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
        }),
      ],
    }),
  ],
  render: () => ({ template: `<app-filter-dialog />` }),
};

export const WithSelections: Story = {
  decorators: [
    moduleMetadata({
      providers: [
        provideStoryDialogRef({
          topics: [
            { id: 1, name: 'Auditing', selected: true },
            { id: 2, name: 'Taxation', selected: true },
            { id: 3, name: 'Financial Reporting', selected: false },
          ],
          cpe_credits: [{ id: 4, name: '4 Credits', selected: true }],
        }),
      ],
    }),
  ],
  render: () => ({ template: `<app-filter-dialog />` }),
};
