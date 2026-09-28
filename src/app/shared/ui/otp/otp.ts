import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type {
  DisabledReason,
  FormValueControl,
  ValidationError,
  WithOptionalFieldTree,
} from '@angular/forms/signals';
import { environment } from '@env/environment';
import { NgpInputOtp, NgpInputOtpInput, NgpInputOtpSlot } from 'ng-primitives/input-otp';
import { cn } from '../../utils/cn';

/**
 * OTP entry built on `ngpInputOtp`.
 *
 * The primitive renders a single visually hidden input
 * (`autocomplete="one-time-code"`, so browser autofill and screen readers work)
 * and drives presentational slots that expose `data-filled`, `data-active`,
 * `data-caret` and `data-placeholder`. Because the real input is invisible,
 * those attributes ARE the focus indicator — the slot styling below is what
 * keeps keyboard users oriented, not decoration.
 *
 * Paste needs no handling here: the primitive trims, filters by pattern (so
 * "123 456" / "123-456" become "123456") and clamps to the slot count.
 */
@Component({
  selector: 'app-otp',
  imports: [NgpInputOtp, NgpInputOtpInput, NgpInputOtpSlot],
  templateUrl: './otp.html',
  host: { class: 'block w-full space-y-2' },
})
export class Otp implements FormValueControl<string> {
  readonly id = input.required<string>();
  readonly length = input(environment.AUTH.otpLength);
  readonly type = input<'number' | 'text' | 'alphanumeric'>('number');
  readonly label = input('');
  readonly hint = input('');
  readonly description = input('');
  readonly autoFocus = input(false);
  /** Character shown in an empty slot. */
  readonly placeholder = input('');

  /**
   * Fires once every slot is filled (typed or pasted). The primitive emits it
   * after `valueChange`, so the bound form field already holds the full code.
   */
  readonly completed = output<string>();

  /** The single hidden input the primitive drives; target for `autoFocus`. */
  private readonly otpInput = viewChild<ElementRef<HTMLInputElement>>('otpInput');

  constructor() {
    // `afterNextRender` is browser-only, so this is SSR-safe by design.
    afterNextRender(() => {
      if (!this.autoFocus()) return;
      this.otpInput()?.nativeElement.focus();
    });
  }

  // FormValueControl — `[formField]` binds all of these from the field state.
  readonly value = model<string>('');
  readonly touched = model<boolean>(false);
  readonly name = input('');
  readonly required = input(false);
  readonly disabled = input(false);
  readonly disabledReasons = input<readonly WithOptionalFieldTree<DisabledReason>[]>([]);
  readonly readonly = input(false);
  readonly hidden = input(false);
  readonly invalid = input(false);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);

  /**
   * `NgpInputOtp` has no readonly mode, and native `readonly` on the hidden
   * input wouldn't hold — the primitive's paste handler writes the value
   * itself. So a readonly control is disabled; both refuse input.
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

  readonly displayError = computed(
    () => this.invalid() && this.touched() && this.errors().length > 0,
  );

  protected readonly descriptionId = computed(() => `${this.id()}-description`);
  protected readonly hintId = computed(() => `${this.id()}-hint`);
  protected readonly errorId = computed(() => `${this.id()}-error`);

  /** Same rule as `aria-input`: the error replaces the hint while it shows. */
  protected readonly describedBy = computed(() => {
    const ids: string[] = [];
    if (this.description()) ids.push(this.descriptionId());
    if (this.hint() && !this.displayError()) ids.push(this.hintId());
    if (this.displayError()) ids.push(this.errorId());
    return ids.length ? ids.join(' ') : null;
  });

  protected readonly slotClasses = computed(() =>
    cn(
      // w-12 keeps the intrinsic width (shrink-wrapped cards size to it);
      // shrink + min-w-0 let the row fit a 320 px screen instead of wrapping.
      'relative flex aspect-square w-12 min-w-0 shrink items-center justify-center',
      'rounded-md border border-input bg-background text-lg font-semibold cursor-text',
      'transition-[border-color,box-shadow] motion-reduce:transition-none',
      'data-[placeholder]:text-muted-foreground',
      'data-[active]:border-ring data-[active]:ring-2 data-[active]:ring-ring/30',
      'data-[caret]:after:absolute data-[caret]:after:h-5 data-[caret]:after:w-px',
      'data-[caret]:after:bg-foreground data-[caret]:after:animate-caret-blink',
      'motion-reduce:after:animate-none',
      'group-data-[disabled]:cursor-not-allowed group-data-[disabled]:opacity-50',
      this.displayError() &&
        'border-destructive data-[active]:border-destructive data-[active]:ring-destructive/30',
    ),
  );

  protected onBlur(): void {
    this.touched.set(true);
  }
}
