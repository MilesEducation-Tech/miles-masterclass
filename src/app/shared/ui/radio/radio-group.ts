import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgpRadioGroup } from 'ng-primitives/radio';

/**
 * Bound to signal forms through `value` / `valueChange`; holds `app-radio-item`s. Start the model
 * at `null`, never `undefined`. Name it with a `ngpLabel` in an `app-field`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-radio-group',
  hostDirectives: [
    {
      directive: NgpRadioGroup,
      inputs: [
        'ngpRadioGroupValue:value',
        'ngpRadioGroupDisabled:disabled',
        'ngpRadioGroupOrientation:orientation',
      ],
      outputs: ['ngpRadioGroupValueChange:valueChange'],
    },
  ],
  host: {
    class:
      'flex flex-col gap-2 outline-none data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:flex-wrap data-disabled:opacity-50',
    '(focusout)': 'touch.emit()',
  },
  template: ` <ng-content /> `,
})
export class RadioGroup {
  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
