import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForPartnershipTabs } from './for-partnership-tabs';

describe('ForPartnershipTabs', () => {
  let component: ForPartnershipTabs;
  let fixture: ComponentFixture<ForPartnershipTabs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForPartnershipTabs],
    }).compileComponents();

    fixture = TestBed.createComponent(ForPartnershipTabs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
