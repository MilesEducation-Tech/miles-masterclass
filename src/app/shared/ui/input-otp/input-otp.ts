import { BooleanInput, NumberInput } from '@angular/cdk/coercion';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  numberAttribute,
  output,
  viewChild,
} from '@angular/core';
import { NgpFormControl } from 'ng-primitives/form-field';
import { NgpInputOtp, NgpInputOtpInput, NgpInputOtpSlot } from 'ng-primitives/input-otp';

const SLOT =
  "relative flex h-12 w-10 cursor-text items-center justify-center rounded-lg border border-input bg-background text-lg font-semibold text-foreground transition-colors data-placeholder:text-muted-foreground data-active:border-ring data-active:ring-2 data-active:ring-ring/30 data-caret:after:absolute data-caret:after:h-5 data-caret:after:w-px data-caret:after:animate-caret-blink data-caret:after:bg-foreground data-caret:after:content-[''] motion-reduce:data-caret:after:animate-none group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50 group-has-[[data-invalid][data-touched]]:border-destructive";

/**
 * One-time-code entry bound to signal forms through its own `value` model (start the model at
 * `''`). The single real `<input>` is what autofill and assistive technology see; it carries
 * `ngpFormControl`, so an `app-field` label names it and validity lands on it. The slots are
 * presentational.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-input-otp',
  imports: [NgpInputOtp, NgpInputOtpInput, NgpInputOtpSlot, NgpFormControl],
  host: { class: 'inline-flex max-w-full flex-col gap-3' },
  template: `
    <div
      ngpInputOtp
      class="group"
      [(ngpInputOtpValue)]="value"
      [ngpInputOtpDisabled]="disabled()"
      [ngpInputOtpPattern]="otpPattern()"
      [ngpInputOtpPlaceholder]="placeholder()"
      [ngpInputOtpInputMode]="inputMode()"
      (ngpInputOtpComplete)="complete.emit()"
    >
      <input
        #otpInput
        ngpInputOtpInput
        ngpFormControl
        [attr.aria-label]="ariaLabel() || null"
        (blur)="touch.emit()"
      />
      <div class="flex gap-2">
        @for (_ of slots(); track $index) {
          <div ngpInputOtpSlot [class]="slotClass"></div>
        }
      </div>
    </div>
  `,
})
export class InputOtp {
  /** The number of slots to display. */
  readonly length = input<number, NumberInput>(6, { transform: numberAttribute });

  /** The disabled state; `[formField]` writes it too. */
  readonly disabled = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

  /**
   * The regex source for allowed characters. Not named `pattern`: `[formField]` writes the
   * field's `pattern` (a RegExp list) into an input of that name.
   */
  readonly otpPattern = input('[0-9]');

  /** The placeholder character for empty slots. */
  readonly placeholder = input('');

  /** The accessible name of the input when it is not inside an `app-field`. */
  readonly ariaLabel = input('');

  /** The input mode for the hidden input. */
  readonly inputMode = input<'numeric' | 'text' | 'decimal' | 'tel' | 'search' | 'email' | 'url'>(
    'numeric',
  );

  /** Focus the code entry as soon as it renders, e.g. right after the code was sent. */
  readonly autoFocus = input(false);

  /** The current value. */
  readonly value = model<string>('');

  /** Fires once every slot is filled, e.g. to submit the code. */
  readonly complete = output<void>();

  /** Signal forms mark the field touched on this. */
  readonly touch = output<void>();

  protected readonly slots = computed(() => Array.from({ length: this.length() }, (_, i) => i));
  protected readonly slotClass = SLOT;

  private readonly otpInput = viewChild.required<ElementRef<HTMLInputElement>>('otpInput');

  constructor() {
    afterNextRender(() => {
      if (this.autoFocus()) {
        this.otpInput().nativeElement.focus();
      }
    });
  }
}
