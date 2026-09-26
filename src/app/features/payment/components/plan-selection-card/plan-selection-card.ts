import { Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matInfoRound } from '@ng-icons/material-icons/round';
import { SubscriptionPlan } from '@core/models/payment.model';

/** Shared EMI disclaimer — kept in sync with the cart-flow copy. */
const EMI_NOTE =
  'Indicative monthly amount based on a 12-month split. Available tenures ' +
  '(3 / 6 / 12 / 18 months) and your final EMI are confirmed at checkout. T&C apply.';

/** Enterprise (pay-per-course) title tooltip. */
const ENTERPRISE_NOTE =
  'Tailored for accounting firms and finance teams. Includes bulk seat discounts, ' +
  'firm-wide progress tracking, centralized invoicing, and dedicated customer success. T&C apply.';

interface PriceDisplay {
  label: string | null;
  amount: number | null;
  baseAmount: number | null;
  currency: string | null;
  duration: string;
}

@Component({
  selector: 'app-plan-selection-card',
  imports: [CurrencyPipe, NgIcon],
  providers: [CurrencyPipe],
  viewProviders: [provideIcons({ matInfoRound })],
  templateUrl: './plan-selection-card.html',
  host: { class: 'block' },
})
export class PlanSelectionCard {
  private readonly currencyPipe = inject(CurrencyPipe);

  readonly plan = input.required<SubscriptionPlan>();
  readonly selected = input(false);
  readonly billingCycle = input<'yearly' | 'monthly'>('yearly');
  readonly select = output<SubscriptionPlan>();

  // Subtext (i) tooltip note for this card: monthly → EMI terms, annual →
  // upfront-billing terms, enterprise → firm blurb. Null = no icon shown.
  protected readonly infoNote = computed<string | null>(() => {
    const plan = this.plan();
    if (plan.subscription_type === 'pay_per_course') return ENTERPRISE_NOTE;
    if (this.billingCycle() === 'monthly') return EMI_NOTE;
    if (plan.is_unlimited_trial_enabled) return null;
    const price = plan.price_detail;
    if (!price) return null;
    const total = this.currencyPipe.transform(
      price.selling_price,
      price.currency_code,
      'symbol',
      '1.0-0',
    );
    return (
      `Billed as a single upfront payment of ${total}/year. Your subscription ` +
      'automatically renews annually unless canceled prior to the renewal date. T&C apply.'
    );
  });

  // Top label: "Monthly Plan" / "Billed Annually" / "Enterprise".
  protected readonly title = computed(() => {
    const plan = this.plan();
    if (plan.subscription_type === 'pay_per_course') return 'Enterprise';
    return this.billingCycle() === 'monthly' ? 'Monthly Plan' : 'Billed Annually';
  });

  protected readonly priceDisplay = computed<PriceDisplay>(() => {
    const plan = this.plan();
    if (plan.subscription_type === 'pay_per_course') {
      return { label: 'Custom', amount: null, baseAmount: null, currency: null, duration: '' };
    }
    if (plan.is_unlimited_trial_enabled) {
      return { label: 'Free', amount: null, baseAmount: null, currency: null, duration: '' };
    }
    const price = plan.price_detail;
    if (!price) {
      return { label: 'Contact Us', amount: null, baseAmount: null, currency: null, duration: '' };
    }
    // Monthly is derived from the yearly price ÷ 12 (only when the country/plan
    // supports it). `base_price` renders struck-through, `selling_price` is the
    // visible price — same rule for both cycles.
    const monthly = this.billingCycle() === 'monthly';
    const divisor = monthly ? 12 : 1;
    const duration = monthly
      ? 'mo*'
      : plan.plan_duration >= 12
        ? 'year'
        : `${plan.plan_duration} Month`;
    return {
      label: null,
      amount: Math.round(price.selling_price / divisor),
      baseAmount: Math.round(price.base_price / divisor),
      currency: price.currency_code,
      duration,
    };
  });

  protected readonly subtitle = computed(() => {
    const plan = this.plan();
    if (plan.subscription_type === 'pay_per_course') {
      return 'Your whole firm, AI-ready.';
    }
    if (plan.is_unlimited_trial_enabled) {
      return 'Try every feature, no card needed.';
    }
    if (this.billingCycle() === 'monthly') {
      // The annual total is the full yearly selling price (monthly is that ÷ 12).
      const price = plan.price_detail;
      const total = price
        ? this.currencyPipe.transform(price.selling_price, price.currency_code, 'symbol', '1.0-0')
        : '';
      return `Annual commitment, paid monthly (${total} total).`;
    }
    return 'Pay upfront and save. All you pay to be AI-ready.';
  });

  protected onSelect(): void {
    this.select.emit(this.plan());
  }
}
