import { Component, computed, input, model, signal } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroCheck, heroChevronDown, heroXMark } from '@ng-icons/heroicons/outline';
import {
  NgpSelect,
  NgpSelectDropdown,
  NgpSelectOption,
  NgpSelectPortal,
} from 'ng-primitives/select';
import { AriaSelectOption, dedupeAriaOptions } from '@core/models/aria.model';
import { cn } from '../../../../utils/cn';

/**
 * Multi-select dropdown built on `ngpSelect` with `ngpSelectMultiple`.
 * Selected values render as chips.
 *
 * See `aria-select` for why the trigger is a `<div>`: the dropdown portal must
 * be a DOM descendant of the `ngpSelect` element. Here it also makes the
 * markup valid, since the chip remove controls are interactive and used to sit
 * inside a `<button>`.
 */
@Component({
  selector: 'app-aria-multiselect',
  imports: [NgpSelect, NgpSelectDropdown, NgpSelectOption, NgpSelectPortal, NgIcon],
  templateUrl: './aria-multiselect.html',
  styleUrl: './aria-multiselect.css',
  providers: [provideIcons({ heroChevronDown, heroXMark, heroCheck })],
})
export class AriaMultiselect<V = unknown> implements FormValueControl<V[]> {
  readonly id = input.required<string>();
  readonly options = input<readonly AriaSelectOption<unknown>[]>([]);
  readonly placeholder = input('');
  readonly label = input('');
  readonly hint = input('');
  readonly required = input(false);
  /** Maximum chips to display before collapsing the remainder into a "+N more" badge. 0 = unlimited. */
  readonly maxChips = input(0);
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });

  // FormValueControl
  readonly value = model<V[]>([]);
  readonly touched = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  readonly icons = signal({
    chevronDown: heroChevronDown,
    xMark: heroXMark,
    check: heroCheck,
  });

  readonly isOpen = signal(false);

  readonly inputId = computed(() => `${this.id()}-input`);
  readonly labelId = computed(() => `${this.id()}-label`);
  readonly hintId = computed(() => `${this.id()}-hint`);
  readonly errorId = computed(() => `${this.id()}-error`);

  readonly renderOptions = computed(() => dedupeAriaOptions(this.options()));

  readonly selectedValues = computed<V[]>(() => this.value() ?? []);

  readonly visibleChips = computed(() => {
    const all = this.selectedValues();
    const cap = this.maxChips();
    if (cap > 0 && all.length > cap) return all.slice(0, cap);
    return all;
  });

  readonly overflowCount = computed(() => {
    const cap = this.maxChips();
    if (cap <= 0) return 0;
    return Math.max(0, this.selectedValues().length - cap);
  });

  readonly hasSelection = computed(() => this.selectedValues().length > 0);

  readonly displayError = computed(() => this.invalid() && this.errors().length > 0);

  readonly describedBy = computed(() => {
    const parts: string[] = [];
    if (this.hint() && !this.displayError()) parts.push(this.hintId());
    if (this.displayError() && this.touched()) parts.push(this.errorId());
    return parts.length ? parts.join(' ') : null;
  });

  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));

  readonly triggerClasses = computed(() =>
    cn(
      'peer floating-input min-h-14 flex flex-wrap items-center gap-1.5 pr-10 text-left',
      this.hasSelection() || this.isOpen() ? 'pt-6 pb-2' : '',
      this.displayError() && 'border-destructive focus:ring-destructive',
      this.disabled() && 'cursor-not-allowed opacity-50',
    ),
  );

  getLabelFor(v: V): string {
    return this.options().find((o) => o.value === v)?.label ?? String(v);
  }

  protected onOpenChange(open: boolean): void {
    this.isOpen.set(open);
    if (!open) this.touched.set(true);
  }

  onListboxValuesChange(values: unknown[]) {
    // The listbox prunes values missing from the rendered options (e.g. seeded
    // selection before async options load) — those can't have been user-toggled,
    // so carry them over instead of losing them.
    const next = values as V[];
    const rendered = new Set(this.options().map((o) => o.value));
    const kept = this.value().filter((v) => !rendered.has(v) && !next.includes(v));
    this.value.set([...next, ...kept]);
  }

  removeChip(event: Event, v: V) {
    event.stopPropagation();
    this.value.update((curr) => curr.filter((x) => x !== v));
  }

  handleBlur() {
    this.touched.set(true);
  }
}
