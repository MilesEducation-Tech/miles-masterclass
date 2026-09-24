import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck } from '@ng-icons/lucide';
import { DialogRef } from '@core/services/dialog/dialog';
import { PaymentFacade } from '../../services/payment-facade';
import { PlanSelectionCard } from '../../components/plan-selection-card/plan-selection-card';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Button } from '@shared/ui/button/button';

@Component({
  selector: 'app-subscription-dialog',
  imports: [PlanSelectionCard, PageLoading, ErrorState, Button, NgIcon],
  providers: [provideIcons({ lucideCheck })],
  templateUrl: './subscription-dialog.html',
  styleUrl: './subscription-dialog.css',
})
export class SubscriptionDialog {
  // The orchestrator marks `dismissedSubscription` at open-time, so the close
  // payload is no-op — every exit path is "dismissed for this session". Typed
  // as `void` to avoid pretending the return value carries meaning.
  dialogRef!: DialogRef<SubscriptionDialog, void>;

  private readonly facade = inject(PaymentFacade);

  // Dialog only ever shows the recommended plan (server-filtered via
  // `is_recommended=true`). Reads the recommended-only slice so it never
  // overwrites the plan page's full list (which includes the Enterprise plan).
  // Starter / unlimited-trial plans are excluded defensively.
  readonly plans = computed(() =>
    this.facade.recommendedPlans().filter((p) => !p.is_unlimited_trial_enabled),
  );
  readonly recommendedPlan = computed(
    () => this.plans().find((p) => p.is_recommended) ?? this.plans()[0] ?? null,
  );
  readonly loading = computed(() => this.facade.recommendedPlansLoading());
  readonly error = computed(() => this.facade.recommendedPlansError());

  // EMI (monthly) option — mirrors the plan page. Show a Monthly + Yearly card
  // when the plan supports it; otherwise just Yearly. Defaults to monthly.
  readonly emiAvailable = computed(() => !!this.recommendedPlan()?.price_detail?.emi_available);
  readonly cycles = computed<('monthly' | 'yearly')[]>(() =>
    this.emiAvailable() ? ['monthly', 'yearly'] : ['yearly'],
  );
  readonly selectedCycle = signal<'monthly' | 'yearly'>('monthly');
  readonly effectiveCycle = computed<'monthly' | 'yearly'>(() =>
    this.emiAvailable() ? this.selectedCycle() : 'yearly',
  );

  readonly subscribeLabel = computed(() => {
    const plan = this.recommendedPlan();
    if (!plan) return 'Subscribe Now';
    if (plan.subscription_type === 'pay_per_course') return 'Contact Sales';
    if (plan.is_in_myorder) return 'Already Subscribed';
    if (plan.is_added_to_cart) return 'Go to Cart';
    return 'Subscribe Now';
  });

  readonly subscribeDisabled = computed(() => !!this.recommendedPlan()?.is_in_myorder);

  readonly canGetSponsorship = computed(() => {
    const plan = this.recommendedPlan();
    return !!(
      plan?.is_recommended &&
      !plan.is_firm_sponsorship_applied &&
      !plan.is_in_myorder &&
      !plan.is_added_to_cart
    );
  });

  readonly hasConditions = computed(() =>
    (this.recommendedPlan()?.features ?? []).some((f) => f.planfeature?.has_conditions),
  );

  constructor() {
    this.facade.loadSubscriptionPlans({ recommendedOnly: true });
  }

  retryLoad(): void {
    this.facade.loadSubscriptionPlans({ recommendedOnly: true });
  }

  close(): void {
    this.dialogRef.close();
  }

  onSubscribe(): void {
    const plan = this.recommendedPlan();
    if (!plan || this.subscribeDisabled()) return;

    if (plan.is_added_to_cart) {
      this.facade.loadMyBucket({ force: true });
      this.facade.openCartDrawer();
    } else if (plan.is_recommended) {
      // Recommended plan funnels through the partner-code prompt; the
      // facade routes between add-to-cart and partner-code-applied.
      this.facade.promptPartnerCodeOrSubscribe(plan, { paymentType: this.effectiveCycle() });
    } else {
      this.facade.addToCart(plan.id, 'subscription', plan.price_detail, this.effectiveCycle());
    }
    this.dialogRef.close();
  }

  onFirmSponsorship(): void {
    const plan = this.recommendedPlan();
    if (!plan || !this.canGetSponsorship()) return;
    this.facade.openFirmSponsorshipDialog(plan, this.effectiveCycle());
    this.dialogRef.close();
  }
}
