import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgpToastManager } from 'ng-primitives/toast';
import { NotificationService } from '@core/services/notification/notification';

// `TOAST_COMPONENT` is bound to `Toast` for every spec in src/test-setup.ts, the same way
// app.config.ts binds it, so this exercises the real NotificationService → toast path.
describe('Toast', () => {
  let notifications: NotificationService;
  let manager: NgpToastManager;

  const toast = () => document.body.querySelector<HTMLElement>('app-toast');
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.inject(ApplicationRef).tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    notifications = TestBed.inject(NotificationService);
    manager = TestBed.inject(NgpToastManager);
  });

  afterEach(async () => {
    document.body.querySelectorAll('app-toast').forEach((el) => el.remove());
    await settle();
  });

  it('renders the title, the message and the type inside a live region', async () => {
    notifications.success('Saved', 'Your progress has been saved.');
    await settle();

    const el = toast()!;
    expect(el.textContent).toContain('Saved');
    expect(el.textContent).toContain('Your progress has been saved.');
    expect(el.getAttribute('data-type')).toBe('success');
    expect(el.closest('[aria-live]')).not.toBeNull();
  });

  it('offers a labelled dismiss button that dismisses through the manager', async () => {
    const dismiss = vi.spyOn(manager, 'dismiss');
    notifications.error('Payment failed', 'Try again.');
    await settle();

    const button = toast()!.querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toBe('Dismiss notification');
    button.click();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('shows no dismiss button when the notification is not closable', async () => {
    notifications.info('Heads up', 'No button here.', { closable: false });
    await settle();

    expect(toast()!.querySelector('button')).toBeNull();
  });
});
