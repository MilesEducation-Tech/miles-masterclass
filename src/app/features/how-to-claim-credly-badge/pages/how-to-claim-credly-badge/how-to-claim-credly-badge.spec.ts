import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HowToClaimCredlyBadge } from './how-to-claim-credly-badge';

describe('HowToClaimCredlyBadge', () => {
  let component: HowToClaimCredlyBadge;
  let fixture: ComponentFixture<HowToClaimCredlyBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HowToClaimCredlyBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(HowToClaimCredlyBadge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
