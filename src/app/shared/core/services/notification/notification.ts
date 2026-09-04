import { inject, Injectable } from '@angular/core';
import { NgpToastManager } from 'ng-primitives/toast';
import { ToastComponent, ToastContext } from '../../../components/ui/toast/toast';
import { ToastOptions, ToastPosition, ToastType } from '../../models/notification.model';

/** `ToastPosition` (this app's vocabulary) → ng-primitives placement. */
const PLACEMENT: Record<ToastPosition, string> = {
  'top-left': 'top-start',
  'top-center': 'top-center',
  'top-right': 'top-end',
  'bottom-left': 'bottom-start',
  'bottom-center': 'bottom-center',
  'bottom-right': 'bottom-end',
};

/**
 * Toast entry point for the app. The queue, timers, stacking and placement
 * containers all live in `NgpToastManager`; this service only keeps the
 * title/message/type vocabulary the call sites already use.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly manager = inject(NgpToastManager);

  show(title: string, message: string, type: ToastType, options?: ToastOptions): void {
    const context: ToastContext = {
      type,
      title,
      message,
      closable: options?.closable ?? true,
    };

    this.manager.show(ToastComponent, {
      context,
      placement: PLACEMENT[options?.position ?? 'top-right'],
      duration: options?.duration ?? 3000,
      dismissible: context.closable,
    } as Parameters<NgpToastManager['show']>[1]);
  }

  success(title: string, message: string, options?: ToastOptions): void {
    this.show(title, message, 'success', options);
  }

  error(title: string, message: string, options?: ToastOptions): void {
    this.show(title, message, 'error', options);
  }

  info(title: string, message: string, options?: ToastOptions): void {
    this.show(title, message, 'info', options);
  }
}
