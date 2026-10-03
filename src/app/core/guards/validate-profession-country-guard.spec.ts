import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';

import { CountryContext } from '../services/country-context/country-context';
import { CountryCode } from '../models/route-params.model';
import { rootRedirectGuard } from './root-redirect-guard';
import { validateProfessionCountryGuard } from './validate-profession-country-guard';

describe('country guards', () => {
  const current = signal<CountryCode>('in');

  beforeEach(() => {
    current.set('in');
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CountryContext, useValue: { current } }],
    });
  });

  const serialize = (result: unknown): string => {
    expect(result).toBeInstanceOf(UrlTree);
    return TestBed.inject(Router).serializeUrl(result as UrlTree);
  };

  describe('validateProfessionCountryGuard', () => {
    /** Run the guard for a URL whose first two segments are the route params. */
    const run = (url: string): unknown => {
      const [country, profession_type] = url.split(/[/?#]/).filter(Boolean);
      const route = {
        paramMap: convertToParamMap({ country, profession_type }),
      } as ActivatedRouteSnapshot;
      return TestBed.runInInjectionContext(() =>
        validateProfessionCountryGuard(route, { url } as RouterStateSnapshot),
      );
    };

    it('lets a supported country through whatever the visitor’s own country is', () => {
      expect(run('/de/accounting/library')).toBe(true);
      expect(run('/us/accounting')).toBe(true);
    });

    it('swaps only an unsupported country, keeping path, query and fragment', () => {
      expect(serialize(run('/zz/accounting/library/course-library?a=1#top'))).toBe(
        '/in/accounting/library/course-library?a=1#top',
      );
      expect(serialize(run('/ke/accounting/masterclass/42/x'))).toBe(
        '/in/accounting/masterclass/42/x',
      );
    });

    it('lower-cases a supported country instead of replacing it', () => {
      expect(serialize(run('/DE/accounting/home'))).toBe('/de/accounting/home');
    });

    it('sends an unknown profession to the country home', () => {
      expect(serialize(run('/de/banking/home'))).toBe('/de/accounting');
      expect(serialize(run('/zz/banking'))).toBe('/in/accounting');
    });
  });

  describe('rootRedirectGuard', () => {
    it('keeps an in-app visit to / in the current country', () => {
      current.set('ae');
      const result = TestBed.runInInjectionContext(() =>
        rootRedirectGuard({} as never, {} as never),
      );
      expect(serialize(result)).toBe('/ae/accounting');
    });
  });
});
