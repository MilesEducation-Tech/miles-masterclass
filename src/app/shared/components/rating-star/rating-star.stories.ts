import type { Meta, StoryObj } from '@storybook/angular';
import { RatingStar } from './rating-star';

const meta: Meta<RatingStar> = {
  title: 'Components/RatingStar',
  component: RatingStar,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 300px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 5, step: 0.1 },
      description: 'Current rating value (supports decimals for partial stars)',
    },
    isReadonly: { control: 'boolean', description: 'Whether the rating is read-only' },
    max: { control: { type: 'number', min: 1, max: 10 }, description: 'Maximum number of stars' },
    size: { control: 'text', description: 'Star size (CSS value)' },
  },
};

export default meta;
type Story = StoryObj<RatingStar>;

export const Default: Story = {
  args: {
    value: 4,
    isReadonly: false,
    max: 5,
    size: '1.5rem',
  },
};

export const PartialStar: Story = {
  args: {
    value: 3.7,
    isReadonly: true,
    max: 5,
    size: '1.5rem',
  },
};

export const Readonly: Story = {
  args: {
    value: 4.5,
    isReadonly: true,
    max: 5,
  },
};

export const Empty: Story = {
  args: {
    value: 0,
    isReadonly: false,
    max: 5,
  },
};

export const Full: Story = {
  args: {
    value: 5,
    isReadonly: true,
    max: 5,
  },
};

export const LargeStars: Story = {
  args: {
    value: 3,
    isReadonly: false,
    max: 5,
    size: '2.5rem',
  },
};

export const SmallStars: Story = {
  args: {
    value: 4.2,
    isReadonly: true,
    max: 5,
    size: '1rem',
  },
};

export const TenStarScale: Story = {
  args: {
    value: 7,
    isReadonly: false,
    max: 10,
    size: '1.25rem',
  },
};

export const RatingShowcase: Story = {
  render: () => ({
    template: `
      <div style="width: 300px;" class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <app-rating-star [value]="1" [isReadonly]="true" />
          <span class="text-sm text-muted-foreground">1.0</span>
        </div>
        <div class="flex items-center gap-3">
          <app-rating-star [value]="2.5" [isReadonly]="true" />
          <span class="text-sm text-muted-foreground">2.5</span>
        </div>
        <div class="flex items-center gap-3">
          <app-rating-star [value]="3.7" [isReadonly]="true" />
          <span class="text-sm text-muted-foreground">3.7</span>
        </div>
        <div class="flex items-center gap-3">
          <app-rating-star [value]="4.5" [isReadonly]="true" />
          <span class="text-sm text-muted-foreground">4.5</span>
        </div>
        <div class="flex items-center gap-3">
          <app-rating-star [value]="5" [isReadonly]="true" />
          <span class="text-sm text-muted-foreground">5.0</span>
        </div>
      </div>
    `,
  }),
};
