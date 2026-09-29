import { BooleanInput } from '@angular/cdk/coercion';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { NgpSelectionMode } from 'ng-primitives/common';
import { NgpFormControl } from 'ng-primitives/form-field';
import { NgpListbox, provideListboxState } from 'ng-primitives/listbox';

/**
 * An always-open list of `app-listbox-option`s, bound to signal forms through its own `value`
 * model (always an array; start the model at `[]`). The inner `role="listbox"` element carries
 * `ngpFormControl`, so the field's name, description and validity land on the element assistive
 * technology reads. Name it with a `ngpLabel` in an `app-field`, or pass `ariaLabel`.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listbox',
  providers: [
    // Hoisted so the projected `app-listbox-option`s can find the listbox state.
    provideListboxState(),
  ],
  imports: [NgpListbox, NgpFormControl],
  host: {
    class:
      'block rounded-xl border border-border bg-popover p-1 text-popover-foreground has-[[role=listbox][data-disabled]]:cursor-not-allowed has-[[role=listbox][data-disabled]]:opacity-50 has-[[role=listbox][data-invalid][data-touched]]:border-destructive',
    '(focusout)': 'touch.emit()',
  },
  template: `
    <div
      ngpListbox
      ngpFormControl
      class="flex max-h-60 flex-col gap-0.5 overflow-y-auto outline-none data-focus-visible:outline-2 data-focus-visible:outline-ring"
      [ngpListboxMode]="mode()"
      [ngpListboxDisabled]="disabled()"
      [ngpListboxCompareWith]="compareWith()"
      [ngpListboxValue]="listValue()"
      [attr.aria-label]="ariaLabel() || null"
      (ngpListboxValueChange)="value.set($event)"
    >
      <ng-content />
    </div>
  `,
})
export class Listbox<V = string> {
  /** `single` or `multiple`; the value is a `string[]` either way. */
  readonly mode = input<NgpSelectionMode>('single');

  /** The selected values. */
  readonly value = model<readonly V[]>([]);

  /** The disabled state; `[formField]` writes it too. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });

  /** The comparator function to use when comparing values. */
  readonly compareWith = input<(a: V, b: V) => boolean>((a, b) => a === b);

  /** The accessible name of the list when it is not inside an `app-field`. */
  readonly ariaLabel = input<string>('');

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();

  /** The primitive wants a mutable array; a fresh copy only when the value changes. */
  protected readonly listValue = computed(() => [...this.value()]);
}
