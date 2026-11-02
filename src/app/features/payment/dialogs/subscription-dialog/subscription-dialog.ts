import { Component, computed, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { injectDialogRef } from 'ng-primitives/dialog';

import { PaymentFacade } from '@features/payment/services/payment-facade';
import { PlanSelectionCard } from '@features/payment/components/plan-selection-card/plan-selection-card';
import { CartStore } from '@core/services/cart/cart-store';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Button } from '@shared/ui/button/button';
import { Dialog } from '@shared/ui/dialog/dialog';

@Component({
  selector: 'app-subscription-dialog',
  imports: [PlanSelectionCard, PageLoading, ErrorState, Button, NgIcon, Dialog],
  providers: [provideIcons({ lucideCheck })],
  templateUrl: './subscription-dialog.html',
  host: { class: 'block' },
})
export class SubscriptionDialog {
  // The orchestrator marks `dismissedSubscription` at open-time, so the close
  // payload is no-op — every exit path is "dismissed for this session". Typed
  // as `void` to avoid pretending the return value carries meaning.
  private readonly dialogRef = injectDialogRef<void, void>();

  private readonly facade = inject(PaymentFacade);
  private readonly cart = inject(CartStore);

  /** The dialog offers one plan: CAIRA's default. The plan page shows them all. */
  readonly plan = this.facade.defaultPlan;
  readonly loading = this.facade.plansLoading;
  readonly error = this.facade.plansError;

  readonly subscribeLabel = computed(() =>
    this.cart.lineCount() > 0 ? 'Go to Cart' : 'Subscribe Now',
  );

  constructor() {
    this.facade.loadPlans();
  }

  retryLoad(): void {
    this.facade.loadPlans();
  }

  close(): void {
    this.dialogRef.close();
  }

  onSubscribe(): void {
    const plan = this.plan();
    if (!plan) return;
    if (this.cart.lineCount() > 0) this.facade.openCartDrawer();
    else this.facade.addPlanToCart(plan);
    this.dialogRef.close();
  }
}
