import { NumberInput } from '@angular/cdk/coercion';
import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';
import {
  NgpMeter,
  NgpMeterIndicator,
  NgpMeterLabel,
  NgpMeterTrack,
  NgpMeterValue,
} from 'ng-primitives/meter';

/** A static measurement (a level, a score), as opposed to `app-progress` for a running task. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-meter',
  hostDirectives: [
    { directive: NgpMeter, inputs: ['ngpMeterValue:value', 'ngpMeterMin:min', 'ngpMeterMax:max'] },
  ],
  imports: [NgpMeterIndicator, NgpMeterLabel, NgpMeterValue, NgpMeterTrack],
  host: { class: 'flex w-full flex-wrap items-center gap-x-2 gap-y-1' },
  template: `
    <span ngpMeterLabel class="text-sm font-medium text-foreground">{{ label() }}</span>
    <span ngpMeterValue class="ml-auto text-xs text-muted-foreground">{{ value() }}%</span>

    <div ngpMeterTrack class="h-2 w-full basis-full overflow-hidden rounded-full bg-secondary">
      <div
        ngpMeterIndicator
        class="h-full rounded-full bg-success transition-[width] motion-reduce:transition-none"
      ></div>
    </div>
  `,
})
export class Meter {
  /** The value of the meter. */
  readonly value = input<number, NumberInput>(0, {
    transform: numberAttribute,
  });

  /** The label of the meter. */
  readonly label = input.required<string>();
}
