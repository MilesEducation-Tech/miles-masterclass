import { Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { PlanFeatureDetail, SubscriptionPlan } from '@core/models/payment.model';
import { proCrownIcon } from '../../constants/plan-icons';

interface ComparisonColumn {
  plan: SubscriptionPlan;
  isRecommended: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-plan-comparison-table',
  imports: [NgIcon],
  templateUrl: './plan-comparison-table.html',
  host: { class: 'block' },
})
export class PlanComparisonTable {
  readonly plans = input.required<SubscriptionPlan[]>();
  readonly selectedPlanId = input<number | null>(null);

  protected readonly proCrownIcon = proCrownIcon;

  // Recommended plan anchors the row order so the Pro column reads top-to-bottom
  // exactly as designed; features only present on other plans append below.
  protected readonly rows = computed<PlanFeatureDetail[]>(() => {
    const ordered = [...this.plans()].sort(
      (a, b) => Number(b.is_recommended) - Number(a.is_recommended),
    );
    const map = new Map<number, PlanFeatureDetail>();
    for (const plan of ordered) {
      for (const f of plan.features) {
        if (f.planfeature) map.set(f.planfeature.id, f.planfeature);
      }
    }
    return Array.from(map.values());
  });

  protected readonly columns = computed<ComparisonColumn[]>(() => {
    const ordered = [...this.plans()].sort(
      (a, b) => Number(b.is_recommended) - Number(a.is_recommended),
    );
    const selectedId = this.selectedPlanId();
    return ordered.map((plan) => ({
      plan,
      isRecommended: plan.is_recommended,
      isSelected: plan.id === selectedId,
    }));
  });

  protected readonly gridTemplate = computed(() => {
    const planCount = this.columns().length;
    return `1fr ${'6.5rem '.repeat(planCount).trim()}`;
  });

  protected planHasFeature(plan: SubscriptionPlan, featureId: number): boolean {
    return plan.features.some((f) => f.planfeature?.id === featureId);
  }
}
