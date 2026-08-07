import type { Meta, StoryObj } from '@storybook/angular';
import { PodcastCourseHeroSkeleton } from './podcast-course-hero-skeleton';

const meta: Meta<PodcastCourseHeroSkeleton> = {
  title: 'Skeleton/PodcastCourseHeroSkeleton',
  component: PodcastCourseHeroSkeleton,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<PodcastCourseHeroSkeleton>;

export const Default: Story = {};
