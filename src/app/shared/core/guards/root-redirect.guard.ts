import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LocationService } from '../services/location/location.service';

export const rootRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const locationService = inject(LocationService);

  const country = locationService.getUserCountry();
  const defaultProfession = 'accounting';

  return router.createUrlTree(['/', country, defaultProfession]);
};
