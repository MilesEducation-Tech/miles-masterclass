import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { CountryContext } from '../services/country-context/country-context';

/**
 * `/` → `/<country>/accounting`. A first page load of `/` never gets here: Express answers it
 * before Angular renders (`src/geo-country.ts`). This runs for in-app navigations to `/` (the
 * header logo, `navigateByUrl('/')`), where it keeps the visitor in the country they are browsing.
 */
export const rootRedirectGuard: CanActivateFn = () =>
  inject(Router).createUrlTree(['/', inject(CountryContext).current(), 'accounting']);
