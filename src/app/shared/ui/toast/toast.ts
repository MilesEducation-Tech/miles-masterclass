import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { NgpButton } from 'ng-primitives/button';
import { injectToastContext, NgpToast, NgpToastManager } from 'ng-primitives/toast';
import { ToastContext, ToastType } from '@core/models/notification.model';
import { cn } from '../../utils/cn';

const TYPES: Record<ToastType, string> = {
  success: 'border-s-success',
  error: 'border-s-destructive',
  info: 'border-s-accent',
};

/**
 * What `NgpToastManager` renders for each `NotificationService` call. The stacking,
 * swipe and enter/leave rules live in `toast.css`: they are `:host[data-*]` custom-property
 * maths and keyframes that utilities cannot express.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-toast',
  imports: [NgpButton, NgIcon],
  providers: [provideIcons({ heroXMark })],
  hostDirectives: [NgpToast],
  styleUrl: './toast.css',
  host: {
    'animate.enter': 'toast-enter',
    'animate.leave': 'toast-leave',
    '[class]': 'classes()',
    '[attr.data-type]': 'context.type',
  },
  template: `
    <p class="col-start-1 row-start-1 m-0 text-sm leading-5 font-semibold select-none">
      {{ context.title }}
    </p>
    <p class="col-start-1 row-start-2 m-0 text-sm leading-5 text-muted-foreground select-none">
      {{ context.message }}
    </p>
    @if (context.closable) {
      <button
        ngpButton
        type="button"
        class="col-start-2 row-span-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none data-hover:bg-muted data-hover:text-foreground data-focus-visible:outline-2 data-focus-visible:outline-ring"
        aria-label="Dismiss notification"
        (click)="dismiss()"
      >
        <ng-icon name="heroXMark" aria-hidden="true" />
      </button>
    }
  `,
})
export class Toast {
  private readonly toastManager = inject(NgpToastManager);
  private readonly toast = inject(NgpToast);
  protected readonly context = injectToastContext<ToastContext>();

  protected readonly classes = computed(() =>
    cn(
      'absolute z-(--ngp-toast-z-index) inline-grid w-[350px] max-w-[calc(100vw-2rem)] grid-cols-[1fr_auto] grid-rows-[min-content_min-content] items-center gap-x-3 gap-y-1 rounded-lg border border-border border-s-4 bg-popover px-4 py-3 text-popover-foreground shadow-lg',
      TYPES[this.context.type],
    ),
  );

  dismiss(): void {
    this.toastManager.dismiss(this.toast);
  }
}
