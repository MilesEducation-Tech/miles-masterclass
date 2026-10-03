import { CanActivateFn, PRIMARY_OUTLET, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { PROFESSIONS } from '../constants/profession';
import { CountryContext } from '../services/country-context/country-context';
import { toCountry } from '../utils/country';

/**
 * Gate for the `:country/:profession_type` tree.
 *
 * - A supported, lower-case country passes untouched, whatever geo says.
 * - An unsupported (`/zz/...`, `/ke/...`) or upper-case (`/IN/...`) country has ONLY its segment
 *   swapped (for the visitor's current country, or the lower-case form). The rest of the path,
 *   the query string and the fragment survive, so a deep link isn't lost.
 * - An unknown profession has no deep link worth keeping → `/<country>/accounting`.
 */
export const validateProfessionCountryGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const router = inject(Router);

  const countryParam = route.paramMap.get('country') ?? '';
  const professionParam = route.paramMap.get('profession_type') ?? '';
  const country = toCountry(countryParam) ?? inject(CountryContext).current();

  if (!PROFESSIONS.some((p) => p.toLowerCase() === professionParam.toLowerCase())) {
    return router.createUrlTree(['/', country, 'accounting']);
  }

  if (country === countryParam) return true;

  const tree = router.parseUrl(state.url);
  tree.root.children[PRIMARY_OUTLET].segments[0].path = country;
  return tree;
};
