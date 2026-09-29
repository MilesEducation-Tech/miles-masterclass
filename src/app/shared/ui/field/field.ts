import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { NgpError, NgpFormField } from 'ng-primitives/form-field';
import { cn } from '../../utils/cn';

/** Shown when a schema rule carries no message of its own. */
const FALLBACK: Record<string, string> = {
  required: 'This field is required.',
  email: 'Enter a valid email address.',
  minLength: 'This value is too short.',
  maxLength: 'This value is too long.',
  min: 'This value is too low.',
  max: 'This value is too high.',
  pattern: 'This value is not in the expected format.',
};

/**
 * The form-field container: put a `<label ngpLabel for="x">`, the control (`id="x"`), and any `<p ngpDescription>` /
 * `<p ngpError ngpErrorValidator="…">` inside it; ng-primitives wires `for`, `aria-labelledby`,
 * `aria-describedby`, `aria-invalid` and the `data-*` state. The child styling lives here, as
 * arbitrary-variant utilities, so every field in the app reads the same without repeating classes.
 * An error is visible only once its validator fails on a touched control. Pass the field's own
 * `errors` (`[errors]="form.email().errors()"`) to render every schema message without listing
 * validators by hand; explicit `<p ngpError ngpErrorValidator="…">` children still work.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-field',
  hostDirectives: [NgpFormField],
  imports: [NgpError],
  host: { '[class]': 'classes()' },
  template: `
    <ng-content />
    @for (error of errors(); track $index) {
      <p ngpError [ngpErrorValidator]="error.kind">{{ error.message || fallback(error.kind) }}</p>
    }
  `,
})
export class Field {
  /** The bound field's `errors()`; each renders as a `ngpError` keyed by its validator. */
  readonly errors = input<readonly ValidationError[]>([]);

  // The element's own `class` goes through cn() so a caller's `flex-row` wins over the default.
  private readonly ownClass =
    inject(ElementRef<HTMLElement>).nativeElement.getAttribute('class') ?? '';

  protected readonly classes = computed(() =>
    cn(
      'flex flex-col gap-1.5 [&_[ngpLabel]]:text-sm [&_[ngpLabel]]:font-medium [&_[ngpLabel]]:text-foreground [&_[ngpDescription]]:text-xs [&_[ngpDescription]]:text-muted-foreground [&_[ngpError]]:hidden [&_[ngpError]]:text-xs [&_[ngpError]]:text-destructive [&_[ngpError][data-validator=fail][data-touched]]:block',
      this.ownClass,
    ),
  );

  protected fallback(kind: string): string {
    return FALLBACK[kind] ?? 'This value is not valid.';
  }
}
