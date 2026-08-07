import { Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { BENEFIT_ICONS, BenefitIconKey } from './benefit-icons';

export interface PlanFeature {
  name: string;
  description?: string | null;
  /** Filename of one of the SVGs in `BENEFIT_ICONS`. Falls back to `'default.svg'`. */
  icon?: BenefitIconKey | null;
}

export interface PlanPointer {
  id: number;
  planfeature: PlanFeature;
}

@Component({
  selector: 'app-plan-benefits',
  imports: [NgIcon],
  templateUrl: './plan-benefits.html',
})
export class PlanBenefits {
  /**
   * Plain-text heading. Omit it only when projecting richer markup into the
   * `slot="heading"` content slot instead (e.g. to color part of the heading).
   */
  readonly heading = input<string>('');
  readonly planPointers = input.required<readonly PlanPointer[]>();

  protected iconSvg(icon: BenefitIconKey | null | undefined): string {
    return BENEFIT_ICONS[icon ?? 'default.svg'];
  }
}
