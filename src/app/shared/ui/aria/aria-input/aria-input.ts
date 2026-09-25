import { Component, computed, input, model, signal } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { NgpCheckbox } from 'ng-primitives/checkbox';
import { NgpDescription, NgpFormField, NgpLabel } from 'ng-primitives/form-field';
import { NgpRadioGroup, NgpRadioIndicator, NgpRadioItem } from 'ng-primitives/radio';
import { heroCheck, heroEye, heroEyeSlash } from '@ng-icons/heroicons/outline';
import { AriaInputSize, AriaInputType } from '@core/models/aria.model';
import { cn } from '../../../utils/cn';

/** Structural option type — accepts both `SelectOption` and `AutoCompleteOption`. */
interface AriaInputOption {
  value: unknown;
  label: string;
  disabled?: boolean;
}

/**
 * Drop-in primitive input wrapping a native `<input>` / `<textarea>` with the
 * project's floating-label styling. Supports text, email, password, number,
 * tel, url, search, date, time, datetime-local, textarea, checkbox, radio —
 * the last two are ng-primitives (`ngpCheckbox`, `ngpRadioGroup`), not native inputs.
 * For combobox-style selection use `app-aria-select` / `app-aria-multiselect`.
 */
@Component({
  selector: 'app-aria-input',
  imports: [
    NgIcon,
    NgpCheckbox,
    NgpDescription,
    NgpFormField,
    NgpLabel,
    NgpRadioGroup,
    NgpRadioIndicator,
    NgpRadioItem,
  ],
  templateUrl: './aria-input.html',
  styleUrl: './aria-input.css',
  providers: [provideIcons({ heroCheck, heroEye, heroEyeSlash })],
})
export class AriaInput implements FormValueControl<any> {
  readonly id = input.required<string>();
  readonly type = input<AriaInputType>('text');
  readonly label = input('');
  readonly placeholder = input('');
  readonly hint = input('');
  readonly description = input('');
  readonly required = input(false);
  readonly size = input<AriaInputSize>('default');

  readonly min = input<number | undefined, unknown>(undefined, {
    transform: (v) => (v == null || v === '' ? undefined : Number(v)),
  });
  readonly max = input<number | undefined, unknown>(undefined, {
    transform: (v) => (v == null || v === '' ? undefined : Number(v)),
  });
  readonly step = input<string | number>();
  readonly rows = input(4);
  readonly options = input<readonly AriaInputOption[]>([]);
  readonly prefixIcon = input(false);
  readonly suffixIcon = input(false);
  readonly showPasswordToggle = input(true);
  readonly autocomplete = input<string>('off');
  /** When true, non-digit characters are stripped at keystroke level (phone fields). */
  readonly numericOnly = input(false);

  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly userClass = input('', { alias: 'class' });

  // FormValueControl contract
  readonly value = model<unknown>();
  readonly touched = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  readonly icons = signal({ check: heroCheck, eye: heroEye, eyeSlash: heroEyeSlash });

  readonly passwordVisible = signal(false);

  readonly actualType = computed(() => {
    if (this.type() === 'password' && this.passwordVisible()) return 'text';
    return this.type();
  });

  readonly inputId = computed(() => `${this.id()}-input`);
  readonly hintId = computed(() => `${this.id()}-hint`);
  readonly errorId = computed(() => `${this.id()}-error`);
  readonly groupLabelId = computed(() => `${this.id()}-group-label`);

  readonly isChecked = computed(() => this.value() === true);
  readonly displayError = computed(() => this.invalid() && this.errors().length > 0);

  /**
   * aria-invalid for the ng-primitives controls. ngpFormControl also writes this attribute
   * (invalid AND touched, else removed), so it must compute the same thing or whichever
   * binding ran last would win.
   */
  readonly primitiveAriaInvalid = computed(() => (this.invalid() && this.touched()) || null);

  readonly describedBy = computed(() => {
    const parts: string[] = [];
    if (this.hint() && !this.displayError()) parts.push(this.hintId());
    if (this.displayError() && this.touched()) parts.push(this.errorId());
    return parts.length ? parts.join(' ') : null;
  });

  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));

  readonly inputClasses = computed(() => {
    const sizes: Record<AriaInputSize, string> = {
      sm: 'h-12',
      default: 'h-14',
      lg: 'h-16',
    };
    const prefixPad = this.prefixIcon() ? 'pl-10' : '';
    const suffixPad =
      this.suffixIcon() || (this.type() === 'password' && this.showPasswordToggle()) ? 'pr-10' : '';
    return cn(
      'peer floating-input',
      sizes[this.size()],
      prefixPad,
      suffixPad,
      this.displayError() && 'border-destructive focus:ring-destructive',
    );
  });

  readonly textareaClasses = computed(() =>
    cn(
      'peer floating-input min-h-[80px] resize-y',
      this.displayError() && 'border-destructive focus:ring-destructive',
    ),
  );

  readonly checkboxLabelClasses = computed(() =>
    cn(
      'text-sm font-normal leading-none cursor-pointer',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      this.userClass(),
    ),
  );

  readonly checkboxClasses = computed(() =>
    cn(
      'peer inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-input bg-background ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-colors',
      'data-[checked]:bg-primary data-[checked]:border-accent',
      this.displayError() && 'border-accent',
    ),
  );

  handleInput(newValue: unknown) {
    this.value.set(newValue);
  }

  /**
   * Numeric-only path: strip every non-digit and reflect the cleaned value back
   * onto the DOM element. Reflecting is required because when the sanitized
   * result equals the current signal value the binding won't re-render, leaving
   * the rejected character visible (same fix the OTP component uses).
   */
  handleNumericInput(event: Event) {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '');
    if (el.value !== digits) el.value = digits;
    this.value.set(digits);
  }

  handleBlur() {
    this.touched.set(true);
  }

  togglePassword(): void {
    this.passwordVisible.update((v) => !v);
  }
}
