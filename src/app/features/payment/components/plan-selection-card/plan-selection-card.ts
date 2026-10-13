import { Component, computed, inject, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matInfoRound } from '@ng-icons/material-icons/round';
import { Plan } from '@features/payment/models/commerce.model';
import { planTermName, planTermPer } from '@features/payment/utils/plan-term';

/**
 * One plan (a term of the subscription). Every figure is CAIRA's own decimal string
 * through `CurrencyPipe`; the card does no arithmetic on money.
 */
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

  readonly plan = input.required<Plan>();
  readonly selected = input(false);
  readonly select = output<Plan>();

  protected readonly title = computed(() => `${planTermName(this.plan().duration_months)} Plan`);
  protected readonly per = computed(() => planTermPer(this.plan().duration_months));
  /** What the learner pays: the selling price when discounted, otherwise the list price. */
  protected readonly amount = computed(
    () => this.plan().price.discount_price ?? this.plan().price.price,
  );

  protected readonly infoNote = computed(() => {
    const { price } = this.plan();
    const total = this.currencyPipe.transform(this.amount(), price.currency, 'symbol', '1.0-2');
    return (
      `Billed as a single upfront payment of ${total}/${this.per()}. Your subscription ` +
      'renews automatically unless canceled before the renewal date. T&C apply.'
    );
  });

  protected onSelect(): void {
    this.select.emit(this.plan());
  }
}
