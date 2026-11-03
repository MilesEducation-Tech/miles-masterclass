import {
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgpDescription, NgpLabel } from 'ng-primitives/form-field';

import { PasswordInput } from '@features/auth/components/password-input/password-input';
import { PasswordFacade } from '@features/auth/services/password-facade';
import { DurationPipe } from '@shared/pipes/duration/duration-pipe';
import { Button } from '@shared/ui/button/button';
import { Field } from '@shared/ui/field/field';
import { InputOtp } from '@shared/ui/input-otp/input-otp';
import { Spinner } from '@shared/ui/spinner/spinner';

/**
 * Setting or changing a password: onboarding's step (with its heading and Skip) or the profile's
 * section (Cancel), new password and confirmation, the current password when changing one, and the
 * emailed code when the server asks.
 */
@Component({
  selector: 'app-password-form',
  imports: [
    FormField,
    NgpDescription,
    NgpLabel,
    PasswordInput,
    DurationPipe,
    Button,
    Field,
    InputOtp,
    Spinner,
    TranslocoPipe,
  ],
  templateUrl: './password-form.html',
})
export class PasswordForm {
  protected readonly facade = inject(PasswordFacade);

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  constructor() {
    // Onboarding: the heading takes focus when the step appears and when a refusal replaces the
    // form — either way the control that had focus is gone. The profile: the learner just asked for
    // this form, so its first field.
    afterRenderEffect(() => {
      this.facade.refusal();
      untracked(() => {
        if (this.facade.isOnboarding())
          this.heading()?.nativeElement.focus({ preventScroll: true });
        else this.facade.focusFirstField();
      });
    });
  }
}
