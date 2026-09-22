import { httpResource } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ACCOUNT_ROUTES,
  AnswerMap,
  ProfileForm,
  QuestionsResponse,
  SaveAnswersResponse,
} from '../../models/account.model';
import { ApiClient, apiUrl } from '../api-client/api-client';
import { AuthSession } from '../auth-session/auth-session';

/**
 * The onboarding / profile questionnaire.
 *
 * `questions/` says what to render and `profile/` says what has been answered;
 * the two join on the question `code`. Both are reads and both are reactive on
 * `form()`, so switching between the onboarding and profile questionnaires
 * re-fetches with no plumbing.
 *
 * Same three resource rules as `AccountApi` — gate on the boolean, never set
 * the bearer here, `undefined` means idle.
 */
@Service()
export class OnboardingApi {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);

  /** Which questionnaire is in scope. Changing it re-fetches `questions`. */
  readonly form = signal<ProfileForm>('onboarding');

  readonly questions = httpResource<QuestionsResponse>(() =>
    this.auth.isAuthenticated()
      ? { url: apiUrl(ACCOUNT_ROUTES.questions.path), params: { form: this.form() } }
      : undefined,
  );

  /**
   * A bare flat map keyed by question code. `{}` is a normal empty state, not a
   * 404 — having answered nothing is a legitimate position.
   */
  readonly answers = httpResource<AnswerMap>(() =>
    this.auth.isAuthenticated() ? apiUrl(ACCOUNT_ROUTES.answers.path) : undefined,
  );

  /**
   * Write answers back in the same flat shape the GET returns.
   *
   * Partial by definition — a code you omit is left exactly as it was, which is
   * why this is a PATCH and not a PUT. `null` is refused rather than read as
   * "clear". Idempotent, so a retry after a timeout is safe.
   *
   * The write always succeeds; the milestone advances only when every required,
   * shown question of that form has an answer, and a partial save comes back
   * with `missing` naming what is outstanding. A non-empty `missing` is NOT an
   * error.
   *
   * RULE 5, and the caller must honour it: if `profile_status` advanced, call
   * `AuthSession.forceRefresh()` BEFORE navigating. The claim is minted into
   * the token, so skipping the refresh re-reads a stale value and bounces the
   * user back into onboarding they just finished. This is the single most
   * common integration bug on this surface.
   */
  async saveAnswers(patch: AnswerMap): Promise<SaveAnswersResponse> {
    const result = await firstValueFrom(
      this.api.call(ACCOUNT_ROUTES.saveAnswers, patch, { params: { form: this.form() } }),
    );
    this.answers.reload();
    return result;
  }
}
