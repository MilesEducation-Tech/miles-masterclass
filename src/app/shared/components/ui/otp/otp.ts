import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { NgpInputOtp, NgpInputOtpInput, NgpInputOtpSlot } from 'ng-primitives/input-otp';
import { cn } from '../../../utils/cn';

/**
 * OTP entry built on `ngpInputOtp`.
 *
 * The primitive replaces what used to be one `<input>` per digit plus ~180
 * lines of input/keydown/paste/focus juggling: it renders a single hidden
 * input (`autocomplete="one-time-code"`, so browser autofill and screen
 * readers work) and drives presentational slots that expose `data-filled`,
 * `data-active`, `data-caret` and `data-placeholder`.
 *
 * The public API is unchanged, so the login, webinar-registration and faculty
 * forms keep binding `[formField]`, `[length]`, `[autoFocus]` as before.
 */
@Component({
  selector: 'app-otp',
  imports: [NgpInputOtp, NgpInputOtpInput, NgpInputOtpSlot],
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
  /** Character shown in an empty slot. */
  readonly placeholder = input('');
  // eslint-disable-next-line @angular-eslint/no-input-rename -- intentional class merging
  readonly userClass = input('', { alias: 'class' });

  /** The single hidden input the primitive drives; target for `autoFocus`. */
  private readonly otpInput = viewChild<ElementRef<HTMLInputElement>>('otpInput');

  constructor() {
    // `afterNextRender` is browser-only, so this is SSR-safe by design.
    afterNextRender(() => {
      if (!this.autoFocus()) return;
      this.otpInput()?.nativeElement.focus();
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

  /**
   * `NgpInputOtp` has no readonly mode, so a readonly control is disabled —
   * both refuse input, they only differ in styling.
   */
  readonly isDisabled = computed(() => this.disabled() || this.readonly());

  readonly slots = computed(() => Array.from({ length: this.length() }, (_, i) => i));

  /** Allowed characters, as the regex source string the primitive expects. */
  readonly otpPattern = computed(() => {
    switch (this.type()) {
      case 'number':
        return '[0-9]';
      case 'alphanumeric':
        return '[a-zA-Z0-9]';
      case 'text':
      default:
        return '.';
    }
  });

  readonly inputMode = computed<'tel' | 'text'>(() => (this.type() === 'number' ? 'tel' : 'text'));

  protected onBlur(): void {
    this.touched.set(true);
  }

  // Classes
  readonly wrapperClasses = computed(() => cn('space-y-2', this.userClass()));

  readonly labelClasses = computed(() => 'label');

  readonly slotClasses = computed(() => {
    const baseClasses =
      'flex items-center justify-center w-12 h-12 text-center text-lg font-semibold rounded-md border border-input bg-background transition-colors cursor-pointer relative';
    const errorClass = this.invalid() && this.touched() ? 'border-destructive' : '';
    return cn(baseClasses, errorClass);
  });

  readonly displayError = computed(
    () => this.invalid() && this.touched() && this.errors().length > 0,
  );
}
