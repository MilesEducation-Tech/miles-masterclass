import type { Meta, StoryObj } from '@storybook/angular';
import { MasterclassCourseHeroSkeleton } from './masterclass-course-hero-skeleton';

const meta: Meta<MasterclassCourseHeroSkeleton> = {
  title: 'Skeleton/MasterclassCourseHeroSkeleton',
  component: MasterclassCourseHeroSkeleton,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<MasterclassCourseHeroSkeleton>;

export const Default: Story = {};
