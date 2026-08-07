import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { signal } from '@angular/core';
import { NotificationComponent } from './notification';
import { NotificationService } from '../../core/services/notification/notification';
import { Toast } from '../../core/models/notification.model';

class MockNotificationService {
  readonly toasts = signal<Toast[]>([]);

  remove(id: string) {
    this.toasts.update((t) => t.filter((toast) => toast.id !== id));
  }

  pauseTimer = (_id: string): void => undefined;
  resumeTimer = (_id: string): void => undefined;
}

class MockNotificationWithToasts extends MockNotificationService {
  override readonly toasts = signal<Toast[]>([
    {
      id: '1',
      type: 'success',
      title: 'Course Completed',
      message: 'You have successfully completed Advanced CPA Strategies.',
      duration: 5000,
      closable: true,
      position: 'top-right',
    },
    {
      id: '2',
      type: 'info',
      title: 'New Content Available',
      message: 'A new chapter has been added to Ethics in Accounting.',
      duration: 5000,
      closable: true,
      position: 'top-right',
    },
  ]);
}

class MockNotificationAllPositions extends MockNotificationService {
  override readonly toasts = signal<Toast[]>([
    {
      id: '1',
      type: 'success',
      title: 'Top Right',
      message: 'Success notification',
      duration: 5000,
      closable: true,
      position: 'top-right',
    },
    {
      id: '2',
      type: 'error',
      title: 'Top Left',
      message: 'Error notification',
      duration: 5000,
      closable: true,
      position: 'top-left',
    },
    {
      id: '3',
      type: 'info',
      title: 'Bottom Right',
      message: 'Info notification',
      duration: 5000,
      closable: true,
      position: 'bottom-right',
    },
  ]);
}

class MockNotificationError extends MockNotificationService {
  override readonly toasts = signal<Toast[]>([
    {
      id: '1',
      type: 'error',
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please try again.',
      duration: 5000,
      closable: true,
      position: 'top-right',
    },
  ]);
}

const meta: Meta<NotificationComponent> = {
  title: 'Layout/Notification',
  component: NotificationComponent,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({
      providers: [{ provide: NotificationService, useClass: MockNotificationService }],
    }),
  ],
};

export default meta;
type Story = StoryObj<NotificationComponent>;

export const Empty: Story = {};

export const SuccessAndInfo: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: NotificationService, useClass: MockNotificationWithToasts }],
    }),
  ],
};

export const MultiplePositions: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: NotificationService, useClass: MockNotificationAllPositions }],
    }),
  ],
};

export const ErrorNotification: Story = {
  decorators: [
    moduleMetadata({
      providers: [{ provide: NotificationService, useClass: MockNotificationError }],
    }),
  ],
};
