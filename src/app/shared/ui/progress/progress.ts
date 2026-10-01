import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  NgpProgress,
  NgpProgressIndicator,
  NgpProgressLabel,
  NgpProgressTrack,
  NgpProgressValue,
} from 'ng-primitives/progress';
import { cn } from '../../utils/cn';

const SIZES = { sm: 'h-1', md: 'h-2' } as const;
const VARIANTS = { primary: 'bg-primary', success: 'bg-success' } as const;

/**
 * Progress of a running task. `value` `null` is indeterminate (the primitive drops
 * `aria-valuenow` and the bar pulses). A visible `label` names the bar; a bare bar takes
 * `ariaLabel` instead.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-progress',
  hostDirectives: [
    {
      directive: NgpProgress,
      inputs: ['ngpProgressValue:value', 'ngpProgressMax:max', 'ngpProgressValueLabel:valueLabel'],
    },
  ],
  imports: [NgpProgressIndicator, NgpProgressTrack, NgpProgressLabel, NgpProgressValue],
  host: {
    class: 'group flex w-full flex-wrap items-center gap-x-2 gap-y-1',
    '[attr.aria-label]': 'label() ? null : ariaLabel()',
  },
  template: `
    @if (label(); as label) {
      <span ngpProgressLabel class="text-sm font-medium text-foreground">{{ label }}</span>
      <span ngpProgressValue class="ms-auto text-xs text-muted-foreground">{{ value() }}%</span>
    }

    <div ngpProgressTrack [class]="trackClass()">
      <div ngpProgressIndicator [class]="indicatorClass()"></div>
    </div>
  `,
})
export class Progress {
  /** The value of the progress; `null` while the amount of work is unknown. */
  readonly value = input<number | null>(0);

  /** A visible label; omit it and pass `ariaLabel` for a bare bar. */
  readonly label = input<string>();

  /** The accessible name of a bar without a visible label. */
  readonly ariaLabel = input<string>();

  readonly size = input<keyof typeof SIZES>('md');

  readonly variant = input<keyof typeof VARIANTS>('primary');

  protected readonly trackClass = computed(() =>
    cn('w-full basis-full overflow-hidden rounded-full bg-secondary', SIZES[this.size()]),
  );

  protected readonly indicatorClass = computed(() =>
    cn(
      'h-full rounded-full transition-[width] group-data-indeterminate:w-full group-data-indeterminate:animate-pulse motion-reduce:transition-none motion-reduce:group-data-indeterminate:animate-none',
      VARIANTS[this.variant()],
    ),
  );
}
