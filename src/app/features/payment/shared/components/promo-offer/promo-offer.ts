import { Component, computed, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { Utils } from '../../../../../shared/core/services/utils/utils';

@Component({
  selector: 'app-promo-offer',
  templateUrl: './promo-offer.html',
  styleUrl: './promo-offer.css',
})
export class PromoOffer {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  /** Emitted when a signed-out user taps the CTA — the plan page opens signup. */
  readonly login = output<void>();

  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());

  protected onLogin(): void {
    this.login.emit();
  }

  protected onExploreWebinars(): void {
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([`/${country}/${profession}/webinar`]);
  }
}
