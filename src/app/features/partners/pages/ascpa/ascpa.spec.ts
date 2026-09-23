import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ascpa } from './ascpa';

describe('Ascpa', () => {
  let component: Ascpa;
  let fixture: ComponentFixture<Ascpa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ascpa],
    }).compileComponents();

    fixture = TestBed.createComponent(Ascpa);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
