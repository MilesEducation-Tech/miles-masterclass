import type { Meta, StoryObj } from '@storybook/angular';
import { ToastComponent } from './toast';
import { MOCK_SUCCESS_TOAST, MOCK_ERROR_TOAST, MOCK_INFO_TOAST } from '@testing/mocks/toast.mock';

const meta: Meta<ToastComponent> = {
  title: 'UI/Toast',
  component: ToastComponent,
  tags: ['autodocs'],
  decorators: [
    (story) => ({
      template: `<div style="width: 380px;">${story().template ?? ''}</div>`,
      props: story().props,
    }),
  ],
  argTypes: {
    toast: { control: 'object', description: 'Toast data object' },
  },
};

export default meta;
type Story = StoryObj<ToastComponent>;

export const Success: Story = {
  args: {
    toast: MOCK_SUCCESS_TOAST,
  },
};

export const Error: Story = {
  args: {
    toast: MOCK_ERROR_TOAST,
  },
};

export const Info: Story = {
  args: {
    toast: MOCK_INFO_TOAST,
  },
};

export const NonClosable: Story = {
  args: {
    toast: { ...MOCK_INFO_TOAST, id: 'toast-nc', closable: false },
  },
};

export const LongMessage: Story = {
  args: {
    toast: {
      ...MOCK_ERROR_TOAST,
      id: 'toast-long',
      title: 'Payment Failed',
      message:
        'Your payment could not be processed. Please check your card details, ensure sufficient balance, and try again. If the issue persists, contact support.',
    },
  },
};

export const AllTypes: Story = {
  render: () => ({
    props: {
      success: MOCK_SUCCESS_TOAST,
      error: MOCK_ERROR_TOAST,
      info: MOCK_INFO_TOAST,
    },
    template: `
      <div style="width: 380px;" class="flex flex-col gap-4">
        <app-toast [toast]="success" />
        <app-toast [toast]="error" />
        <app-toast [toast]="info" />
      </div>
    `,
  }),
};
