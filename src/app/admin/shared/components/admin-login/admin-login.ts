import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroExclamationCircle } from '@ng-icons/heroicons/outline';
import { faSolidAngleLeft } from '@ng-icons/font-awesome/solid';
import { AriaInput } from '@shared/components/ui/aria/aria-input/aria-input';
import { Button } from '@shared/components/ui/button/button';
import { Spinner } from '@shared/components/ui/spinner/spinner';
import { AdminAuth } from '@admin/core/services/admin-auth';
import { logo } from '@core/constants/icon';
import { environment } from '@env/environment';
import { adminLandingPath } from '../../utils/admin-landing';

@Component({
  selector: 'app-admin-login',
  imports: [AriaInput, Button, Spinner, NgIcon, NgOptimizedImage, RouterLink],
  providers: [provideIcons({ heroExclamationCircle })],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
})
export class AdminLogin {
  private readonly router = inject(Router);
  protected readonly auth = inject(AdminAuth);

  readonly email = signal('');
  readonly password = signal('');
  readonly magicLinkSent = signal(false);

  protected readonly icons = signal({
    logo,
    back: faSolidAngleLeft,
  });

  protected readonly bgUrl =
    environment.S3_BUCKET_URL + 'static-assests/web-app/payment/plab-bg.webp';

  readonly emailInvalid = computed(() => {
    const v = this.email().trim();
    if (!v) return false;
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  });

  readonly emailValid = computed(() => !!this.email().trim() && !this.emailInvalid());

  readonly canSubmit = computed(
    () => !this.auth.isLoading() && this.emailValid() && this.password().length > 0,
  );

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;

    const result = await this.auth.signIn(this.email().trim(), this.password());
    if (result.ok) {
      this.password.set('');
      this.router.navigateByUrl(adminLandingPath(this.auth));
    }
  }

  async onMagicLink(): Promise<void> {
    if (this.auth.isLoading() || !this.emailValid()) return;
    const result = await this.auth.sendMagicLink(this.email().trim());
    if (result.ok) this.magicLinkSent.set(true);
  }
}
