import { formatNumber } from '@angular/common';
import { ApplicationInitStatus, DOCUMENT, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Language, TextDirection } from '@core/models/language.model';
import { LanguageContext } from '@core/services/language-context/language-context';
import { provideLanguage } from './language';

async function boot(current: Language, dir: TextDirection = 'ltr'): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [provideLanguage(), { provide: LanguageContext, useValue: { current, dir } }],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
  return TestBed.inject(DOCUMENT).documentElement;
}

describe('provideLanguage', () => {
  afterEach(() => {
    const html = TestBed.inject(DOCUMENT).documentElement;
    html.lang = 'en';
    html.removeAttribute('dir');
  });

  // English must be byte-for-byte what it was before: Angular's own default locale, no `dir`.
  it('leaves English exactly as it was', async () => {
    const html = await boot('en');
    expect(TestBed.inject(LOCALE_ID)).toBe('en-US');
    expect(html.lang).toBe('en');
    expect(html.hasAttribute('dir')).toBe(false);
  });

  it('formats with the visitor’s language once its locale data has loaded', async () => {
    const html = await boot('fr');
    expect(TestBed.inject(LOCALE_ID)).toBe('fr');
    expect(html.lang).toBe('fr');
    // Throws "Missing locale data" if the lazy registration didn't happen before first use.
    expect(formatNumber(1234.5, 'fr')).toMatch(/^1\s234,5$/);
  });

  it('turns the page right to left for Arabic', async () => {
    const html = await boot('ar', 'rtl');
    expect(html.lang).toBe('ar');
    expect(html.dir).toBe('rtl');
  });
});
