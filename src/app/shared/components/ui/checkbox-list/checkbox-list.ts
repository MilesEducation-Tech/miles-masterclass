import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input, output } from '@angular/core';

export interface CheckboxListOption {
  value: string | number;
  label: string;
}

/**
 * Multi-select list built on `@angular/aria/listbox` with `multi="true"`.
 * Each option renders a check glyph driven by `aria-selected`.
 */
@Component({
  selector: 'app-checkbox-list',
  imports: [Listbox, Option],
  templateUrl: './checkbox-list.html',
  styleUrl: './checkbox-list.css',
})
export class CheckboxList {
  readonly options = input.required<readonly CheckboxListOption[]>();
  readonly selected = input.required<readonly (string | number)[]>();
  readonly selectionChange = output<readonly (string | number)[]>();

  /**
   * `ngListbox.values` is a `ModelSignal<V[]>` (mutable). Callers pass a
   * `readonly` array; we expose a fresh mutable copy here so the type checker
   * is happy and the listbox can't accidentally mutate caller-owned state.
   */
  readonly mutableSelected = computed<(string | number)[]>(() => [...this.selected()]);

  onValuesChange(values: (string | number)[]) {
    this.selectionChange.emit(values);
  }
}
