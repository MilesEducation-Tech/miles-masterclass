import { Listbox, Option } from '@angular/aria/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon } from '@ng-icons/core';
import { heroCheck, heroChevronDown, heroEye, heroEyeSlash } from '@ng-icons/heroicons/outline';
import { SelectOption } from '../../../core/models/form.model';
import { cn } from '../../../utils/cn';

type FieldType =
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
  | 'select'
  | 'multi-select'
  | 'checkbox'
  | 'radio';

type FieldSize = 'sm' | 'default' | 'lg';

@Component({
  selector: 'app-form-field',
  imports: [NgIcon, Listbox, Option, CdkOverlayOrigin, CdkConnectedOverlay],
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
})
export class FormField implements FormValueControl<any> {
  readonly id = input.required<string>();
  readonly type = input<FieldType>('text');
  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  // Custom manual error message (if not using signal form validation)
  readonly description = input('');
  readonly required = input(false);
  readonly size = input<FieldSize>('default');
  // eslint-disable-next-line @angular-eslint/no-input-rename -- intentional class merging
  readonly userClass = input('', { alias: 'class' });

  // Specific inputs
  readonly min = input<number | undefined, unknown>(undefined, {
    transform: (v) => (v == null || v === '' ? undefined : Number(v)),
  });
  readonly max = input<number | undefined, unknown>(undefined, {
    transform: (v) => (v == null || v === '' ? undefined : Number(v)),
  });
  readonly step = input<string | number>();
  readonly rows = input(4);
  readonly options = input<SelectOption<any>[]>([]);
  readonly prefixIcon = input(false);
  readonly suffixIcon = input(false);
  readonly showPasswordToggle = input(true);

  // FormValueControl Implementation
  // Required models
  readonly value = model<any>();
  readonly touched = model<boolean>(false);

  // Required inputs from FormValueControl
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  // Internal state
  readonly passwordVisible = signal(false);

  readonly icons = signal({
    eye: heroEye,
    eyeSlash: heroEyeSlash,
    chevronDown: heroChevronDown,
    check: heroCheck,
  });

  // Helper to update value
  handleInput(newValue: any) {
    this.value.set(newValue);
  }

  readonly singleTriggerEl = viewChild<ElementRef<HTMLButtonElement>>('singleTriggerEl');
  readonly multiTriggerEl = viewChild<ElementRef<HTMLButtonElement>>('multiTriggerEl');
  readonly listboxEl = viewChild<ElementRef<HTMLUListElement>>('listboxEl');

  readonly singleSelectValues = computed<unknown[]>(() => {
    const v = this.value();
    return v == null || v === '' ? [] : [v];
  });

  readonly selectedSingleLabel = computed(
    () => this.options().find((opt) => opt.value === this.value())?.label ?? '',
  );

  readonly selectedValues = computed<unknown[]>(() => {
    const v = this.value();
    return Array.isArray(v) ? v : [];
  });

  readonly selectedLabels = computed(() => {
    const selected = new Set(this.selectedValues());
    return this.options()
      .filter((opt) => selected.has(opt.value))
      .map((opt) => opt.label)
      .join(', ');
  });

  readonly selectedPrimaryLabel = computed(() => {
    const first = this.selectedValues()[0];
    if (first === undefined) return '';
    return this.options().find((opt) => opt.value === first)?.label ?? '';
  });

  readonly selectedOverflowCount = computed(() => Math.max(0, this.selectedValues().length - 1));

  readonly isSelectOpen = signal(false);

  readonly isSingleSelectActive = computed(
    () => !!this.selectedSingleLabel() || this.isSelectOpen(),
  );
  readonly isMultiSelectActive = computed(
    () => this.selectedValues().length > 0 || this.isSelectOpen(),
  );

  toggleSelectOpen() {
    if (this.disabled()) return;
    this.isSelectOpen.update((v) => !v);
  }

  closeSelectOpen() {
    if (!this.isSelectOpen()) return;
    this.isSelectOpen.set(false);
    this.touched.set(true);
    queueMicrotask(() => {
      const trigger = this.singleTriggerEl() ?? this.multiTriggerEl();
      trigger?.nativeElement.focus();
    });
  }

  onSingleValuesChange(values: unknown[]) {
    const v = values[0];
    if (v !== undefined && v !== this.value()) {
      this.value.set(v);
    }
    this.closeSelectOpen();
  }

  handleMultiValuesChange(values: unknown[]) {
    this.value.set(values);
  }

  onOverlayAttached() {
    queueMicrotask(() => this.listboxEl()?.nativeElement.focus());
  }

  handleBlur() {
    this.touched.set(true);
  }

  readonly isChecked = computed(() => this.value() === true);
  readonly inputId = computed(() => `${this.id()}-input`);
  readonly displayError = computed(() => this.invalid() && this.errors().length > 0);

  // Classes
  readonly actualType = computed(() => {
    if (this.type() === 'password' && this.passwordVisible()) return 'text';
    return this.type();
  });
  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));
  readonly labelClasses = computed(() => 'floating-label');
  readonly checkboxLabelClasses = computed(
    () =>
      'text-sm font-normal leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ' +
      this.userClass(),
  );
  readonly inputClasses = computed(() => {
    const baseClasses = 'peer floating-input';
    const sizeClasses: Record<FieldSize, string> = {
      sm: 'h-12',
      default: 'h-14',
      lg: 'h-16',
    };
    const errorClass = this.errors().length > 0 ? 'border-destructive focus:ring-destructive' : '';
    const prefixPadding = this.prefixIcon() ? 'pl-10' : '';
    const suffixPadding =
      this.suffixIcon() || (this.type() === 'password' && this.showPasswordToggle()) ? 'pr-10' : '';

    return cn(baseClasses, sizeClasses[this.size()], errorClass, prefixPadding, suffixPadding);
  });
  readonly textareaClasses = computed(() => {
    const baseClasses = 'peer floating-input min-h-[80px] resize-y';
    return cn(
      baseClasses,
      this.errors().length > 0 ? 'border-destructive focus:ring-destructive' : '',
    );
  });
  readonly selectClasses = computed(() => {
    const baseClasses = 'peer floating-input appearance-none';
    const sizeClasses: Record<FieldSize, string> = {
      sm: 'h-12',
      default: 'h-14',
      lg: 'h-16',
    };
    return cn(
      baseClasses,
      sizeClasses[this.size()],
      this.errors().length > 0 ? 'border-destructive focus:ring-destructive' : '',
    );
  });
  readonly checkboxClasses = computed(() => {
    const baseClasses =
      'peer h-5 w-5 shrink-0 rounded border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-colors appearance-none';
    const checkedClass = this.isChecked() ? 'bg-primary border-primary' : '';
    const errorClass = this.errors().length > 0 ? 'border-destructive' : '';
    return `${baseClasses} ${checkedClass} ${errorClass}`;
  });

  togglePassword(): void {
    this.passwordVisible.update((v) => !v);
  }
}
