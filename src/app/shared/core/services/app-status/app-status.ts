import { httpResource } from '@angular/common/http';
import { Service, computed, inject } from '@angular/core';
import { ApiClient } from '../api-client/api-client';
import { Auth } from '../auth/auth';
import { CAIRA } from '../../http/caira.endpoints';
import { cairaError } from '../../http/caira-error';
import {
  AppStatusResponse,
  AppStatusVerdict,
  appStatusVerdict,
} from '../../models/caira/app-status.model';

/**
 * L2 · `GET web/app-status/` — the post-login gate.
 *
 * The shipped CAIRA LMS calls this after every successful login and again on
 * the course page, and routes the learner to maintenance, pathway selection or
 * onboarding before letting them in. This is the miles-masterclass counterpart.
 *
 * Structured like `Auth` (AGENTS.md §3): one reactive root — the session — and
 * an `httpResource` keyed on it. The URL is `undefined` while anonymous, which
 * is the "nothing to fetch yet" case the pattern is for, not the
 * `Auth.isAuthenticated()` gate the course reads were told to avoid: there is
 * genuinely no such thing as an app status for a signed-out visitor, and
 * signing out aborts whatever is in flight for free.
 */
@Service()
export class AppStatus {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(Auth);

  private readonly status = httpResource<AppStatusResponse | undefined>(
    () => (this.auth.isAuthenticated() ? this.api.absoluteUrl(CAIRA.appStatus) : undefined),
    { defaultValue: undefined },
  );

  readonly isLoading = this.status.isLoading;

  /** Classified failure, for a caller that wants to distinguish 403 from 500. */
  readonly failure = computed(() => {
    const err = this.status.error();
    return err ? cairaError(err) : null;
  });

  /**
   * What to do about the learner's account state.
   *
   * `error()` is read before `value()` — `value()` throws `ResourceValueError`
   * once the resource has failed, and this computed feeds a guard that runs on
   * every navigation.
   *
   * **A failed read resolves to `'ok'`, deliberately.** An unreachable gate is
   * not a closed gate: a 500 on this endpoint must not strand every signed-in
   * learner on the maintenance page. The failure is still readable above.
   */
  readonly verdict = computed<AppStatusVerdict>(() => {
    if (this.status.error()) return 'ok';
    return appStatusVerdict(this.status.value());
  });

  readonly isBlocked = computed(() => this.verdict() !== 'ok');

  /**
   * Re-read the gate. Needed after the learner finishes onboarding or picks a
   * pathway — both change the answer without changing the token, so the
   * resource cannot notice on its own.
   */
  reload(): void {
    this.status.reload();
  }
}
