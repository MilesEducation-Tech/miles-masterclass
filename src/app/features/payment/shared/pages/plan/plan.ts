import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PaymentFacade } from '../../service/payment-facade/payment-facade';
import { PlanScrollingGallery } from '@shared/components/plan-scrolling-gallery/plan-scrolling-gallery';
import { PlanComparisonTable } from '../../components/plan-comparison-table/plan-comparison-table';
import { PlanSelectionCard } from '../../components/plan-selection-card/plan-selection-card';
import { PromoOffer } from '../../components/promo-offer/promo-offer';
import { PromoCoupons } from '../../components/promo-coupons/promo-coupons';
import { PageLoading } from '@shared/ui/page-loading/page-loading';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { SubscriptionPlan } from '@core/models/payment.model';
import { NotificationService } from '@core/services/notification/notification';
import { Dialog } from '@core/services/dialog/dialog';
import { Utils } from '@shared/services/utils';
import { UtilsDialog } from '@shared/dialogs/utils-dialog/utils-dialog';
// Type-only (matches the facade's convention): the runtime class comes from the
// `import()` inside `onApplyPartnerCode`, so the dialog stays out of this chunk.
import type {
  PartnerCodePromptDialog,
  PartnerCodePromptResult,
} from '@features/payment/dialogs/partner-code-prompt-dialog/partner-code-prompt-dialog';
import { SIGNUP_DIALOG_DATA } from '@features/payment/constants/payment';

interface BillingCard {
  plan: SubscriptionPlan;
  kind: 'yearly' | 'monthly' | 'enterprise';
}

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
  styleUrl: './plan.css',
})
export class Plan {
  private readonly facade = inject(PaymentFacade);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(Dialog);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  // Starter (unlimited free trial) plans are hidden from this page — the
  // free-trial path was retired from the marketing/comparison surface.
  protected readonly plans = computed(() =>
    this.facade.subscriptionPlans().filter((p) => !p.is_unlimited_trial_enabled),
  );
  protected readonly loading = computed(() => this.facade.plansLoading());
  protected readonly error = computed(() => this.facade.plansError());
  // ponytail: both read the removed session service. Signed-out with no plan
  // is what the page now always renders.
  protected readonly isLoggedIn = signal(false);
  protected readonly hasActivePlan = signal(false);

  // A subscription already sitting in the cart locks the selection (plan AND
  // billing cycle) — the user must remove it from the cart to change either.
  // The cart is the source of truth; the plans API's `is_added_to_cart` flag is
  // only a fallback while the cart hasn't loaded yet.
  protected readonly cartSubscription = computed<{
    planId: number;
    cycle: 'yearly' | 'monthly' | null;
  } | null>(() => {
    const item = this.facade
      .cartData()
      ?.cartitem_data.find((i) => i.item_details.delivery_mode === 'subscription');
    if (item) return { planId: item.item_details.id, cycle: item.pay_method ?? null };
    const flagged = this.plans().find((p) => p.is_added_to_cart);
    return flagged ? { planId: flagged.id, cycle: null } : null;
  });

  protected readonly selectedPlanId = signal<number | null>(null);
  protected readonly selectedPlan = computed(
    () => this.plans().find((p) => p.id === this.selectedPlanId()) ?? null,
  );

  // Which billing card the user picked for the selected priced plan.
  protected readonly selectedCycle = signal<'yearly' | 'monthly'>('yearly');
  protected readonly effectiveCycle = this.selectedCycle.asReadonly();

  // A priced plan renders as two billing cards (Yearly + Monthly), the
  // Enterprise (pay_per_course) plan as one. All cards are equal width.
  // Monthly (EMI) is country-dependent — driven by the backend's `emi_available`.
  private monthlyForPlan(plan: SubscriptionPlan): boolean {
    return !!plan.price_detail?.emi_available;
  }

  protected readonly displayCards = computed<BillingCard[]>(() => {
    const all = this.plans();
    const enterprise = all.filter((p) => p.subscription_type === 'pay_per_course');
    const priced = all.filter((p) => p.subscription_type !== 'pay_per_course');

    const cards: BillingCard[] = [];
    for (const plan of priced) {
      if (this.monthlyForPlan(plan)) cards.push({ plan, kind: 'monthly' });
      cards.push({ plan, kind: 'yearly' });
    }
    for (const plan of enterprise) {
      cards.push({ plan, kind: 'enterprise' });
    }
    return cards;
  });

  protected isCardSelected(card: BillingCard): boolean {
    if (card.plan.id !== this.selectedPlanId()) return false;
    return card.kind === 'enterprise' || card.kind === this.selectedCycle();
  }

  protected onSelectCard(card: BillingCard): void {
    const locked = this.cartSubscription();
    if (locked) {
      const differentPlan = card.plan.id !== locked.planId;
      const differentCycle =
        !!locked.cycle && card.kind !== 'enterprise' && card.kind !== locked.cycle;
      if (differentPlan || differentCycle) {
        const name =
          this.plans().find((p) => p.id === locked.planId)?.subscription_name ?? 'A plan';
        const cycleSuffix = locked.cycle ? ` (${locked.cycle} billing)` : '';
        this.notification.info(
          'Plan already in cart',
          `${name}${cycleSuffix} is already in your cart. Remove it from the cart to change your selection.`,
        );
        return;
      }
    }
    this.selectedPlanId.set(card.plan.id);
    if (card.kind !== 'enterprise') this.selectedCycle.set(card.kind);
  }

