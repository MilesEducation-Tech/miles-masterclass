import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewWrapper } from './overview-wrapper';

describe('OverviewWrapper', () => {
  let component: OverviewWrapper;
  let fixture: ComponentFixture<OverviewWrapper>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewWrapper],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewWrapper);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
