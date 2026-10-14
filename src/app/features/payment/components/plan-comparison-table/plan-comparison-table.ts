import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { Plan, PlanFeature } from '@features/payment/models/commerce.model';
import { proCrownIcon } from '@features/payment/constants/plan-icons';
import { planTermName } from '@features/payment/utils/plan-term';

interface ComparisonColumn {
  plan: Plan;
  name: string;
  isDefault: boolean;
  isSelected: boolean;
  featureIds: ReadonlySet<string>;
}

@Component({
  selector: 'app-plan-comparison-table',
  imports: [NgIcon],
  templateUrl: './plan-comparison-table.html',
  host: { class: 'block' },
})
export class PlanComparisonTable {
  /** Already in CAIRA's `sort_order`. */
  readonly plans = input.required<Plan[]>();
  readonly selectedPlanId = input<string | null>(null);

  protected readonly proCrownIcon = proCrownIcon;

  // The default plan anchors the row order, so its column reads top to bottom as
  // designed; features only other plans have append below.
  protected readonly rows = computed<PlanFeature[]>(() => {
    const ordered = [...this.plans()].sort((a, b) => Number(b.is_default) - Number(a.is_default));
    const byId = new Map<string, PlanFeature>();
    for (const plan of ordered) for (const f of plan.features) byId.set(f.id, f);
    return [...byId.values()];
  });

  protected readonly columns = computed<ComparisonColumn[]>(() =>
    this.plans().map((plan) => ({
      plan,
      name: planTermName(plan.duration_months),
      isDefault: plan.is_default,
      isSelected: plan.id === this.selectedPlanId(),
      featureIds: new Set(plan.features.map((f) => f.id)),
    })),
  );

  protected readonly gridTemplate = computed(() => {
    const planCount = this.columns().length;
    return `1fr ${'6.5rem '.repeat(planCount).trim()}`;
  });
}
