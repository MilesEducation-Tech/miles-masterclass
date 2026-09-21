import type { Meta, StoryObj } from '@storybook/angular';
import { MilesSlug } from './miles-slug';

const meta: Meta<MilesSlug> = {
  title: 'Components/MilesSlug',
  component: MilesSlug,
  tags: ['autodocs'],
  argTypes: {
    slug: {
      control: 'select',
      options: ['masterclass', 'podcast', 'micro-learning'],
      description: 'Course type slug for logo badge',
    },
  },
};

export default meta;
type Story = StoryObj<MilesSlug>;

export const Masterclass: Story = {
  args: { slug: 'masterclass' },
};

export const Podcast: Story = {
  args: { slug: 'podcast' },
};

export const MicroLearning: Story = {
  args: { slug: 'micro-learning' },
};

export const AllSlugs: Story = {
  render: () => ({
    template: `
      <div class="flex flex-col gap-4 items-start">
        <div class="flex items-center gap-3">
          <app-miles-slug slug="miles masterclass" />
          <span class="text-sm text-muted-foreground">Masterclass</span>
        </div>
        <div class="flex items-center gap-3">
          <app-miles-slug slug="podcast" />
          <span class="text-sm text-muted-foreground">Podcast</span>
        </div>
        <div class="flex items-center gap-3">
          <app-miles-slug slug="micro-learning" />
          <span class="text-sm text-muted-foreground">Micro Learning</span>
        </div>
      </div>
    `,
  }),
};
