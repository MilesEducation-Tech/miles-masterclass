import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SliderSkeleton } from './slider-skeleton';

describe('SliderSkeleton', () => {
  let component: SliderSkeleton;
  let fixture: ComponentFixture<SliderSkeleton>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SliderSkeleton],
    }).compileComponents();

    fixture = TestBed.createComponent(SliderSkeleton);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
