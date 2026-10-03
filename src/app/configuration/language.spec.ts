import { formatNumber } from '@angular/common';
import { ApplicationInitStatus, DOCUMENT, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

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
    const document = TestBed.inject(DOCUMENT);
    const html = document.documentElement;
    html.lang = 'en';
    html.removeAttribute('dir');
    html.style.removeProperty('--font-sans');
    document.getElementById('font-arabic')?.remove();
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

  // Loaded before the first render, so nothing renders as a raw key or flashes in English.
  it('has the visitor’s translations ready before the app renders', async () => {
    await boot('de');
    const transloco = TestBed.inject(TranslocoService);
    expect(transloco.getActiveLang()).toBe('de');
    expect(transloco.translate('language.label')).toBe('Sprache');
  });

  it('serves English from the bundle', async () => {
    await boot('en');
    expect(TestBed.inject(TranslocoService).translate('language.label')).toBe('Language');
  });

  it('turns the page right to left for Arabic', async () => {
    const html = await boot('ar', 'rtl');
    expect(html.lang).toBe('ar');
    expect(html.dir).toBe('rtl');
  });

  // None of the app's fonts has Arabic glyphs; every other language must not pay for one.
  it('loads an Arabic font for Arabic pages only', async () => {
    const html = await boot('ar', 'rtl');
    const link = TestBed.inject(DOCUMENT).getElementById('font-arabic') as HTMLLinkElement | null;
    expect(link?.href).toContain('family=Noto+Sans+Arabic');
    expect(html.style.getPropertyValue('--font-sans')).toContain('Noto Sans Arabic');
  });

  it('adds no font for any other language', async () => {
    const html = await boot('fr');
    expect(TestBed.inject(DOCUMENT).getElementById('font-arabic')).toBeNull();
    expect(html.style.getPropertyValue('--font-sans')).toBe('');
  });
});
