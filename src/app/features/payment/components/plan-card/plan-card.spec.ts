import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanCard } from './plan-card';
import { SubscriptionPlan } from '@core/models/payment.model';

const PLAN: SubscriptionPlan = {
  id: 1,
  features: [
    { id: 1, planfeature: { id: 1, name: 'Unlimited masterclasses', description: null, icon: '' } },
  ],
  is_added_to_cart: false,
  is_in_myorder: null,
  min_remaining_days: 0,
  price_detail: {
    base_price: 399,
    selling_price: 299,
    currency_code: 'USD',
    discount: 100,
    currency_symbol: '$',
    discount_percent: 25,
    discount_type: 'percentage',
    emi_available: true,
  },
  is_old_subscriber: false,
  iap_details: { apple_product_id: null, google_product_id: null },
  is_partner_code_applied: false,
  is_firm_sponsorship_applied: false,
  created_at: '2025-01-15T00:00:00Z',
  subscription_name: 'Annual',
  plan_duration: 365,
  free_trial_days: 7,
  subscription_type: 'annual',
  is_unlimited_trial_enabled: false,
  valid_from: null,
  valid_to: null,
  description: 'Every masterclass, podcast and micro-learning reel for a year.',
  plan_sorting_order: 1,
  is_active: true,
  is_recommended: true,
  apple_inapp_product_id: null,
  stripe_price_id_year1: null,
  stripe_price_id_year2: null,
  google_inapp_product_id: null,
  is_trial_activated_on_android: false,
  is_trial_activated_on_ios: false,
  updated_by: 1,
};

describe('PlanCard', () => {
  let component: PlanCard;
  let fixture: ComponentFixture<PlanCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanCard],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanCard);
    fixture.componentRef.setInput('plan', PLAN);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
