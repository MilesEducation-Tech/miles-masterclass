import { Injectable } from '@angular/core';
import { CurrentPlanData } from '@core/models/payment.model';

export type AccessDecision = 'allow' | 'upsellTrial' | 'claimPrompt';

/**
 * Pure policy: decide whether a user can download a certificate, should be
 * prompted to upgrade their plan, or is eligible to claim one first.
 */
@Injectable({
  providedIn: 'root',
})
export class CertificateAccessPolicy {
  decide(plan: CurrentPlanData | null): AccessDecision {
    if (!plan) return 'upsellTrial';
    if (plan.subscription_status.toLocaleLowerCase() !== 'active') return 'upsellTrial';

    // const certificateUrl = row.assessment?.certificate_url;
    // if (certificateUrl)
    return 'allow';
    // return 'claimPrompt';
  }

  decideBulk(plan: CurrentPlanData | null): AccessDecision {
    if (!plan) return 'upsellTrial';
    if (plan.trial_duration && plan.trial_duration > 0) return 'upsellTrial';
    if (plan.subscription_status.toLocaleLowerCase() !== 'active') return 'upsellTrial';
    return 'allow';
  }
}
