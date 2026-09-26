import { NgpListbox, NgpListboxOption } from 'ng-primitives/listbox';
import { Component, computed, input, output } from '@angular/core';

export interface CheckboxListOption {
  value: string | number;
  label: string;
}

/**
 * Multi-select list built on `ngpListbox` in `multiple` mode. Each option
 * renders a check glyph driven by the primitive's `data-selected` attribute.
 *
 * `aria-selected` is bound by hand from the option directive's `selected()`
 * signal: unlike `@angular/aria`, `NgpListbox` exposes selection only as a
 * `data-*` attribute, and a `role="option"` with no `aria-selected` leaves
 * screen-reader users unable to tell what is checked.
 */
@Component({
  selector: 'app-checkbox-list',
  imports: [NgpListbox, NgpListboxOption],
  templateUrl: './checkbox-list.html',
})
export class CheckboxList {
  readonly options = input.required<readonly CheckboxListOption[]>();
  readonly selected = input.required<readonly (string | number)[]>();
  readonly selectionChange = output<readonly (string | number)[]>();

  /**
   * Callers pass a `readonly` array; hand the listbox a fresh mutable copy so
   * the type checker is happy and it can't mutate caller-owned state.
   */
  readonly mutableSelected = computed<(string | number)[]>(() => [...this.selected()]);

  onValuesChange(values: (string | number)[]) {
    this.selectionChange.emit(values);
  }
}
