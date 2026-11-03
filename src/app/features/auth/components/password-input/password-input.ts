import { Component, input, signal } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroEye, heroEyeSlash } from '@ng-icons/heroicons/outline';

import { Button } from '@shared/ui/button/button';
import { Input } from '@shared/ui/input/input';

/**
 * A password field with a show/hide toggle, for every password the auth screens ask for. Place it
 * inside an `app-field` with `<label ngpLabel [for]="inputId">`: the inner input registers with that
 * field, so the label, `aria-invalid` and the error line wire up as for any other control.
 */
@Component({
  selector: 'app-password-input',
  imports: [FormField, Input, Button, NgIcon, TranslocoPipe],
  providers: [provideIcons({ heroEye, heroEyeSlash })],
  templateUrl: './password-input.html',
  host: { class: 'relative block' },
})
export class PasswordInput {
  /** The signal-forms field this input edits. */
  readonly field = input.required<FieldTree<string>>();
  /** The inner input's `id`, for the label's `for`. Not `id`, which would land on the host too. */
  readonly inputId = input.required<string>();
  /** `current-password` to sign in, `new-password` to set one — what password managers key on. */
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly placeholder = input('');

  protected readonly visible = signal(false);
}
