import type { Language } from '../models/language.model';
import { parseAcceptLanguage, pickLanguage, toLanguage } from './language';

const ALL: readonly Language[] = ['en', 'ar', 'fr', 'de', 'es'];

describe('toLanguage', () => {
  it('reduces a tag to its primary subtag, in any case', () => {
    expect(toLanguage('fr-CA', ALL)).toBe('fr');
    expect(toLanguage('ar_AE', ALL)).toBe('ar');
    expect(toLanguage(' DE ', ALL)).toBe('de');
    expect(toLanguage('es-419', ALL)).toBe('es');
  });

  it('rejects unknown, empty and missing tags', () => {
    for (const tag of ['it', 'xx', '', '  ', '*', null, undefined]) {
      expect(toLanguage(tag, ALL)).toBeUndefined();
    }
  });

  // A language listed in the code but not yet enabled in this build must never be picked.
  it('rejects a known language that this build has not enabled', () => {
    expect(toLanguage('ar', ['en', 'fr'])).toBeUndefined();
  });
});

describe('pickLanguage', () => {
  it('takes the first enabled language in preference order', () => {
    expect(pickLanguage(['it-IT', 'ar', 'fr'], ['en', 'fr'])).toBe('fr');
    expect(pickLanguage(['es-MX', 'en'], ALL)).toBe('es');
  });

  it('is undefined when nothing is enabled', () => {
    expect(pickLanguage(['it', 'ja'], ALL)).toBeUndefined();
    expect(pickLanguage([], ALL)).toBeUndefined();
  });
});

describe('parseAcceptLanguage', () => {
  it('orders by weight, keeping sent order for equal weights', () => {
    expect(parseAcceptLanguage('en;q=0.5, fr-CA, fr;q=0.9, de;q=0.9')).toEqual([
      'fr-CA',
      'fr',
      'de',
      'en',
    ]);
  });

  it('drops q=0, unreadable weights, the wildcard and blanks', () => {
    expect(parseAcceptLanguage('ar;q=0, *;q=0.5, es;q=abc, , de')).toEqual(['de']);
  });

  it('is empty for a missing header', () => {
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });
});
