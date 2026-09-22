import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqContent } from './faq-content';
import { FAQContent } from '../../../../../shared/core/models/faq.model';

const CONTENT: FAQContent[] = [
  { type: 'heading', value: 'Claiming your credits', level: 2 },
  { type: 'text', value: 'Credits post to your tracker once the final assessment is passed.' },
  { type: 'list', items: ['Watch every chapter', 'Pass each chapter quiz'], ordered: true },
];

describe('FaqContent', () => {
  let component: FaqContent;
  let fixture: ComponentFixture<FaqContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqContent],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqContent);
    fixture.componentRef.setInput('content', CONTENT);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
