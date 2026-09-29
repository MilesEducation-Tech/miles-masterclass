import type { Meta, StoryObj } from '@storybook/angular';
import { Button } from '../button/button';
import { TooltipTrigger } from './tooltip-trigger';

const meta: Meta<TooltipTrigger> = {
  title: 'UI/Tooltip',
  component: TooltipTrigger,
  tags: ['autodocs'],
  render: () => ({
    moduleMetadata: { imports: [Button, TooltipTrigger] },
    template: `
      <div class="flex gap-3">
        <button app-button type="button" variant="outline" appTooltipTrigger="Download the certificate as PDF">
          Hover or focus me
        </button>
        <button app-button type="button" variant="ghost" appTooltipTrigger="Shown to the right" appTooltipTriggerPlacement="right">
          Placement: right
        </button>
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<TooltipTrigger>;

export const Default: Story = {};
