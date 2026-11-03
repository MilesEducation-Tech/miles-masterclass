import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroEnvelopeOpen } from '@ng-icons/heroicons/outline';
import { NgpLabel } from 'ng-primitives/form-field';

import { toAuthFailure } from '@core/models/auth.model';
import { PasswordApi } from '@core/services/password-api/password-api';
import { SUPPORT_EMAIL } from '@features/auth/constants/auth';
import { ForgotPasswordModel } from '@features/auth/models/sign-in.model';
import { Button } from '@shared/ui/button/button';
import { Field } from '@shared/ui/field/field';
import { Input } from '@shared/ui/input/input';
import { Spinner } from '@shared/ui/spinner/spinner';

/**
 * `/auth/forgot-password`: email a link that sets a new password. One route serves "forgot" and "set
 * a first password", so the copy says it works either way.
 *
 * The 202 is the same for every account, known or not, so "Check your email" never says one exists.
 * Everything else (a 400 for a malformed address, 502, 503, no network) means nothing was sent, and
 * the form stays with the reason under it — a "sent" screen there would leave the learner waiting
 * for an email that is not coming.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [FormField, RouterLink, NgpLabel, NgIcon, Button, Field, Input, Spinner, TranslocoPipe],
  providers: [provideIcons({ heroArrowLeft, heroEnvelopeOpen })],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly passwords = inject(PasswordApi);
  // Synchronous: the auth route's resolver merged the `auth.*` dictionary before this page rendered.
  private readonly transloco = inject(TranslocoService);
  private readonly t = (key: string): string => this.transloco.translate(key);

  protected readonly supportEmail = SUPPORT_EMAIL;

  protected readonly model = signal<ForgotPasswordModel>({ email: '' });

  protected readonly form = form<ForgotPasswordModel>(this.model, (schema) => {
    required(schema.email, { message: this.t('auth.login.password.errors.emailRequired') });
    email(schema.email, { message: this.t('auth.login.errors.invalidEmail') });
  });

  protected readonly isSending = signal(false);
  /** The 202's message once the link has gone; `null` while the form is showing. */
  protected readonly sentMessage = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.isSending()) return;
    this.form().markAsTouched();
    if (this.form().invalid()) return;

    this.isSending.set(true);
    this.error.set(null);
    try {
      const message = await this.passwords.requestLink(this.model().email.trim());
      this.sentMessage.set(message || this.t('auth.forgot.sentFallback'));
    } catch (err) {
      this.error.set(
        toAuthFailure(err instanceof HttpErrorResponse ? err : new HttpErrorResponse({ status: 0 }))
          .message,
      );
    } finally {
      this.isSending.set(false);
    }
  }
}
