import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Carousel } from './carousel';
import { MOCK_CARDS } from '../../../testing/mocks/content.mock';

describe('Carousel', () => {
  let component: Carousel;
  let fixture: ComponentFixture<Carousel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Carousel],
    }).compileComponents();

    fixture = TestBed.createComponent(Carousel);
    // `cards` is `input.required`, so it has to be set before the first change
    // detection or the component throws NG0950.
    fixture.componentRef.setInput('cards', MOCK_CARDS);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
