import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqItem } from './faq-item';
import { FAQ } from '@core/models/faq.model';

const FAQ_ITEM: FAQ = {
  id: 1,
  question: 'How do I earn CPE credits?',
  content: [{ type: 'text', value: 'Finish every chapter and pass the final assessment.' }],
};

describe('FaqItem', () => {
  let component: FaqItem;
  let fixture: ComponentFixture<FaqItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqItem],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqItem);
    fixture.componentRef.setInput('faq', FAQ_ITEM);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
