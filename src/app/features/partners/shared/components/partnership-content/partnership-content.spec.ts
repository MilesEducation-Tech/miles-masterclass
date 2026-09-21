import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PartnershipContent } from './partnership-content';

describe('PartnershipContent', () => {
  let component: PartnershipContent;
  let fixture: ComponentFixture<PartnershipContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartnershipContent],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnershipContent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
