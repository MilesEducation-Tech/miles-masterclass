import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanSelectionCard } from './plan-selection-card';
import { SubscriptionPlan } from '../../../../../shared/core/models/payment.model';

function makePlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    plan_duration: 12,
    subscription_type: null,
    is_unlimited_trial_enabled: false,
    subscription_name: 'Pro',
    price_detail: {
      base_price: 2400,
      selling_price: 1200,
      currency_code: 'USD',
      currency_symbol: '$',
      discount: 1200,
      discount_percent: 50,
      discount_type: 'amount',
      emi_available: true,
    },
    ...overrides,
  } as unknown as SubscriptionPlan;
}

describe('PlanSelectionCard', () => {
  let fixture: ComponentFixture<PlanSelectionCard>;

  function priceText(): string {
    // The price paragraph is the second <p> in the card.
    const paras = fixture.nativeElement.querySelectorAll('p');
    return (paras[1]?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlanSelectionCard] }).compileComponents();
    fixture = TestBed.createComponent(PlanSelectionCard);
  });

  it('shows the full yearly price by default with base struck-through', () => {
    fixture.componentRef.setInput('plan', makePlan());
    fixture.detectChanges();
    const text = priceText();
    expect(text).toContain('$1,200'); // selling_price, visible
    expect(text).toContain('$2,400'); // base_price, struck-through
    expect(text).toContain('/year');
    expect(fixture.nativeElement.querySelector('.line-through')).toBeTruthy();
  });

  it('divides both prices by 12 in monthly mode', () => {
    fixture.componentRef.setInput('plan', makePlan());
    fixture.componentRef.setInput('billingCycle', 'monthly');
    fixture.detectChanges();
    const text = priceText();
    expect(text).toContain('$100'); // 1200 / 12
    expect(text).toContain('$200'); // 2400 / 12, struck-through
    expect(text).toContain('/mo');
  });

  it('divides on monthly even when the flag is off (page-level guard owns availability)', () => {
    const plan = makePlan();
    plan.price_detail!.emi_available = false;
    fixture.componentRef.setInput('plan', plan);
    fixture.componentRef.setInput('billingCycle', 'monthly');
    fixture.detectChanges();
    const text = priceText();
    expect(text).toContain('$100'); // 1200 / 12
    expect(text).toContain('/mo');
  });
});
