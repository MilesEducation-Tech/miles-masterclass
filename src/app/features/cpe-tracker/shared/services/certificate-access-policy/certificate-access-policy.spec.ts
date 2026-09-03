import { TestBed } from '@angular/core/testing';
import { CertificateAccessPolicy } from './certificate-access-policy';
import { CurrentPlanData } from '../../../../../shared/core/models/auth.model';

const activePlan: CurrentPlanData = {
  id: 1,
  remaining_days: 30,
  paid_amount: 99,
  transaction_mode: 'card',
  subscription_status: 'active',
  trial_duration: null,
  current_time: '2026-04-23T00:00:00Z',
  platform: 'web',
  valid_from: '2026-01-01',
  valid_to: '2027-01-01',
};

const trialPlan: CurrentPlanData = { ...activePlan, trial_duration: 7 };
const cancelledPlan: CurrentPlanData = { ...activePlan, subscription_status: 'cancelled' };

describe('CertificateAccessPolicy', () => {
  let policy: CertificateAccessPolicy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    policy = TestBed.inject(CertificateAccessPolicy);
  });

  it('decide: upsells when there is no plan', () => {
    expect(policy.decide(null)).toBe('upsellTrial');
  });

  it('decide: upsells when subscription is inactive', () => {
    expect(policy.decide(cancelledPlan)).toBe('upsellTrial');
  });

  it('decide: allows when plan is active', () => {
    expect(policy.decide(activePlan)).toBe('allow');
  });

  // The row-based "claimPrompt" branch was disabled in the impl (the commented
  // certificate_url check). Re-enable this assertion once the row parameter
  // returns; today, an active plan unconditionally maps to 'allow'.
  it.skip('decide: prompts claim when plan is active but no certificate_url', () => {
    // expect(policy.decide(activePlan, rowWithoutCert)).toBe('claimPrompt');
  });

  it('decideBulk: upsells for trial users even if subscription is active', () => {
    expect(policy.decideBulk(trialPlan)).toBe('upsellTrial');
  });

  it('decideBulk: upsells when no plan', () => {
    expect(policy.decideBulk(null)).toBe('upsellTrial');
  });

  it('decideBulk: allows active, non-trial plans', () => {
    expect(policy.decideBulk(activePlan)).toBe('allow');
  });
});
