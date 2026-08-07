import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Storage } from '../../services/storage/storage';
import { LoadingService } from '../../services/loading/loading';
import { LocationService } from '../../services/location/location.service';
import { SKIP_AUTH_TOKEN } from '../../models/http.model';
import { country } from '../../constant/country';
import { environment } from '../../../../../environments/environment';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(Storage);
  const loading = inject(LoadingService);
  const location = inject(LocationService);
  const router = inject(Router);

  // Start loading indicator
  loading.start();

  const skipAuth = req.context.get(SKIP_AUTH_TOKEN);

  // Country-scoped pricing: lowercase ISO2 on every request, defaulting to 'us'.
  // In PROD, derive it from the user's actual location (device timezone) since
  // the URL is user-editable and shouldn't drive pricing. In other envs, use the
  // URL `/:country/...` segment so testers can switch country by editing the URL.
  let iso2: string;
  if (environment.production) {
    iso2 = location.getUserCountry();
  } else {
    // iso2 = location.getUserCountry();
    const seg = router.url.split('/').filter(Boolean)[0]?.toLowerCase();
    iso2 = seg && country.includes(seg.toUpperCase()) ? seg : 'us';
  }

  // Build headers with default app info
  let headers = req.headers
    .set('x-app-type', environment.appType)
    .set('x-platform', environment.platform)
    .set('x-country-code', iso2);

  // Add Authorization header if token exists, unless this request opts out
  if (!skipAuth) {
    const accessToken = storage.getCookie(environment.AUTH.accessToken);
    if (accessToken) {
      headers = headers.set('Authorization', `bearer ${accessToken}`);
    }
  }

  // Clone request with new headers
  const clonedReq = req.clone({ headers });

  return next(clonedReq).pipe(
    finalize(() => {
      // Stop loading indicator when request completes (success or error)
      loading.stop();
    }),
  );
};
