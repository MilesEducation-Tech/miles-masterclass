import type { Meta, StoryObj } from '@storybook/angular';
import { Heading } from './heading';

const meta: Meta<Heading> = {
  title: 'Components/Heading',
  component: Heading,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 500px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    heading: { control: 'object', description: 'Heading data with text and optional subText' },
  },
};

export default meta;
type Story = StoryObj<Heading>;

export const Default: Story = {
  args: {
    heading: { text: 'Popular Masterclasses' },
  },
};

export const WithSubText: Story = {
  args: {
    heading: {
      text: 'Trending Courses',
      subText: 'Most popular courses this week across all categories',
    },
  },
};

export const LongTitle: Story = {
  args: {
    heading: {
      text: 'Explore Our Complete Library of Professional Development Resources',
      subText: 'CPA, CMA, EA, and more — all in one place',
    },
  },
};

export const ShortTitle: Story = {
  args: {
    heading: { text: 'FAQ' },
  },
};

export const AllVariations: Story = {
  render: () => ({
    template: `
      <div style="width: 500px;" class="flex flex-col gap-6">
        <app-heading [heading]="{ text: 'Heading Only' }" />
        <app-heading [heading]="{ text: 'With Subtitle', subText: 'This has a subtitle below' }" />
        <app-heading [heading]="{ text: 'Long Subtitle Example', subText: 'This is a very long subtitle that demonstrates how text truncation works with line-clamp styling applied to the subtitle element' }" />
      </div>
    `,
  }),
};
