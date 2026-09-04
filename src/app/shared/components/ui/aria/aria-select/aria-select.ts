import { Component, computed, input, model, signal } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { NgpDescription, NgpFormField, NgpLabel } from 'ng-primitives/form-field';
import {
  NgpSelect,
  NgpSelectDropdown,
  NgpSelectOption,
  NgpSelectPortal,
} from 'ng-primitives/select';
import { AriaSelectOption, dedupeAriaOptions } from '../../../../core/models/aria.model';
import { cn } from '../../../../utils/cn';

/**
 * Single-select dropdown built on the `NgpSelect` primitive. The primitive owns
 * the trigger/listbox ARIA wiring, keyboard navigation, typeahead and the
 * floating dropdown, so this component only supplies the project's
 * floating-label styling and the signal-forms `FormValueControl` contract.
 */
@Component({
  selector: 'app-aria-select',
  imports: [
    NgpSelect,
    NgpSelectDropdown,
    NgpSelectOption,
    NgpSelectPortal,
    NgpFormField,
    NgpLabel,
    NgpDescription,
    NgIcon,
  ],
  templateUrl: './aria-select.html',
  styleUrl: './aria-select.css',
  providers: [provideIcons({ heroChevronDown })],
})
export class AriaSelect<V = unknown> implements FormValueControl<V | null> {
  readonly id = input.required<string>();
  readonly options = input<readonly AriaSelectOption<unknown>[]>([]);
  readonly placeholder = input('');
  readonly label = input('');
  readonly hint = input('');
  readonly required = input(false);
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });

  // FormValueControl
  readonly value = model<V | null>(null);
  readonly touched = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  readonly icons = signal({ chevronDown: heroChevronDown });

  readonly isOpen = signal(false);

  readonly inputId = computed(() => `${this.id()}-input`);
  readonly hintId = computed(() => `${this.id()}-hint`);
  readonly errorId = computed(() => `${this.id()}-error`);

  readonly renderOptions = computed(() => dedupeAriaOptions(this.options()));

  readonly selectedLabel = computed(() => {
    const v = this.value();
    if (v == null) return '';
    return this.options().find((o) => o.value === v)?.label ?? '';
  });

  readonly displayError = computed(() => this.invalid() && this.errors().length > 0);

  readonly describedBy = computed(() => {
    const parts: string[] = [];
    if (this.hint() && !this.displayError()) parts.push(this.hintId());
    if (this.displayError() && this.touched()) parts.push(this.errorId());
    return parts.length ? parts.join(' ') : null;
  });

  readonly hasSelection = computed(() => this.value() != null);

  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));

  readonly triggerClasses = computed(() =>
    cn(
      'peer floating-input h-14 pr-10 text-left flex items-center',
      this.hasSelection() || this.isOpen() ? 'pt-6 pb-2' : '',
      this.displayError() && 'border-destructive focus:ring-destructive',
      this.disabled() && 'cursor-not-allowed opacity-50',
    ),
  );

  onValueChange(next: unknown) {
    // The primitive prunes values missing from the rendered options (e.g. before
    // async options load), which surfaces as a null emission that is not a user
    // commit — keep the current value in that case.
    if (next == null) return;
    if (next !== this.value()) {
      this.value.set(next as V);
    }
  }

  onOpenChange(open: boolean) {
    this.isOpen.set(open);
    // Closing the dropdown is the point the field has been interacted with.
    if (!open) this.touched.set(true);
  }

  handleBlur() {
    this.touched.set(true);
  }
}
