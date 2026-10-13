import { Component, DestroyRef, computed, inject, linkedSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PaymentFacade } from '@features/payment/services/payment-facade';
import { Plan as PlanModel } from '@features/payment/models/commerce.model';
import { PlanScrollingGallery } from '@shared/components/plan-scrolling-gallery/plan-scrolling-gallery';
import { PlanComparisonTable } from '@features/payment/components/plan-comparison-table/plan-comparison-table';
import { PlanSelectionCard } from '@features/payment/components/plan-selection-card/plan-selection-card';
import { PromoOffer } from '@features/payment/components/promo-offer/promo-offer';
import { PromoCoupons } from '@features/payment/components/promo-coupons/promo-coupons';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { AuthSession } from '@core/services/auth-session/auth-session';
import { CartStore } from '@core/services/cart/cart-store';
import { NgpDialogManager } from 'ng-primitives/dialog';
import { Utils } from '@shared/services/utils';
// Type-only: UtilsDialog loads with `import()` when opened (PROMPT.md §4.4).
import type { UtilsDialogData, UtilsDialogResult } from '@shared/dialogs/utils-dialog/utils-dialog';
import { SIGNUP_DIALOG_DATA } from '@features/payment/constants/payment';

@Component({
  selector: 'app-plan',
  imports: [
    PlanScrollingGallery,
    PlanComparisonTable,
    PlanSelectionCard,
    PromoOffer,
    PromoCoupons,
    PageLoading,
    ErrorState,
  ],
  templateUrl: './plan.html',
})
export class Plan {
  private readonly facade = inject(PaymentFacade);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly dialogs = inject(NgpDialogManager);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  /** One card per plan (a term of the subscription), in CAIRA's `sort_order`. */
  protected readonly plans = this.facade.plans;
  protected readonly loading = this.facade.plansLoading;
  protected readonly error = this.facade.plansError;
  // The boolean, never the token.
  protected readonly isLoggedIn = inject(AuthSession).isAuthenticated;

  /** Starts on CAIRA's default plan; a click moves it, and a new plan list resets it. */
  protected readonly selectedPlanId = linkedSignal(() => this.facade.defaultPlan()?.id ?? null);
  protected readonly selectedPlan = computed(
    () => this.plans().find((p) => p.id === this.selectedPlanId()) ?? null,
  );

  /**
   * A subscription cart holds one line. Once this session knows the cart has it,
   * Subscribe goes to the cart instead of adding again. Cart lines carry the
   * product, not the plan, so a different plan is refused by the API (409,
   * `subscription_already_in_cart`) and the learner sees its message.
   */
  protected readonly subscribeLabel = computed(() =>
    this.cart.lineCount() > 0 ? 'Go to Cart' : 'Subscribe Now',
  );

  constructor() {
    this.facade.loadPlans();
  }

  protected retryLoad(): void {
    this.facade.loadPlans();
  }

  protected onSelect(plan: PlanModel): void {
    this.selectedPlanId.set(plan.id);
  }

  protected onSubscribe(): void {
    const plan = this.selectedPlan();
    if (!plan) return;

    if (!this.isLoggedIn()) {
      this.openSignupDialog();
      return;
    }

    if (this.cart.lineCount() > 0) {
      this.goToCart();
      return;
    }

    this.facade.addPlanToCart(plan, () => this.goToCart());
  }

  /** From the plan page we route to the cart page instead of the cart drawer. */
  private goToCart(): void {
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([`/${country}/${profession}/payment/cart`]);
  }

  protected async openSignupDialog(): Promise<void> {
    const { UtilsDialog } = await import('@shared/dialogs/utils-dialog/utils-dialog');
    const dialogRef = this.dialogs.open<UtilsDialogData, UtilsDialogResult>(UtilsDialog, {
      data: {
        ...SIGNUP_DIALOG_DATA,
        width: '500px',
        maxWidth: '95vw',
        ariaLabel: 'Sign up to access content',
      },
    });

    dialogRef.afterClosed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.action === 'confirm') {
        this.router.navigate(['/auth/login'], {
          queryParams: { redirect: this.router.url },
        });
      }
    });
  }
}
