import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../../services/notification/notification';
import { Logger } from '../../services/logger/logger';
import { SKIP_ERROR_NOTIFICATION } from '../../models/caira/envelope.model';
import { cairaError, userMessage } from '../../http/caira-error';

/**
 * Classifies every failure and decides — in one place — whether the user should
 * see it.
 *
 * The rule is: **only `kind: 'unexpected'` raises a toast.** Everything else is
 * either a UI state the feature renders itself, or something a facade handles.
 *
 * That distinction is the whole reason this interceptor exists. A large share of
 * CAIRA's non-2xx responses are ordinary navigation:
 *
 * - 403 `chapter_locked` — the learner clicked a chapter they have not unlocked
 * - 403 `cool_off_active` — a retry countdown, with the minutes in the body
 * - 403 `assessment_not_passed` / `feedback_already_submitted` — sequencing
 * - 409 `already_started_via_7dc` — a partner-flow conflict with its own copy
 *
 * The interceptor this replaces toasted `error?.error?.message ?? 'Something
 * went wrong'` for any status other than 401, which would have put
 * "Something went wrong" on screen during all of the above — those bodies carry
 * `reason`, not `message`.
 *
 * The error is always re-thrown unchanged so facades can call `cairaError()`
 * again and switch on `kind`. Same input, same answer.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notification = inject(NotificationService);
  const logger = inject(Logger);

  return next(req).pipe(
    catchError((error: unknown) => {
      const failure = cairaError(error);

      // Log everything, including the states we do not toast — a burst of
      // `chapter_locked` is a real signal that the lock walk disagrees with
      // what the UI is showing.
      logger.error(`[caira] ${req.method} ${stripQuery(req.url)} → ${failure.kind}`, failure);

      if (failure.kind === 'unexpected' && !req.context.get(SKIP_ERROR_NOTIFICATION)) {
        // `userMessage` deliberately does not echo the server's text here:
        // several CAIRA 500 handlers return `str(exc)` verbatim, so the body can
        // be a raw Python traceback line. It went to the Logger above; the user
        // gets generic copy.
        notification.error('Error', userMessage(failure));
      }

      return throwError(() => error);
    }),
  );
};

/** Query strings can carry ids and emails; keep them out of the log line. */
function stripQuery(url: string): string {
  return url.split('?')[0];
}
