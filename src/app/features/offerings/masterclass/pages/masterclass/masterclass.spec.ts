import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Masterclass } from './masterclass';

describe('Masterclass', () => {
  let component: Masterclass;
  let fixture: ComponentFixture<Masterclass>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Masterclass],
    }).compileComponents();

    fixture = TestBed.createComponent(Masterclass);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
