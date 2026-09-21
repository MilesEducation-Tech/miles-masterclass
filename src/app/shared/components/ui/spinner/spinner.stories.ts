import type { Meta, StoryObj } from '@storybook/angular';
import { Spinner } from './spinner';

const meta: Meta<Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Size of the spinner',
    },
    color: {
      control: 'text',
      description: 'Tailwind color for the spinning part (e.g., "primary", "white")',
    },
    trackColor: {
      control: 'text',
      description: 'Tailwind color for the track (e.g., "neutral-tertiary")',
    },
  },
};

export default meta;
type Story = StoryObj<Spinner>;

export const Default: Story = {
  args: {
    size: 'md',
    color: 'primary',
    trackColor: 'neutral-tertiary',
  },
};

export const ExtraSmall: Story = {
  args: { size: 'xs', color: 'primary' },
};

export const Small: Story = {
  args: { size: 'sm', color: 'primary' },
};

export const Medium: Story = {
  args: { size: 'md', color: 'primary' },
};

export const Large: Story = {
  args: { size: 'lg', color: 'primary' },
};

export const ExtraLarge: Story = {
  args: { size: 'xl', color: 'primary' },
};

export const WhiteSpinner: Story = {
  args: { size: 'lg', color: 'white', trackColor: 'neutral-tertiary' },
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="flex items-center gap-6">
        <div class="flex flex-col items-center gap-2">
          <app-spinner size="xs" color="primary" />
          <span class="text-xs text-muted-foreground">xs</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-spinner size="sm" color="primary" />
          <span class="text-xs text-muted-foreground">sm</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-spinner size="md" color="primary" />
          <span class="text-xs text-muted-foreground">md</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-spinner size="lg" color="primary" />
          <span class="text-xs text-muted-foreground">lg</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-spinner size="xl" color="primary" />
          <span class="text-xs text-muted-foreground">xl</span>
        </div>
      </div>
    `,
  }),
};
