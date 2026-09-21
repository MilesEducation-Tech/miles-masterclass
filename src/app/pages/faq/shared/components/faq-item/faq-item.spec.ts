import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqItem } from './faq-item';

describe('FaqItem', () => {
  let component: FaqItem;
  let fixture: ComponentFixture<FaqItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqItem],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqItem);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
