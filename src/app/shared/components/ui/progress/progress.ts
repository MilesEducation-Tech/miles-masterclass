import { Component, computed, input } from '@angular/core';

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
  template: `
    @if (label() === 'top') {
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm font-medium text-foreground">{{ labelText() || 'Progress' }}</span>
        <span class="text-sm text-muted-foreground">{{ displayValue() }}%</span>
      </div>
    }
    <div class="flex items-center gap-2" [class]="containerClass()">
      <div
        class="progress-track"
        [class]="trackClass()"
        [class.track-determinate]="!indeterminate()"
        role="progressbar"
        [attr.aria-valuenow]="clampedValue()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="100"
        [attr.aria-label]="ariaLabel() || labelText() || 'Progress'"
      >
        @if (indeterminate()) {
          <div class="progress-indeterminate" [class]="fillClass()"></div>
        } @else {
          <div class="progress-fill" [class]="fillClass()" [style.width.%]="clampedValue()">
            @if (label() === 'inside' && clampedValue() > 15) {
              <span class="progress-label-inside">{{ displayValue() }}%</span>
            }
          </div>
        }
        @if (striped() && !indeterminate()) {
          <div class="progress-stripes" [class.animate-stripes]="animated()"></div>
        }
      </div>
      @if (label() === 'right') {
        <span class="text-sm font-medium text-foreground whitespace-nowrap min-w-[3rem] text-right">
          {{ displayValue() }}%
        </span>
      }
    </div>
  `,
  styles: `
    @reference '../../../../../styles/styles.css';

    :host {
      @apply block w-full;
    }

    .progress-track {
      @apply relative flex-1 overflow-hidden rounded-full;
      background-color: rgba(255, 255, 255, 0.2);
    }

    .progress-track.track-determinate {
      @apply bg-muted;
    }

    /* Sizes */
    .track-xs {
      @apply h-1;
    }
    .track-sm {
      @apply h-2;
    }
    .track-md {
      @apply h-3;
    }
    .track-lg {
      @apply h-4;
    }

    .progress-fill {
      @apply h-full rounded-full flex items-center justify-end pr-2;
      @apply transition-[width] duration-500 ease-out;
    }

    .progress-label-inside {
      @apply text-xs font-semibold text-white drop-shadow-sm;
    }

    /* Variants */
    .fill-default {
      @apply bg-primary;
    }
    .fill-success {
      @apply bg-green-500;
    }
    .fill-warning {
      @apply bg-amber-500;
    }
    .fill-error {
      @apply bg-red-500;
    }
    .fill-info {
      @apply bg-blue-500;
    }

    /* Striped pattern */
    .progress-stripes {
      @apply absolute inset-0 pointer-events-none;
      background-image: linear-gradient(
        45deg,
        rgba(255, 255, 255, 0.15) 25%,
        transparent 25%,
        transparent 50%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 255, 255, 0.15) 75%,
        transparent 75%,
        transparent
      );
      background-size: 1rem 1rem;
    }

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

    /* Indeterminate loading animation */
    .progress-indeterminate {
      @apply h-full rounded-full;
      width: 40%;
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

  /** Track classes based on size */
  protected readonly trackClass = computed(() => {
    const sizeMap: Record<ProgressSize, string> = {
      xs: 'track-xs',
      sm: 'track-sm',
      md: 'track-md',
      lg: 'track-lg',
    };
    return sizeMap[this.size()];
  });

  /** Fill classes based on variant */
  protected readonly fillClass = computed(() => {
    const variantMap: Record<ProgressVariant, string> = {
      default: 'fill-default',
      success: 'fill-success',
      warning: 'fill-warning',
      error: 'fill-error',
      info: 'fill-info',
    };
    return variantMap[this.variant()];
  });
}
