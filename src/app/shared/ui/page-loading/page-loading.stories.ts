import type { Meta, StoryObj } from '@storybook/angular';
import { PageLoading } from './page-loading';

const meta: Meta<PageLoading> = {
  title: 'UI/PageLoading',
  component: PageLoading,
  tags: ['autodocs'],
  argTypes: {
    message: {
      control: 'text',
      description: 'Loading message shown below the spinner',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size of the spinner',
    },
    fullScreen: {
      control: 'boolean',
      description: 'Whether to take full screen height',
    },
  },
};

export default meta;
type Story = StoryObj<PageLoading>;

export const Default: Story = {
  args: {
    message: 'Loading...',
    size: 'xl',
    fullScreen: false,
  },
};

export const CustomMessage: Story = {
  args: {
    message: 'Loading your course content...',
    size: 'xl',
    fullScreen: false,
  },
};

export const SmallSpinner: Story = {
  args: {
    message: 'Please wait...',
    size: 'sm',
    fullScreen: false,
  },
};

export const NoMessage: Story = {
  args: {
    message: '',
    size: 'lg',
    fullScreen: false,
  },
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div class="flex items-end gap-12">
        <div class="flex flex-col items-center gap-2">
          <app-page-loading size="sm" message="sm" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-page-loading size="md" message="md" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-page-loading size="lg" message="lg" />
        </div>
        <div class="flex flex-col items-center gap-2">
          <app-page-loading size="xl" message="xl" />
        </div>
      </div>
    `,
  }),
};
