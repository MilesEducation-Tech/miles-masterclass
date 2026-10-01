import { PlatformLocation } from '@angular/common';
import { MOCK_PLATFORM_LOCATION_CONFIG, MockPlatformLocation } from '@angular/common/testing';
import { REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Storage } from '../storage/storage';
import { CountryContext } from './country-context';

interface Setup {
  /** Path the app was opened at. */
  url?: string;
  /** `x-vercel-ip-country`; omitted = no header (browser, or local dev). */
  header?: string;
  /** `geo_country` cookie value. */
  cookie?: string;
}

function setup({ url = '/', header, cookie = '' }: Setup = {}): CountryContext {
  // Several cases build more than one context in a single test.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'auth/login', children: [] },
        { path: ':country/:profession_type', children: [{ path: '**', children: [] }] },
      ]),
      { provide: MOCK_PLATFORM_LOCATION_CONFIG, useValue: { startUrl: `http://localhost${url}` } },
      { provide: PlatformLocation, useClass: MockPlatformLocation },
      {
        provide: REQUEST,
        useValue: header ? { headers: new Headers({ 'x-vercel-ip-country': header }) } : null,
      },
      {
        provide: Storage,
        useValue: { getCookie: (k: string) => (k === 'geo_country' ? cookie : '') },
      },
    ],
  });
  return TestBed.inject(CountryContext);
}

describe('CountryContext', () => {
  describe('initial country', () => {
    // The precedence that keeps crawlers (who arrive from US IPs) able to index /in/, /de/, …
    it('takes a supported URL country over geo', () => {
      expect(setup({ url: '/de/accounting/home', header: 'IN' }).current()).toBe('de');
    });

    it('detects when the URL has no country', () => {
      expect(setup({ url: '/', header: 'IN' }).current()).toBe('in');
      expect(setup({ url: '/auth/login', header: 'AE' }).current()).toBe('ae');
    });

    it('detects when the URL country is unsupported', () => {
      expect(setup({ url: '/zz/accounting', header: 'CA' }).current()).toBe('ca');
    });
  });

  describe('detect()', () => {
    it('reads the edge header on the server', () => {
      expect(setup({ header: 'gb' }).detect()).toBe('gb');
    });

    it('prefers the header to a stale cookie', () => {
      expect(setup({ header: 'IN', cookie: 'de' }).detect()).toBe('in');
    });

    it('reads the geo cookie when there is no header (the browser)', () => {
      expect(setup({ cookie: 'au' }).detect()).toBe('au');
    });

    it('falls back to us for unknown, unsupported or missing geo', () => {
      expect(setup({ header: 'XX' }).detect()).toBe('us');
      expect(setup({ header: 'KE', cookie: 'zz' }).detect()).toBe('us');
      expect(setup().detect()).toBe('us');
    });
  });

  describe('navigation', () => {
    it('follows the URL country and keeps it on scope-less and unsupported URLs', async () => {
      const ctx = setup({ url: '/', header: 'IN' });
      const router = TestBed.inject(Router);

      await router.navigateByUrl('/de/accounting/library');
      expect(ctx.current()).toBe('de');

      await router.navigateByUrl('/auth/login');
      expect(ctx.current()).toBe('de');

      // The guard redirects these in the app; without it the country must still never go invalid.
      await router.navigateByUrl('/zz/accounting');
      expect(ctx.current()).toBe('de');

      await router.navigateByUrl('/ae/accounting');
      expect(ctx.current()).toBe('ae');
    });
  });
});
