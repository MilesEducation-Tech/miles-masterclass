import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AriaTabs } from './aria-tabs';

describe('AriaTabs', () => {
  let component: AriaTabs;
  let fixture: ComponentFixture<AriaTabs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AriaTabs],
    }).compileComponents();

    fixture = TestBed.createComponent(AriaTabs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
