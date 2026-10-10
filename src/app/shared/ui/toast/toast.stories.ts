import { Component, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { NotificationService, TOAST_COMPONENT } from '@core/services/notification/notification';
import { Button } from '../button/button';
import { Toast } from './toast';

/** Toasts are shown by `NotificationService`, the way the app does it; nothing is bound by hand. */
@Component({
  selector: 'app-toast-demo',
  imports: [Button],
  template: `
    <div class="flex flex-wrap gap-3">
      <button app-button type="button" (click)="success()">Success</button>
      <button app-button type="button" variant="destructive" (click)="error()">Error</button>
      <button app-button type="button" variant="secondary" (click)="info()">Info</button>
      <button app-button type="button" variant="outline" (click)="sticky()">
        Not closable, 10s
      </button>
    </div>
  `,
})
class ToastDemo {
  private readonly notifications = inject(NotificationService);

  success(): void {
    this.notifications.success('Saved', 'Your progress has been saved.');
  }

  error(): void {
    this.notifications.error('Payment failed', 'Check your card details and try again.');
  }

  info(): void {
    this.notifications.info('New content', 'Refresh to see the latest courses.');
  }

  sticky(): void {
    this.notifications.info('Heads up', 'This one has no dismiss button.', {
      closable: false,
      duration: 10000,
      position: 'bottom-center',
    });
  }
}

const meta: Meta<ToastDemo> = {
  title: 'UI/Toast',
  component: ToastDemo,
  tags: ['autodocs'],
  decorators: [
    // The same binding `app.config.ts` makes: core resolves the toast through a token.
    applicationConfig({ providers: [{ provide: TOAST_COMPONENT, useValue: Toast }] }),
  ],
};

export default meta;
type Story = StoryObj<ToastDemo>;

export const Default: Story = {};
