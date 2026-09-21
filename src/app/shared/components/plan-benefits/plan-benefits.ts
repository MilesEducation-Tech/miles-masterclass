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
  /**
   * Tailwind size classes for the benefit icon. Defaults to the original
   * `w-5 h-5`. NgIcon sets its own `1em` box that plain `w-*`/`h-*` lose to,
   * so a caller that actually wants a bigger tick must pass the important
   * modifier (e.g. `size-6!`), as CPA Canada does.
   */
  readonly iconClass = input<string>('w-5 h-5');

  protected iconSvg(icon: BenefitIconKey | null | undefined): string {
    return BENEFIT_ICONS[icon ?? 'default.svg'];
  }
}
