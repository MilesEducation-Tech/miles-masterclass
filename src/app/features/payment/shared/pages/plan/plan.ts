import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PlanScrollingGallery } from '../../components/plan-scrolling-gallery/plan-scrolling-gallery';
import { PlanComparisonTable } from '../../components/plan-comparison-table/plan-comparison-table';
import { PlanSelectionCard } from '../../components/plan-selection-card/plan-selection-card';
import { PromoOffer } from '../../components/promo-offer/promo-offer';
import { PromoCoupons } from '../../components/promo-coupons/promo-coupons';
import { PageLoading } from '../../../../../shared/components/ui/page-loading/page-loading';
import { ErrorState } from '../../../../../shared/components/ui/error-state/error-state';
import { Auth } from '../../../../../shared/core/services/auth/auth';
import { NotificationService } from '../../../../../shared/core/services/notification/notification';
import { Dialog } from '../../../../../shared/core/services/dialog/dialog';
import { Utils } from '../../../../../shared/core/services/utils/utils';
import { UtilsDialog } from '../../../../../shared/components/dialog/utils-dialog/utils-dialog';
import { SIGNUP_DIALOG_DATA } from '../../../../../shared/core/constant/payment';

interface BillingCard {
  plan: any;
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
  // ponytail: PaymentFacade was deleted with the Django strip. This placeholder
  // keeps the template bindings compiling and renders the empty state.
  // Swap in the new backend's service — the template needs no changes.
  private readonly facade: any = {
    addToCart: (..._args: any[]): any => null,
    loadMyBucket: (..._args: any[]): any => null,
    loadSubscriptionPlans: signal<any[]>([]),
    openFirmSponsorshipDialog: (..._args: any[]): any => null,
    plansError: signal<any>(null),
    plansLoading: signal<any>(null),
    promptPartnerCodeOrSubscribe: (..._args: any[]): any => null,
    subscriptionPlans: signal<any[]>([]),
  };
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(Dialog);
  private readonly utils = inject(Utils);
  private readonly destroyRef = inject(DestroyRef);

  // Starter (unlimited free trial) plans are hidden from this page — the
  // free-trial path was retired from the marketing/comparison surface.
  protected readonly plans = computed(() =>
    this.facade.subscriptionPlans().filter((p: any) => !p.is_unlimited_trial_enabled),
  );
  protected readonly loading = computed(() => this.facade.plansLoading());
  protected readonly error = computed(() => this.facade.plansError());
  protected readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
  // Existing subscribers don't see promo/coupon surfaces — they've already bought.
  protected readonly hasActivePlan = computed(() => this.auth.hasActivePlan());

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
      ?.cartitem_data.find((i: any) => i.item_details.delivery_mode === 'subscription');
    if (item) return { planId: item.item_details.id, cycle: item.pay_method ?? null };
    const flagged = this.plans().find((p: any) => p.is_added_to_cart);
    return flagged ? { planId: flagged.id, cycle: null } : null;
  });

  protected readonly selectedPlanId = signal<number | null>(null);
  protected readonly selectedPlan = computed(
    () => this.plans().find((p: any) => p.id === this.selectedPlanId()) ?? null,
  );

  // Which billing card the user picked for the selected priced plan.
  protected readonly selectedCycle = signal<'yearly' | 'monthly'>('yearly');
  protected readonly effectiveCycle = this.selectedCycle.asReadonly();

  // A priced plan renders as two billing cards (Yearly + Monthly), the
  // Enterprise (pay_per_course) plan as one. All cards are equal width.
  // Monthly (EMI) is country-dependent — driven by the backend's `emi_available`.
  private monthlyForPlan(plan: any): boolean {
    return !!plan.price_detail?.emi_available;
  }

  protected readonly displayCards = computed<BillingCard[]>(() => {
    const all = this.plans();
    const enterprise = all.filter((p: any) => p.subscription_type === 'pay_per_course');
    const priced = all.filter((p: any) => p.subscription_type !== 'pay_per_course');

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
          this.plans().find((p: any) => p.id === locked.planId)?.subscription_name ?? 'A plan';
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

  protected readonly canGetSponsorship = computed(() => {
    const plan = this.selectedPlan();
    return !!(
      plan?.is_recommended &&
      !plan.is_firm_sponsorship_applied &&
      !plan.is_in_myorder &&
      !this.selectedPlanInCart() &&
      this.isLoggedIn()
    );
  });

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
      const lockedPlan = locked ? all.find((p: any) => p.id === locked.planId) : undefined;
      if (locked && lockedPlan) {
        this.selectedPlanId.set(lockedPlan.id);
        if (locked.cycle) this.selectedCycle.set(locked.cycle);
        return;
      }

      if (this.selectedPlanId() === null) {
        const preferred = all.find((p: any) => p.is_recommended) ?? all[0];
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

    if (plan.is_recommended) {
      // Stay on the plan page after a successful partner code, so re-fetch the
      // plan list to reflect partner-driven eligibility/pricing. (The active
      // plan is refreshed by the PartnerCode service's profile reload.)
      this.facade.promptPartnerCodeOrSubscribe(plan, {
        refreshPlansOnApply: true,
        paymentType: this.effectiveCycle(),
        onAdded: () => this.goToCart(),
      });
      return;
    }

    this.facade.addToCart(plan.id, 'subscription', plan.price_detail, this.effectiveCycle(), () =>
      this.goToCart(),
    );
  }

  /** From the plan page we route to the cart page instead of the cart drawer. */
  private goToCart(): void {
    const { country, profession } = this.utils.getRouteParams();
    this.router.navigate([`/${country}/${profession}/payment/cart`]);
  }

  protected onFirmSponsorship(): void {
    const plan = this.selectedPlan();
    if (!plan || !this.canGetSponsorship()) return;
    this.facade.openFirmSponsorshipDialog(plan, this.effectiveCycle());
  }

  private navigateToConnectUs(plan: any): void {
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
