import type { Meta, StoryObj } from '@storybook/angular';
import { SliderSkeleton } from './slider-skeleton';

const meta: Meta<SliderSkeleton> = {
  title: 'Skeleton/SliderSkeleton',
  component: SliderSkeleton,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<SliderSkeleton>;

export const Default: Story = {};
