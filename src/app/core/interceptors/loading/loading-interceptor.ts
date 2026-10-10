import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize } from 'rxjs';
import { IS_EXTERNAL_REQUEST, SKIP_LOADING } from '../../models/http.model';
import { LoadingService } from '../../services/loading/loading';

/**
 * Drives the global loading bar: every request counts unless it is tagged
 * `SKIP_LOADING` (background traffic) or `IS_EXTERNAL_REQUEST` (a third-party
 * call the learner never sees).
 *
 * First in the chain (`app.config.ts`), so the count also covers what the later
 * interceptors wait on, such as `appInterceptor`'s token refresh.
 *
 * The count starts on subscribe, not when the chain is assembled, and the inner
 * `defer` routes a synchronous throw from a later interceptor through
 * `finalize`. So success, error, cancel and unsubscribe all release it.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING) || req.context.get(IS_EXTERNAL_REQUEST)) return next(req);

  const loading = inject(LoadingService);
  return defer(() => {
    const stop = loading.start();
    return defer(() => next(req)).pipe(finalize(stop));
  });
};
