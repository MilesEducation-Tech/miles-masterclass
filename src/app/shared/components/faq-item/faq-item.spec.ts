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

  const trigger = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  const panel = () => fixture.nativeElement.querySelector('[ngpCollapsibleContent]') as HTMLElement;

  it('wires the trigger to its panel through the primitive', () => {
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(panel().id).toBeTruthy();
    expect(trigger().getAttribute('aria-controls')).toBe(panel().id);
    expect(panel().hasAttribute('data-closed')).toBe(true);
  });

  it('multi mode: a click opens and closes the item on its own', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel().hasAttribute('data-open')).toBe(true);

    trigger().click();
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('single mode: a click asks the parent, and only openFaqId opens the item', async () => {
    const toggled = vi.fn();
    component.faqToggled.subscribe(toggled);
    fixture.componentRef.setInput('mode', 'single');
    await fixture.whenStable();

    trigger().click();
    await fixture.whenStable();
    expect(toggled).toHaveBeenCalledWith(FAQ_ITEM.id);
    // Nothing opens until the parent answers through openFaqId.
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    fixture.componentRef.setInput('openFaqId', FAQ_ITEM.id);
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');

    fixture.componentRef.setInput('openFaqId', null);
    await fixture.whenStable();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});
