import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheckMini, heroMinusMini } from '@ng-icons/heroicons/mini';
import { injectCheckboxState, NgpCheckbox } from 'ng-primitives/checkbox';

/**
 * Bound to signal forms through `checked` / `checkedChange`; `[formField]` also writes `disabled`
 * and `required` into the primitive. Name it with a `ngpLabel` inside an `app-field`; the
 * primitive wires `aria-labelledby` (a `<label for>` cannot toggle a non-native control).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkbox',
  hostDirectives: [
    {
      directive: NgpCheckbox,
      inputs: [
        'ngpCheckboxChecked:checked',
        'ngpCheckboxIndeterminate:indeterminate',
        'ngpCheckboxDisabled:disabled',
        'ngpCheckboxRequired:required',
      ],
      outputs: [
        'ngpCheckboxCheckedChange:checkedChange',
        'ngpCheckboxIndeterminateChange:indeterminateChange',
      ],
    },
  ],
  providers: [provideIcons({ heroCheckMini, heroMinusMini })],
  imports: [NgIcon],
  host: {
    class:
      'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-input bg-background text-sm text-primary-foreground outline-none transition-colors data-hover:bg-muted data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-offset-2 data-focus-visible:outline-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:data-touched:border-destructive',
    '(focusout)': 'touch.emit()',
  },
  template: `
    @if (state().indeterminate()) {
      <ng-icon name="heroMinusMini" aria-hidden="true" />
    } @else if (state().checked()) {
      <ng-icon name="heroCheckMini" aria-hidden="true" />
    }
  `,
})
export class Checkbox {
  protected readonly state = injectCheckboxState();

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
