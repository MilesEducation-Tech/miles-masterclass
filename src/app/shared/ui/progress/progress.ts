import { Component, computed, input } from '@angular/core';
import { NgpProgress, NgpProgressIndicator } from 'ng-primitives/progress';
import { cn } from '../../utils/cn';

/** Available progress bar variants */
export type ProgressVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

/** Available progress bar sizes */
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

/** Available label positions */
export type LabelPosition = 'none' | 'right' | 'inside' | 'top';

/**
 * A flexible, accessible progress bar component with multiple variants,
 * sizes, and label options.
 *
 * @example
 * ```html
 * <app-progress [value]="75" variant="success" size="md" label="right" />
 * <app-progress [value]="50" variant="info" [showLabel]="false" />
 * <app-progress [value]="100" variant="success" label="inside" />
 * ```
 */
@Component({
  selector: 'app-progress',
  imports: [NgpProgress, NgpProgressIndicator],
  template: `
    @if (label() === 'top') {
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm font-medium text-foreground">{{ labelText() || 'Progress' }}</span>
        <span class="text-sm text-muted-foreground">{{ displayValue() }}%</span>
      </div>
    }
    <div class="flex items-center gap-2" [class]="containerClass()">
      <!-- ngpProgress owns role="progressbar" and the aria-value* trio, and
           reflects data-progressing / data-indeterminate / data-complete. A
           null value is what puts it in the indeterminate state. -->
      <div
        ngpProgress
        class="relative flex-1 overflow-hidden rounded-full"
        [class]="trackClass()"
        [ngpProgressValue]="indeterminate() ? null : clampedValue()"
        [attr.aria-label]="ariaLabel() || labelText() || 'Progress'"
      >
        @if (indeterminate()) {
          <div
            ngpProgressIndicator
            class="progress-indeterminate h-full w-2/5 rounded-full"
            [class]="fillClass()"
          ></div>
        } @else {
          <div
            ngpProgressIndicator
            class="flex h-full items-center justify-end rounded-full pr-2 transition-[width] duration-500 ease-out"
            [class]="fillClass()"
            [style.width.%]="clampedValue()"
          >
            @if (label() === 'inside' && clampedValue() > 15) {
              <span class="text-xs font-semibold text-white drop-shadow-sm"
                >{{ displayValue() }}%</span
              >
            }
          </div>
        }
        @if (striped() && !indeterminate()) {
          <div
            class="pointer-events-none absolute inset-0 bg-size-[1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)]"
            [class.animate-stripes]="animated()"
          ></div>
        }
      </div>
      @if (label() === 'right') {
        <span class="text-sm font-medium text-foreground whitespace-nowrap min-w-[3rem] text-right">
          {{ displayValue() }}%
        </span>
      }
    </div>
  `,
  host: { class: 'block w-full' },
  // Only what utilities can't carry: the two keyframe animations. They stay in
  // the component (not `@theme`) because Angular scopes keyframe names to the
  // component, so the `animation` rules have to sit next to them.
  styles: `
    .animate-stripes {
      animation: progress-stripes 1s linear infinite;
    }

    @keyframes progress-stripes {
      from {
        background-position: 1rem 0;
      }
      to {
        background-position: 0 0;
      }
    }

    .progress-indeterminate {
      animation: indeterminate-slide 1.5s ease-in-out infinite;
    }

    @keyframes indeterminate-slide {
      0% {
        transform: translateX(-100%);
      }
      50% {
        transform: translateX(150%);
      }
      100% {
        transform: translateX(250%);
      }
    }
  `,
})
export class Progress {
  /** Current progress value (0-100) */
  readonly value = input<number>(0);

  /** Visual variant of the progress bar */
  readonly variant = input<ProgressVariant>('default');

  /** Size of the progress bar */
  readonly size = input<ProgressSize>('sm');

  /** Label position */
  readonly label = input<LabelPosition>('none');

  /** Custom label text (used with 'top' position) */
  readonly labelText = input<string>('');

  /** Whether to show striped pattern */
  readonly striped = input<boolean>(false);

  /** Whether stripes should animate */
  readonly animated = input<boolean>(false);

  /** Custom aria-label for accessibility */
  readonly ariaLabel = input<string>('');

  /** Indeterminate state (shows animation instead of value) */
  readonly indeterminate = input<boolean>(false);

  /** Clamped value between 0 and 100 */
  protected readonly clampedValue = computed(() => {
    const val = this.value();
    return Math.max(0, Math.min(100, val));
  });

  /** Formatted display value */
  protected readonly displayValue = computed(() => {
    return Math.round(this.clampedValue());
  });

  /** Container classes */
  protected readonly containerClass = computed(() => {
    return this.label() === 'right' ? 'w-full' : '';
  });

  /** Track classes: height by size; the determinate track sits on `bg-muted`. */
  protected readonly trackClass = computed(() => {
    const sizeMap: Record<ProgressSize, string> = {
      xs: 'h-1',
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4',
    };
    return cn(sizeMap[this.size()], this.indeterminate() ? 'bg-white/20' : 'bg-muted');
  });

  /** Fill classes based on variant */
  protected readonly fillClass = computed(() => {
    const variantMap: Record<ProgressVariant, string> = {
      default: 'bg-primary',
      success: 'bg-green-500',
      warning: 'bg-amber-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
    };
    return variantMap[this.variant()];
  });
}
