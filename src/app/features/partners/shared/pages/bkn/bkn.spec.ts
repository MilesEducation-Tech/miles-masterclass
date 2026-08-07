import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bkn } from './bkn';

describe('Bkn', () => {
  let component: Bkn;
  let fixture: ComponentFixture<Bkn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bkn],
    }).compileComponents();

    fixture = TestBed.createComponent(Bkn);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
