import type { Meta, StoryObj } from '@storybook/angular';
import { ChapterSkeleton } from './chapter-skeleton';

const meta: Meta<ChapterSkeleton> = {
  title: 'Skeleton/ChapterSkeleton',
  component: ChapterSkeleton,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 600px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
};

export default meta;
type Story = StoryObj<ChapterSkeleton>;

export const Default: Story = {};

export const Multiple: Story = {
  render: () => ({
    template: `
      <div style="width: 600px;" class="flex flex-col gap-4">
        <app-chapter-skeleton />
        <app-chapter-skeleton />
        <app-chapter-skeleton />
      </div>
    `,
  }),
};