  // Cart-sourced check so the CTA is right even when the plans API's
  // `is_added_to_cart` flag is stale.
  protected readonly selectedPlanInCart = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return false;
    return plan.is_added_to_cart || plan.id === this.cartSubscription()?.planId;
  });

  protected readonly subscribeLabel = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return 'Subscribe Now';
    if (plan.subscription_type === 'pay_per_course') return 'Contact Sales';
    if (plan.is_in_myorder) return 'Already Subscribed';
    if (this.selectedPlanInCart()) return 'Go to Cart';
    return 'Subscribe Now';
  });

  protected readonly subscribeDisabled = computed(() => !!this.selectedPlan()?.is_in_myorder);

  /**
   * Both alternative funding routes — firm sponsorship and partner code — stay
   * on offer right up until the user actually holds a subscription. Anything
   * narrower (recommended-plan-only, cart state, already-applied) hid them at
   * the moment people go looking for them: mid-decision, with a plan selected.
   * An active plan is the one state where neither can change the outcome.
   *
   * Both are gated together on purpose — they're a pair in the layout, and a
   * row with one button in it reads as a mistake.
   */
  protected readonly canGetAlternativeFunding = computed(
    () => !!this.selectedPlan() && !this.hasActivePlan(),
  );

  constructor() {
    this.facade.loadSubscriptionPlans();

    // The plan page is a sibling of the Payment shell, so its `cartResolver`
    // doesn't run here — load the bucket ourselves so the cart lock has data.
    // Gate only on `isLoggedIn()` (facade dedupes via `cartFetched`; reading
    // cart signals here would loop the effect — see footer-overlay).
    effect(() => {
      if (this.isLoggedIn()) {
        untracked(() => this.facade.loadMyBucket());
      }
    });

    // Snap the selection to the subscription already in the cart (plan + cycle
    // are locked to it) — re-applies whenever plans or cart arrive, since the
    // cart can load after the plan list. With no cart lock, auto-select the
    // recommended plan once, defaulting to the Monthly card when available.
    effect(() => {
      const all = this.plans();
      if (all.length === 0) return;

      const locked = this.cartSubscription();
      const lockedPlan = locked ? all.find((p) => p.id === locked.planId) : undefined;
      if (locked && lockedPlan) {
        this.selectedPlanId.set(lockedPlan.id);
        if (locked.cycle) this.selectedCycle.set(locked.cycle);
        return;
      }

      if (this.selectedPlanId() === null) {
        const preferred = all.find((p) => p.is_recommended) ?? all[0];
        this.selectedPlanId.set(preferred.id);
        this.selectedCycle.set(this.monthlyForPlan(preferred) ? 'monthly' : 'yearly');
      }
    });
  }

  protected retryLoad(): void {
    this.facade.loadSubscriptionPlans();
  }

  protected onSubscribe(): void {
    const plan = this.selectedPlan();
    if (!plan || this.subscribeDisabled()) return;

    if (!this.isLoggedIn()) {
      this.openSignupDialog();
      return;
    }

    if (plan.subscription_type === 'pay_per_course') {
      this.navigateToConnectUs(plan);
      return;
    }

    if (this.selectedPlanInCart()) {
      this.facade.loadMyBucket({ force: true });
      this.goToCart();
      return;
    }

    // Subscribe adds to the cart, full stop. The partner-code prompt that used
    // to interrupt recommended plans here is now its own button below Get Firm
    // Sponsorship — one button, one outcome. (The onboarding subscription
    // dialog still uses `promptPartnerCodeOrSubscribe`; it has no room for a
    // second CTA.)
    this.facade.addToCart(plan.id, 'subscription', plan.price_detail, this.effectiveCycle(), () =>
      this.goToCart(),
    );
  }

  /**
   * Opens the partner-code entry on its own. Refreshes the plan list on
   * success so partner-driven eligibility/pricing shows up in place — the user
   * stays on this page rather than being pushed into the cart.
   */
  protected async onApplyPartnerCode(): Promise<void> {
    // The button is no longer gated on being signed in, so it has to handle
    // that here — same signup prompt Subscribe uses.
    if (!this.isLoggedIn()) {
      this.openSignupDialog();
      return;
    }

    const { PartnerCodePromptDialog } =
      await import('@features/payment/dialogs/partner-code-prompt-dialog/partner-code-prompt-dialog');
    const ref = this.dialog.open<PartnerCodePromptDialog, PartnerCodePromptResult>(
      PartnerCodePromptDialog,
      // No `injector` needed — the dialog only injects root services.
      { maxWidth: '95vw', ariaLabel: 'Apply a partner code', data: { codeOnly: true } },
    );
    ref.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.action === 'partner-code-applied') this.facade.loadSubscriptionPlans();
    });
  }

  /** From the plan page we route to the cart page instead of the cart drawer. */
  private goToCart(): void {
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([`/${country}/${profession}/payment/cart`]);
  }

  protected onFirmSponsorship(): void {
    const plan = this.selectedPlan();
    if (!plan) return;
    if (!this.isLoggedIn()) {
      this.openSignupDialog();
      return;
    }
    this.facade.openFirmSponsorshipDialog(plan, this.effectiveCycle());
  }

  private navigateToConnectUs(plan: SubscriptionPlan): void {
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([`/${country}/${profession}/connect-us`], {
      queryParams: { enquiryType: `Interest in ${plan.subscription_name} plan` },
    });
  }

  protected openSignupDialog(): void {
    const dialogRef = this.dialog.open(UtilsDialog, {
      width: '500px',
      maxWidth: '95vw',
      ariaLabel: 'Sign up to access content',
      data: SIGNUP_DIALOG_DATA,
    });

    dialogRef.afterClosed$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result: any) => {
      if (result?.action === 'confirm') {
        this.router.navigate(['/auth/login'], {
          queryParams: { redirect: this.router.url },
        });
      }
    });
  }
}
