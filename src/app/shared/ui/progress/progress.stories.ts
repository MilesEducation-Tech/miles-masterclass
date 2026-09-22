import type { Meta, StoryObj } from '@storybook/angular';
import { Progress } from './progress';

const meta: Meta<Progress> = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (story) => ({
      template: `<div style="width: 400px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Current progress value (0-100)',
    },
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'error', 'info'],
      description: 'Visual variant of the progress bar',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg'],
      description: 'Height of the progress bar',
    },
    label: {
      control: 'select',
      options: ['none', 'right', 'inside', 'top'],
      description: 'Label position',
    },
    labelText: {
      control: 'text',
      description: 'Custom label text (used with "top" position)',
    },
    striped: {
      control: 'boolean',
      description: 'Show diagonal stripe pattern',
    },
    animated: {
      control: 'boolean',
      description: 'Animate the stripes',
    },
    indeterminate: {
      control: 'boolean',
      description: 'Show indeterminate loading animation',
    },
  },
};

export default meta;
type Story = StoryObj<Progress>;

export const Default: Story = {
  args: {
    value: 60,
    variant: 'default',
    size: 'sm',
    label: 'none',
  },
};

export const WithLabelRight: Story = {
  args: {
    value: 75,
    variant: 'default',
    size: 'md',
    label: 'right',
  },
};

export const WithLabelTop: Story = {
  args: {
    value: 45,
    variant: 'info',
    size: 'md',
    label: 'top',
    labelText: 'Course Progress',
  },
};

export const WithLabelInside: Story = {
  args: {
    value: 65,
    variant: 'success',
    size: 'lg',
    label: 'inside',
  },
};

export const Striped: Story = {
  args: {
    value: 50,
    variant: 'info',
    size: 'md',
    striped: true,
  },
};

export const StripedAnimated: Story = {
  args: {
    value: 70,
    variant: 'warning',
    size: 'md',
    striped: true,
    animated: true,
  },
};

export const Indeterminate: Story = {
  args: {
    variant: 'default',
    size: 'sm',
    indeterminate: true,
  },
};

export const Success: Story = {
  args: { value: 100, variant: 'success', size: 'md', label: 'right' },
};

export const Warning: Story = {
  args: { value: 40, variant: 'warning', size: 'md', label: 'right' },
};

export const Error: Story = {
  args: { value: 15, variant: 'error', size: 'md', label: 'right' },
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="flex flex-col gap-4 w-80">
        <app-progress [value]="60" variant="default" size="md" label="right" />
        <app-progress [value]="80" variant="success" size="md" label="right" />
        <app-progress [value]="45" variant="warning" size="md" label="right" />
        <app-progress [value]="20" variant="error" size="md" label="right" />
        <app-progress [value]="70" variant="info" size="md" label="right" />
      </div>
    `,
  }),
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="flex flex-col gap-4 w-80">
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-6">xs</span>
          <app-progress class="flex-1" [value]="60" size="xs" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-6">sm</span>
          <app-progress class="flex-1" [value]="60" size="sm" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-6">md</span>
          <app-progress class="flex-1" [value]="60" size="md" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-6">lg</span>
          <app-progress class="flex-1" [value]="60" size="lg" />
        </div>
      </div>
    `,
  }),
};
