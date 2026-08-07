import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MicroLearning } from './micro-learning';

describe('MicroLearning', () => {
  let component: MicroLearning;
  let fixture: ComponentFixture<MicroLearning>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MicroLearning],
    }).compileComponents();

    fixture = TestBed.createComponent(MicroLearning);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
