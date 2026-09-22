import { Component, computed, inject } from '@angular/core';
import { injectToastContext, NgpToast, NgpToastManager } from 'ng-primitives/toast';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { ToastType } from '../../../core/models/notification.model';
import { cn } from '../../../../shared/utils/cn';

/** What `NotificationService` hands each toast when it shows one. */
export interface ToastContext {
  title: string;
  message: string;
  type: ToastType;
  closable: boolean;
}

/**
 * A single toast, rendered by `NgpToastManager`.
 *
 * `NgpToast` is a host directive here because the manager instantiates this
 * component itself — there is no template to put the directive in. The
 * primitive owns stacking, placement, the auto-dismiss timer (including
 * pause-on-hover) and swipe-to-dismiss, all of which used to live in
 * `NotificationService` and the now-deleted `NotificationComponent`.
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
    class: 'block w-full',
  },
})
export class ToastComponent {
  private readonly toastManager = inject(NgpToastManager);
  private readonly toast = inject(NgpToast);

  protected readonly context = injectToastContext<ToastContext>();

  protected readonly containerClasses = computed(() =>
    cn(
      'relative w-full py-2 px-4 rounded-xl border shadow-sm transition-all duration-300 ease-out flex items-start group',
      'backdrop-blur-sm',
      {
        'bg-green-50/90 text-green-600 border-green-200': this.context.type === 'success',
        'bg-red-50/90 text-red-600 border-red-200': this.context.type === 'error',
        'bg-white/90 text-gray-500 border-gray-200': this.context.type === 'info',
      },
    ),
  );

  protected readonly titleClasses = computed(() =>
    cn('font-bold mb-1', {
      'text-green-800': this.context.type === 'success',
      'text-red-800': this.context.type === 'error',
      'text-gray-900': this.context.type === 'info',
    }),
  );

  protected onDismiss(event: Event): void {
    event.stopPropagation();
    void this.toastManager.dismiss(this.toast);
  }
}
