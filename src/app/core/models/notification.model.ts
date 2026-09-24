export type ToastType = 'success' | 'error' | 'info';

export type ToastPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
  closable: boolean;
  position: ToastPosition;
}

/**
 * What `NotificationService` hands each toast when it shows one.
 *
 * Lives here rather than beside the component because `NotificationService` is
 * a core singleton: core must not import shared (PROMPT.md §3), and the shared
 * toast already imports `ToastType` from this file.
 */
export interface ToastContext {
  title: string;
  message: string;
  type: ToastType;
  closable: boolean;
}

export interface ToastOptions {
  duration?: number;
  closable?: boolean;
  position?: ToastPosition;
}

export interface ToastTimer {
  timeoutId: ReturnType<typeof setTimeout> | null;
  startTime: number;
  remainingTime: number;
}
