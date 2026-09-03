import type { Meta, StoryObj } from '@storybook/angular';
import { argsToTemplate } from '@storybook/angular';
import { ErrorState } from './error-state';

const meta: Meta<ErrorState> = {
  title: 'UI/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Error title displayed prominently',
    },
    message: {
      control: 'text',
      description: 'Descriptive error message',
    },
    showRetry: {
      control: 'boolean',
      description: 'Whether to show the retry button',
    },
    retryLabel: {
      control: 'text',
      description: 'Label for the retry button',
    },
    fullScreen: {
      control: 'boolean',
      description: 'Whether to take full screen height',
    },
  },
};

export default meta;
type Story = StoryObj<ErrorState>;

export const Default: Story = {
  args: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    showRetry: true,
    retryLabel: 'Try Again',
    fullScreen: false,
  },
};

export const NetworkError: Story = {
  args: {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection.',
    showRetry: true,
    retryLabel: 'Retry Connection',
    fullScreen: false,
  },
};

export const NotFound: Story = {
  args: {
    title: 'Content Not Found',
    message: 'The course or resource you are looking for does not exist or has been removed.',
    showRetry: false,
    fullScreen: false,
  },
};

export const WithoutRetry: Story = {
  args: {
    title: 'Access Denied',
    message: 'You do not have permission to view this content.',
    showRetry: false,
    fullScreen: false,
  },
};

export const CustomRetryLabel: Story = {
  args: {
    title: 'Session Expired',
    message: 'Your session has timed out. Please log in again to continue.',
    showRetry: true,
    retryLabel: 'Log In Again',
    fullScreen: false,
  },
};
