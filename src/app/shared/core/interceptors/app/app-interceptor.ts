import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { Storage } from '../../services/storage/storage';
import { LoadingService } from '../../services/loading/loading';
import { SKIP_AUTH_TOKEN } from '../../models/caira/envelope.model';
import { shouldAttachToken } from '../../http/caira.endpoints';
import { environment } from '../../../../../environments/environment';

/**
 * Drives the global loading bar and attaches the learner's access token.
 *
 * Two deliberate changes from the interceptor this replaces:
 *
 * 1. **The three `x-*` headers are gone.** It used to send `x-app-type`,
 *    `x-platform` and `x-country-code` on every request. CAIRA reads exactly one
 *    header — `Authorization` — and its `CORS_ALLOW_HEADERS` allowlist does not
 *    include any of the three, so each one would fail the preflight and take the
 *    whole request with it. `x-country-code` also had no meaning left: no CAIRA
 *    endpoint takes a country or profession parameter, which is why the
 *    `/:country/:profession_type` URL prefix is now cosmetic.
 *
 * 2. **The token is attached only to CAIRA requests**, rather than to everything
 *    that did not opt out. Opt-out defaults leak: the old rule would have sent a
 *    CAIRA bearer token to WordPress and S3 the moment someone forgot the
 *    `SKIP_AUTH_TOKEN` flag. Matching on `BASE_API_URL` makes the safe case the
 *    default and needs no per-call-site discipline.
 */
export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(Storage);
  const loading = inject(LoadingService);

  loading.start();

  let request = req;
  if (shouldAttachToken(req.url, environment.BASE_API_URL, req.context.get(SKIP_AUTH_TOKEN))) {
    const accessToken = storage.getCookie(environment.AUTH.accessToken);
    if (accessToken) {
      // `USP/authentication.py` lower-cases the prefix before comparing, so
      // either casing works; `Bearer` is the spec form.
      request = req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
    }
  }

  return next(request).pipe(finalize(() => loading.stop()));
};
