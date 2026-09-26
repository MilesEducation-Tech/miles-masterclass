import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FAQ } from '@core/models/faq.model';
import { Utils } from '@shared/services/utils';

import { WebinarFaq } from './webinar-faq';

const FAQS: FAQ[] = [
  {
    id: 1,
    question: 'Billing',
    content: [],
    children: [
      { id: 11, question: 'Refunds?', content: [{ type: 'text', value: 'Within 7 days.' }] },
      { id: 12, question: 'Invoices?', content: [{ type: 'text', value: 'From your profile.' }] },
    ],
  },
  { id: 2, question: 'Certificates', content: [{ type: 'text', value: 'After the exam.' }] },
];

describe('WebinarFaq', () => {
  let fixture: ComponentFixture<WebinarFaq>;
  let el: HTMLElement;

  const trigger = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(text),
    )!;
  const click = async (text: string) => {
    trigger(text).click();
    await fixture.whenStable();
  };
  const expanded = (text: string) => trigger(text).getAttribute('aria-expanded');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebinarFaq],
      providers: [{ provide: Utils, useValue: { country: () => 'us', profession: () => 'cpa' } }],
    }).compileComponents();
    fixture = TestBed.createComponent(WebinarFaq);
    fixture.componentRef.setInput('faqs', FAQS);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders every category collapsed, each panel a region labelled by its trigger', () => {
    expect(expanded('Billing')).toBe('false');
    expect(expanded('Certificates')).toBe('false');
    const panelId = trigger('Billing').getAttribute('aria-controls')!;
    const panel = el.querySelector(`[id="${panelId}"]`)!;
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-labelledby')).toBe(trigger('Billing').id);
  });

  it('opens one category at a time, and a second click closes it', async () => {
    await click('Billing');
    expect(expanded('Billing')).toBe('true');

    await click('Certificates');
    expect(expanded('Billing')).toBe('false');
    expect(expanded('Certificates')).toBe('true');

    await click('Certificates');
    expect(expanded('Certificates')).toBe('false');
  });

  it('opens one question at a time, and closes it when the category changes', async () => {
    await click('Billing');
    await click('Refunds?');
    expect(expanded('Refunds?')).toBe('true');

    await click('Invoices?');
    expect(expanded('Refunds?')).toBe('false');
    expect(expanded('Invoices?')).toBe('true');

    await click('Certificates');
    await click('Billing');
    expect(expanded('Invoices?')).toBe('false');
  });
});
