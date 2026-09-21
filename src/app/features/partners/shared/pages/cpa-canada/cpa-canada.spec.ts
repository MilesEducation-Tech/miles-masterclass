import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CpaCanada } from './cpa-canada';

describe('CpaCanada', () => {
  let component: CpaCanada;
  let fixture: ComponentFixture<CpaCanada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CpaCanada],
    }).compileComponents();

    fixture = TestBed.createComponent(CpaCanada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
