import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Utils } from '@shared/services/utils';

@Component({
  selector: 'app-promo-offer',
  templateUrl: './promo-offer.html',
  host: { class: 'block' },
})
export class PromoOffer {
  private readonly router = inject(Router);
  private readonly utils = inject(Utils);

  /** Emitted when a signed-out user taps the CTA — the plan page opens signup. */
  readonly login = output<void>();

  // ponytail: inert — the template renders its signed-out design.
  protected readonly isLoggedIn = signal(false);

  protected onLogin(): void {
    this.login.emit();
  }

  protected onExploreWebinars(): void {
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([`/${country}/${profession}/webinar`]);
  }
}
