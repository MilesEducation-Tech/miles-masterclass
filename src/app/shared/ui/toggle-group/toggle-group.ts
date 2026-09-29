import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgpFormControl } from 'ng-primitives/form-field';
import { NgpToggleGroup } from 'ng-primitives/toggle-group';

/**
 * Bound to signal forms through `value` / `valueChange` (a `string[]`, also for `type="single"`);
 * holds `button[app-toggle-group-item]`s. `NgpFormControl` adds the field's `aria-*` / `data-*`
 * state the primitive does not set itself. Name it with a `ngpLabel` in an `app-field`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-toggle-group',
  hostDirectives: [
    {
      directive: NgpToggleGroup,
      inputs: [
        'ngpToggleGroupOrientation:orientation',
        'ngpToggleGroupType:type',
        'ngpToggleGroupValue:value',
        'ngpToggleGroupDisabled:disabled',
      ],
      outputs: ['ngpToggleGroupValueChange:valueChange'],
    },
    NgpFormControl,
  ],
  host: {
    class:
      'inline-flex gap-1 rounded-lg border border-border bg-background p-1 outline-none data-[orientation=vertical]:flex-col data-disabled:opacity-50 data-invalid:data-touched:border-destructive',
    '(focusout)': 'touch.emit()',
  },
  template: ` <ng-content /> `,
})
export class ToggleGroup {
  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
