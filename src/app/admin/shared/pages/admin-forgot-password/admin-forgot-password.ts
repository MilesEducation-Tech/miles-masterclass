import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroExclamationCircle } from '@ng-icons/heroicons/outline';
import { faSolidAngleLeft } from '@ng-icons/font-awesome/solid';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { AdminAuth } from '@core/services/admin-auth/admin-auth';
import { logo } from '@core/constant/icon';
import { environment } from '@env/environment';

@Component({
  selector: 'app-admin-forgot-password',
  imports: [AriaInput, Button, Spinner, NgIcon, NgOptimizedImage, RouterLink],
  providers: [provideIcons({ heroExclamationCircle })],
  templateUrl: './admin-forgot-password.html',
})
export class AdminForgotPassword {
  protected readonly auth = inject(AdminAuth);

  readonly email = signal('');
  readonly sent = signal(false);

  protected readonly icons = signal({ logo, back: faSolidAngleLeft });
  protected readonly bgUrl =
    environment.S3_BUCKET_URL + 'static-assests/web-app/payment/plab-bg.webp';

  readonly emailInvalid = computed(() => {
    const v = this.email().trim();
    if (!v) return false;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  });

  readonly canSubmit = computed(
    () => !this.auth.isLoading() && !!this.email().trim() && !this.emailInvalid(),
  );

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const result = await this.auth.sendPasswordReset(this.email().trim());
    // Always show the confirmation — don't reveal whether the email exists.
    if (result.ok) this.sent.set(true);
  }
}
