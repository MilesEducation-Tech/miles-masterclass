import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroExclamationCircle } from '@ng-icons/heroicons/outline';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { AdminAuth } from '@core/services/admin-auth/admin-auth';
import { logo } from '@core/constant/icon';
import { environment } from '@env/environment';
import { adminLandingPath } from '../../utils/admin-landing';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-admin-reset-password',
  imports: [AriaInput, Button, Spinner, NgIcon, NgOptimizedImage],
  providers: [provideIcons({ heroExclamationCircle })],
  templateUrl: './admin-reset-password.html',
})
export class AdminResetPassword {
  private readonly router = inject(Router);
  protected readonly auth = inject(AdminAuth);

  readonly password = signal('');
  readonly confirm = signal('');

  protected readonly icons = signal({ logo });
  protected readonly bgUrl =
    environment.S3_BUCKET_URL + 'static-assests/web-app/payment/plab-bg.webp';

  constructor() {
    // Idempotent — ensures the auth listener is wired so Supabase can pick up
    // the recovery session from the URL fragment and populate auth.session().
    void this.auth.init();
  }

  readonly tooShort = computed(
    () => this.password().length > 0 && this.password().length < MIN_PASSWORD_LENGTH,
  );
  readonly mismatch = computed(
    () => this.confirm().length > 0 && this.confirm() !== this.password(),
  );

  readonly canSubmit = computed(
    () =>
      !this.auth.isLoading() &&
      this.password().length >= MIN_PASSWORD_LENGTH &&
      this.confirm() === this.password(),
  );

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const result = await this.auth.updatePassword(this.password());
    if (result.ok) {
      this.router.navigateByUrl(adminLandingPath(this.auth));
    }
  }
}
