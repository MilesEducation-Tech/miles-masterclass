import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { NgpButton } from 'ng-primitives/button';
import { NgpFormControl } from 'ng-primitives/form-field';
import { NgpToggle } from 'ng-primitives/toggle';

/**
 * A pressed/unpressed button. The primitive's `selected` pair is exposed as `checked` /
 * `checkedChange`, which is what `[formField]` looks for on a boolean control; `NgpFormControl`
 * adds the field's `aria-*` and `data-*` state the toggle primitive does not set itself.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'button[app-toggle]',
  hostDirectives: [
    {
      directive: NgpToggle,
      inputs: ['ngpToggleSelected:checked', 'ngpToggleDisabled:disabled'],
      outputs: ['ngpToggleSelectedChange:checkedChange'],
    },
    { directive: NgpButton, inputs: ['disabled'] },
    NgpFormControl,
  ],
  host: {
    class:
      'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-foreground outline-none transition-colors data-hover:bg-muted data-press:bg-secondary data-selected:border-primary data-selected:bg-primary data-selected:text-primary-foreground data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-offset-2 data-focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-invalid:data-touched:border-destructive',
    '(focusout)': 'touch.emit()',
  },
  template: ` <ng-content /> `,
})
export class Toggle {
  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();
}
