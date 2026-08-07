import { Component, computed, input, output } from '@angular/core';
import { Toast } from '../../../core/models/notification.model';
import { cn } from '../../../../shared/utils/cn';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-toast',
  imports: [NgIconComponent],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  providers: [provideIcons({ heroXMark })],
})
export class ToastComponent {
  readonly toast = input.required<Toast>();
  readonly style = input<Record<string, any>>();
  readonly dismiss = output<string>();
  readonly pause = output<string>();
  readonly resume = output<string>();

  onMouseEnter() {
    this.pause.emit(this.toast().id);
  }

  onMouseLeave() {
    this.resume.emit(this.toast().id);
  }

  protected readonly containerClasses = computed(() => {
    const type = this.toast().type;
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
    const type = this.toast().type;
    return cn('font-bold mb-1', {
      'text-green-800': type === 'success',
      'text-red-800': type === 'error',
      'text-gray-900': type === 'info',
    });
  });

  onDismiss(event: Event) {
    event.stopPropagation();
    this.dismiss.emit(this.toast().id);
  }
}
