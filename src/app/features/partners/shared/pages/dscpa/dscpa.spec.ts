import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dscpa } from './dscpa';

describe('Dscpa', () => {
  let component: Dscpa;
  let fixture: ComponentFixture<Dscpa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dscpa],
    }).compileComponents();

    fixture = TestBed.createComponent(Dscpa);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
