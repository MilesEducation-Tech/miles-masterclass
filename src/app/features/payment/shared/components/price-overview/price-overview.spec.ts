import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PriceOverview } from './price-overview';

describe('PriceOverview', () => {
  let component: PriceOverview;
  let fixture: ComponentFixture<PriceOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceOverview],
    }).compileComponents();

    fixture = TestBed.createComponent(PriceOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
