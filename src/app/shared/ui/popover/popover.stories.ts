import type { Meta, StoryObj } from '@storybook/angular';
import { Button } from '../button/button';
import { PopoverTrigger } from './popover-trigger';

const meta: Meta<PopoverTrigger> = {
  title: 'UI/Popover',
  component: PopoverTrigger,
  tags: ['autodocs'],
  render: () => ({
    moduleMetadata: { imports: [Button, PopoverTrigger] },
    template: `
      <div class="flex gap-3">
        <button app-button type="button" appPopoverTrigger="CPE credits are recorded once the final assessment is passed.">
          Open popover
        </button>
        <button app-button type="button" variant="outline" appPopoverTrigger="Anchored above." appPopoverTriggerPlacement="top">
          Placement: top
        </button>
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<PopoverTrigger>;

/** Click to open; Escape or an outside click closes it. */
export const Default: Story = {};
