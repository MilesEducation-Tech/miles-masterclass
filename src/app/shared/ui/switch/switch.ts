import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgpSwitch, NgpSwitchThumb } from 'ng-primitives/switch';

/** Bound to signal forms through `checked` / `checkedChange`. Name it with a `ngpLabel` in an `app-field`. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-switch',
  hostDirectives: [
    {
      directive: NgpSwitch,
      inputs: [
        'ngpSwitchChecked:checked',
        'ngpSwitchDisabled:disabled',
        'ngpSwitchRequired:required',
      ],
      outputs: ['ngpSwitchCheckedChange:checkedChange'],
    },
  ],
  imports: [NgpSwitchThumb],
  host: {
    class:
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border bg-secondary outline-none transition-colors data-checked:border-primary data-checked:bg-primary data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:data-touched:border-destructive',
    '(focusout)': 'touch.emit()',
  },
  template: `
    <span
      ngpSwitchThumb
      class="block size-5 translate-x-0.5 rounded-full bg-foreground shadow transition-transform data-checked:translate-x-[22px] rtl:-translate-x-0.5 rtl:data-checked:-translate-x-[22px] data-checked:bg-primary-foreground"
    ></span>
  `,
})
export class Switch {
  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
