import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { PROFESSIONS } from '../constants/profession';
import { timezone } from '../constants/timezone';

export const validateProfessionCountryGuard: CanActivateFn = (route, _state): boolean | UrlTree => {
  const router = inject(Router);

  const countryParam = route.paramMap.get('country');
  const professionParam = route.paramMap.get('profession_type');

  if (!countryParam || !professionParam) {
    return router.createUrlTree(['/', 'us', 'accounting']);
  }

  const isValidCountry = timezone.some(
    (l) => l.iso2 && l.iso2.toLowerCase() === countryParam.toLowerCase(),
  );
  const isValidProfession = PROFESSIONS.some(
    (p) => p.toLowerCase() === professionParam.toLowerCase(),
  );

  if (isValidCountry && isValidProfession) {
    return true;
  }

  // Fallback to default
  return router.createUrlTree(['/', 'us', 'accounting']);
};
