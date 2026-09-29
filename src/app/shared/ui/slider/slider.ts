import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  injectSliderState,
  NgpSlider,
  NgpSliderRange,
  NgpSliderThumb,
  NgpSliderTrack,
} from 'ng-primitives/slider';

/**
 * Bound to signal forms through `value` / `valueChange` (a number; start the model at a number).
 * Give it a width; the thumb is the focusable, keyboard-driven element and carries `ariaLabel`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-slider',
  hostDirectives: [
    {
      directive: NgpSlider,
      inputs: [
        'ngpSliderValue:value',
        'ngpSliderMin:min',
        'ngpSliderMax:max',
        'ngpSliderStep:step',
        'ngpSliderDisabled:disabled',
      ],
      outputs: ['ngpSliderValueChange:valueChange'],
    },
  ],
  imports: [NgpSliderTrack, NgpSliderRange, NgpSliderThumb],
  host: {
    class:
      'relative flex h-5 w-full touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
    '(focusout)': 'touch.emit()',
  },
  template: `
    <div
      ngpSliderTrack
      class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary"
    >
      <div ngpSliderRange class="absolute h-full rounded-full bg-primary"></div>
    </div>
    <div
      ngpSliderThumb
      class="absolute block size-5 -translate-x-1/2 rounded-full border border-primary bg-foreground shadow outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring"
      [ariaLabel]="ariaLabel()"
      [attr.aria-disabled]="state().disabled() || null"
    ></div>
  `,
})
export class Slider {
  protected readonly state = injectSliderState();

  /** The accessible name of the thumb, since the host is not the focusable element. */
  readonly ariaLabel = input<string | null>(null);

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
