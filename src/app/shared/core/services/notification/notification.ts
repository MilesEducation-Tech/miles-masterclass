import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Toast, ToastOptions, ToastTimer, ToastType } from '../../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly toasts = signal<Toast[]>([]);
  private readonly timers = new Map<string, ToastTimer>();

  show(title: string, message: string, type: ToastType, options?: ToastOptions): void {
    const id = crypto.randomUUID();
    const duration = options?.duration ?? 3000;
    const newToast: Toast = {
      id,
      title,
      message,
      type,
      duration,
      closable: options?.closable ?? true,
      position: options?.position ?? 'top-right',
    };

    this.toasts.update((toasts) => [newToast, ...toasts]);

    if (duration > 0) {
      this.startTimer(id, duration);
    }
  }

  private startTimer(id: string, duration: number): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const timeoutId = setTimeout(() => {
      this.remove(id);
    }, duration);

    this.timers.set(id, {
      timeoutId,
      startTime: Date.now(),
      remainingTime: duration,
    });
  }

  pauseTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer?.timeoutId) {
      clearTimeout(timer.timeoutId);
      timer.timeoutId = null;
      timer.remainingTime -= Date.now() - timer.startTime;
    }
  }

  resumeTimer(id: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const timer = this.timers.get(id);
    if (timer && !timer.timeoutId && timer.remainingTime > 0) {
      timer.startTime = Date.now();
      timer.timeoutId = setTimeout(() => {
        this.remove(id);
      }, timer.remainingTime);
    }
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

  remove(id: string): void {
    const timer = this.timers.get(id);
    if (timer?.timeoutId) {
      clearTimeout(timer.timeoutId);
    }
    this.timers.delete(id);
    this.toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }
}
