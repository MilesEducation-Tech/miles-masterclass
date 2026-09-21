import type { Meta, StoryObj } from '@storybook/angular';
import { CourseAbout } from './course-about';
import { MOCK_CONTENT_ABOUT } from '../__mocks__/content.mock';

const meta: Meta<CourseAbout> = {
  title: 'Components/CourseAbout',
  component: CourseAbout,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 600px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    type: {
      control: 'select',
      options: ['masterclass', 'podcast', 'micro-learning'],
      description: 'Course content type',
    },
  },
};

export default meta;
type Story = StoryObj<CourseAbout>;

export const Masterclass: Story = {
  args: {
    card: MOCK_CONTENT_ABOUT,
    type: 'masterclass',
  },
};

export const Podcast: Story = {
  args: {
    card: { ...MOCK_CONTENT_ABOUT, course_type: 'podcast' },
    type: 'podcast',
  },
};

export const MicroLearning: Story = {
  args: {
    card: { ...MOCK_CONTENT_ABOUT, course_type: 'micro-learning' },
    type: 'micro-learning',
  },
};
