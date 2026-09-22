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
