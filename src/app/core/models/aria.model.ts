/**
 * Shared types for the ARIA-primitive component library
 * under `src/app/shared/ui/aria/`.
 */

export type AriaInputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'textarea'
  | 'checkbox'
  | 'radio';

export type AriaInputSize = 'sm' | 'default' | 'lg';

export interface AriaTreeNode<V = unknown> {
  value: V;
  label: string;
  disabled?: boolean;
  children?: AriaTreeNode<V>[];
}

/**
 * Structural option type accepted by `app-aria-autocomplete`, `app-aria-combobox`,
 * `app-aria-select`, and `app-aria-multiselect`. Compatible with both
 * `SelectOption` (value: string) and `AutoCompleteOption<T>` (value: T).
 */
export interface AriaSelectOption<V = unknown> {
  value: V;
  label: string;
  disabled?: boolean;
}

/**
 * Drop options with duplicate values (first occurrence wins). `ngListbox`
 * requires unique option values, and `@for (... track option.value)` throws
 * NG0955 on duplicate track keys.
 */
export function dedupeAriaOptions<T extends AriaSelectOption<unknown>>(
  options: readonly T[],
): readonly T[] {
  const seen = new Set<unknown>();
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
}
