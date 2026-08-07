import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { cn } from '../../../utils/cn';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.html',
  styleUrl: './otp.css',
  host: {
    '[class]': '"block w-full"',
  },
})
export class Otp implements FormValueControl<string> {
  readonly id = input.required<string>();
  readonly length = input(6);
  readonly type = input<'number' | 'text' | 'alphanumeric'>('number');
  readonly label = input('');
  readonly hint = input('');
  readonly description = input('');
  readonly required = input(false);
  readonly autoFocus = input(false);
  // eslint-disable-next-line @angular-eslint/no-input-rename -- intentional class merging
  readonly userClass = input('', { alias: 'class' });

  constructor() {
    // Focus the first digit input once the view exists in the DOM. The OTP
    // template renders `digitArray()` (>=1) inputs unconditionally, so
    // `inputs()[0]` is populated by the time `afterNextRender` fires.
    // `afterNextRender` is browser-only — SSR-safe by design.
    afterNextRender(() => {
      if (!this.autoFocus()) return;
      this.inputs()[0]?.nativeElement.focus();
    });
  }

  // FormValueControl Implementation
  readonly value = model<string>('');
  readonly touched = model<boolean>(false);

  readonly disabled = input<boolean>(false);
  readonly disabledReasons = input<readonly any[]>([]);
  readonly readonly = input<boolean>(false);
  readonly hidden = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly any[]>([]);

  // Internal state
  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('digitInput');

  readonly digitArray = computed(() => {
    return Array.from({ length: this.length() }, (_, i) => i);
  });

  readonly currentValues = computed(() => {
    const val = this.value() || '';
    return val.split('').slice(0, this.length());
  });

  readonly allowedRegex = computed(() => {
    switch (this.type()) {
      case 'number':
        return /^[0-9]$/;
      case 'alphanumeric':
        return /^[a-zA-Z0-9]$/;
      case 'text':
      default:
        return /^.$/;
    }
  });

  readonly inputMode = computed(() => {
    switch (this.type()) {
      case 'number':
        return 'tel';
      case 'alphanumeric':
      case 'text':
      default:
        return 'text';
    }
  });

  readonly validationPattern = computed(() => {
    switch (this.type()) {
      case 'number':
        return '[0-9]*';
      case 'alphanumeric':
        return '[a-zA-Z0-9]*';
      case 'text':
      default:
        return '.*';
    }
  });

  handleInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;

    if (val) {
      // Keep only the last character entered
      const char = val.slice(-1);

      // Validate based on type
      if (!this.allowedRegex().test(char)) {
        input.value = this.currentValues()[index] || '';
        return;
      }

      const currentVal = (this.value() || '').split('');

      // Pad if necessary
      while (currentVal.length < this.length()) {
        currentVal.push('');
      }

      currentVal[index] = char;
      this.value.set(currentVal.join('').slice(0, this.length()));

      // Move to next input if exists
      if (index < this.length() - 1) {
        this.focusInput(index + 1);
      }
    }
  }

  handleKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const currentVal = (this.value() || '').split('');

      if (!currentVal[index] && index > 0) {
        // If current is empty, move back and clear previous
        event.preventDefault();
        currentVal[index - 1] = '';
        this.value.set(currentVal.join(''));
        this.focusInput(index - 1);
      } else {
        // Just clear current
        currentVal[index] = '';
        this.value.set(currentVal.join(''));
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusInput(index - 1);
    } else if (event.key === 'ArrowRight' && index < this.length() - 1) {
      event.preventDefault();
      this.focusInput(index + 1);
    }
  }

  handlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';

    // Filter based on type
    let filteredChars = '';
    const regex = this.allowedRegex();
    for (const char of pastedData) {
      if (regex.test(char)) {
        filteredChars += char;
      }
    }

    const valueToSet = filteredChars.slice(0, this.length());

    if (valueToSet) {
      this.value.set(valueToSet);
      // Focus the next empty input or the last one
      const nextIndex = Math.min(valueToSet.length, this.length() - 1);
      this.focusInput(nextIndex);
    }
  }

  handleBlur(): void {
    this.touched.set(true);
  }

  private focusInput(index: number): void {
    const inputElements = this.inputs();
    if (inputElements[index]) {
      inputElements[index].nativeElement.focus();
    }
  }

  // Classes
  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));

  readonly labelClasses = computed(() => 'label');

  readonly digitInputClasses = computed(() => {
    const baseClasses =
      ' w-12 h-12 text-center text-lg font-semibold rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors';
    const errorClass = this.invalid() && this.touched() ? 'focus-visible:ring-destructive' : '';
    return cn(baseClasses, errorClass);
  });

  readonly displayError = computed(
    () => this.invalid() && this.touched() && this.errors().length > 0,
  );
}
