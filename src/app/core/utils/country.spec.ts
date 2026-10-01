import { countryFromUrl, toCountry } from './country';

describe('toCountry', () => {
  it('accepts a supported country in any case and with stray whitespace', () => {
    expect(toCountry('in')).toBe('in');
    expect(toCountry('IN')).toBe('in');
    expect(toCountry(' De ')).toBe('de');
  });

  it('covers every launch market and Europe', () => {
    for (const cc of ['us', 'in', 'ae', 'ca', 'au', 'gb', 'fr', 'de', 'ch', 'no', 'cy']) {
      expect(toCountry(cc)).toBe(cc);
    }
  });

  // Vercel sends `XX` / `T1` for IPs it can't place; KE / CN are real but unsupported.
  it('rejects unknown, unsupported, empty and missing input', () => {
    for (const value of ['XX', 'T1', 'ke', 'cn', 'zz', 'usa', '', '  ', null, undefined]) {
      expect(toCountry(value)).toBeUndefined();
    }
  });
});

describe('countryFromUrl', () => {
  it('reads the country of a country-scoped URL, ignoring query and fragment', () => {
    expect(countryFromUrl('/in/accounting')).toBe('in');
    expect(countryFromUrl('/de/accounting/library?a=1#top')).toBe('de');
    expect(countryFromUrl('/IN/Accounting/home')).toBe('in');
  });

  it('is undefined outside the country tree', () => {
    for (const url of ['/', '', '/auth/login', '/compliance', '/admin/users', '/in']) {
      expect(countryFromUrl(url)).toBeUndefined();
    }
  });

  it('is undefined for an unsupported country, so it never replaces a good one', () => {
    expect(countryFromUrl('/zz/accounting/home')).toBeUndefined();
    expect(countryFromUrl('/ke/accounting')).toBeUndefined();
  });
});
