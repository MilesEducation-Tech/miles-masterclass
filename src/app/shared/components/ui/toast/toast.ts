import { Component, computed, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { injectToastContext, NgpToast, NgpToastManager } from 'ng-primitives/toast';
import { ToastType } from '../../../core/models/notification.model';
import { cn } from '../../../../shared/utils/cn';

/** Content handed to each toast instance by `NotificationService`. */
export interface ToastContext {
  type: ToastType;
  title: string;
  message: string;
  closable: boolean;
}

/**
 * Toast built on the `NgpToast` primitive. The primitive owns the stacking,
 * enter/leave animation, hover-pause, swipe-to-dismiss and auto-dismiss timer;
 * `NgpToastManager` creates the placement containers. Content arrives through
 * the toast context rather than an input, because the manager instantiates this
 * component itself.
 */
@Component({
  selector: 'app-toast',
  imports: [NgIconComponent],
  hostDirectives: [NgpToast],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  providers: [provideIcons({ heroXMark })],
  host: {
    'animate.enter': 'toast-enter-top',
    'animate.leave': 'toast-leave-top',
    class: 'block w-full max-w-sm',
  },
})
export class ToastComponent {
  private readonly toastManager = inject(NgpToastManager);
  private readonly toastRef = inject(NgpToast);

  protected readonly context = injectToastContext<ToastContext>();

  protected readonly containerClasses = computed(() => {
    const type = this.context.type;
    return cn(
      'relative w-full py-2 px-4 rounded-xl border shadow-sm transition-all duration-300 ease-out flex items-start group',
      'backdrop-blur-sm',
      {
        'bg-green-50/90 text-green-600 border-green-200': type === 'success',
        'bg-red-50/90 text-red-600 border-red-200': type === 'error',
        'bg-white/90 text-gray-500 border-gray-200': type === 'info',
      },
    );
  });

  protected readonly titleClasses = computed(() => {
    const type = this.context.type;
    return cn('font-bold mb-1', {
      'text-green-800': type === 'success',
      'text-red-800': type === 'error',
      'text-gray-900': type === 'info',
    });
  });

  onDismiss(event: Event) {
    event.stopPropagation();
    this.toastManager.dismiss(this.toastRef);
  }
}
