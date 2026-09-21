import { Listbox, Option } from '@angular/aria/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown } from '@ng-icons/heroicons/outline';
import { AriaSelectOption, dedupeAriaOptions } from '../../../../core/models/aria.model';
import { cn } from '../../../../utils/cn';

/**
 * ARIA single-select dropdown built on `@angular/aria/listbox` rendered in a
 * `CdkConnectedOverlay`. A button serves as the trigger and displays the
 * selected option's label.
 */
@Component({
  selector: 'app-aria-select',
  imports: [Listbox, Option, CdkConnectedOverlay, CdkOverlayOrigin, NgIcon],
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

  private readonly triggerEl = viewChild<ElementRef<HTMLButtonElement>>('triggerEl');
  private readonly listboxEl = viewChild<ElementRef<HTMLUListElement>>('listboxEl');

  readonly inputId = computed(() => `${this.id()}-input`);
  readonly listboxId = computed(() => `${this.id()}-listbox`);
  readonly hintId = computed(() => `${this.id()}-hint`);
  readonly errorId = computed(() => `${this.id()}-error`);

  readonly renderOptions = computed(() => dedupeAriaOptions(this.options()));

  readonly selectedLabel = computed(() => {
    const v = this.value();
    if (v == null) return '';
    return this.options().find((o) => o.value === v)?.label ?? '';
  });

  readonly listboxValues = computed<unknown[]>(() => {
    const v = this.value();
    return v == null ? [] : [v];
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
      'peer floating-input h-14 pr-10 text-left',
      this.hasSelection() || this.isOpen() ? 'pt-6 pb-2' : '',
      this.displayError() && 'border-destructive focus:ring-destructive',
      this.disabled() && 'cursor-not-allowed opacity-50',
    ),
  );

  toggle() {
    if (this.disabled() || this.readonly()) return;
    this.isOpen.update((v) => !v);
  }

  close() {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.touched.set(true);
    queueMicrotask(() => this.triggerEl()?.nativeElement.focus());
  }

  onOverlayAttached() {
    queueMicrotask(() => this.listboxEl()?.nativeElement.focus());
  }

  onListboxValuesChange(values: unknown[]) {
    const next = (values[0] ?? null) as V | null;
    // Empty emissions are not user commits: the listbox prunes values missing
    // from the rendered options (e.g. before async options load) and explicit
    // mode re-toggles emit []. Keep the current value and stay open.
    if (next == null) return;
    if (next !== this.value()) {
      this.value.set(next);
    }
    this.close();
  }

  handleBlur() {
    this.touched.set(true);
  }
}
