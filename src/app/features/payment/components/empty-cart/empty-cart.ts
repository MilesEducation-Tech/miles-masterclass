import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/ui/button/button';
import { Utils } from '@shared/services/utils';

@Component({
  selector: 'app-empty-cart',
  imports: [RouterLink, Button],
  templateUrl: './empty-cart.html',
  styleUrl: './empty-cart.css',
})
export class EmptyCart {
  private readonly utils = inject(Utils);

  /** Only subscriptions are sold, so the way out of an empty cart is the plan page. */
  protected readonly planRoute = computed(
    () => `/${this.utils.country()}/${this.utils.profession()}/payment/plan`,
  );
}
