import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Ctcpa } from './ctcpa';

describe('Ctcpa', () => {
  let component: Ctcpa;
  let fixture: ComponentFixture<Ctcpa>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ctcpa],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Ctcpa);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
