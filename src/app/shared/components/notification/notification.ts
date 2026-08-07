import { Component, computed, inject, signal } from '@angular/core';
import { NotificationService } from '../../core/services/notification/notification';
import { ToastPosition } from '../../core/models/notification.model';
import { ToastComponent } from '../ui/toast/toast';
import { cn } from '../../utils/cn';

@Component({
  selector: 'app-notification',
  imports: [ToastComponent],
  templateUrl: './notification.html',
  styleUrl: './notification.css',
})
export class NotificationComponent {
  private readonly notificationService = inject(NotificationService);
  protected readonly positions: ToastPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  // Map to track hover state for each position
  protected readonly isHovered = signal<Record<ToastPosition, boolean>>({
    'top-left': false,
    'top-center': false,
    'top-right': false,
    'bottom-left': false,
    'bottom-center': false,
    'bottom-right': false,
  });

  // Helper to get toasts for a position
  getToasts(position: ToastPosition) {
    return computed(() => this.notificationService.toasts().filter((t) => t.position === position));
  }

  // Pre-compute signals for each position to avoid re-creating computeds in template
  protected readonly positionToasts = {
    'top-left': this.getToasts('top-left'),
    'top-center': this.getToasts('top-center'),
    'top-right': this.getToasts('top-right'),
    'bottom-left': this.getToasts('bottom-left'),
    'bottom-center': this.getToasts('bottom-center'),
    'bottom-right': this.getToasts('bottom-right'),
  };

  getContainerClasses(position: ToastPosition): string {
    return cn('fixed z-[9999] flex flex-col w-full max-w-sm m-4 gap-2', {
      'top-0 left-0 items-start': position === 'top-left',
      'top-0 left-1/2 -translate-x-1/2 items-center': position === 'top-center',
      'top-0 right-0 items-end': position === 'top-right',
      'bottom-0 left-0 items-start flex-col-reverse': position === 'bottom-left',
      'bottom-0 left-1/2 -translate-x-1/2 items-center flex-col-reverse':
        position === 'bottom-center',
      'bottom-0 right-0 items-end flex-col-reverse': position === 'bottom-right',
    });
  }

  onMouseEnter(position: ToastPosition) {
    this.isHovered.update((s) => ({ ...s, [position]: true }));
  }

  onMouseLeave(position: ToastPosition) {
    this.isHovered.update((s) => ({ ...s, [position]: false }));
  }

  remove(id: string) {
    this.notificationService.remove(id);
  }

  pauseTimer(id: string) {
    this.notificationService.pauseTimer(id);
  }

  resumeTimer(id: string) {
    this.notificationService.resumeTimer(id);
  }
}
