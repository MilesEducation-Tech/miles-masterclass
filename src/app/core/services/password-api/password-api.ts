import { HttpContext } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';

import { SKIP_AUTH_TOKEN, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import { PASSWORD_ROUTES, ResetCredentials } from '@core/models/password.model';
import { ApiClient } from '@core/services/api-client/api-client';

/**
 * Both routes are `AllowAny`, and DRF authenticates BEFORE it checks permissions: a stale token
 * left in the cookies would turn a valid reset link into a 401, after the interceptor had rotated
 * it for nothing. So no bearer. Errors are rendered by the page, which shows its own spinner.
 */
const PUBLIC = new HttpContext()
  .set(SKIP_AUTH_TOKEN, true)
  .set(SKIP_ERROR_NOTIFICATION, true)
  .set(SKIP_LOADING, true);

/**
 * The password routes that need no session: emailing a link and redeeming it. Stateless commands —
 * the forgot and reset pages each own their screen and share nothing, so there is no facade.
 */
@Service()
export class PasswordApi {
  private readonly api = inject(ApiClient);

  /** Email a set/reset link. Resolves the 202's fixed message, which the page shows as-is. */
  requestLink(email: string): Promise<string> {
    return firstValueFrom(
      this.api
        .call(PASSWORD_ROUTES.forgot, { identifier: email }, { context: PUBLIC })
        .pipe(map((res) => res.message)),
    );
  }

  /** Spend the emailed link for a new PIN. Only on the learner's click — see `PASSWORD_ROUTES.reset`. */
  redeem(token: string): Promise<ResetCredentials> {
    return firstValueFrom(
      this.api
        .call(PASSWORD_ROUTES.reset, { token }, { context: PUBLIC })
        .pipe(map((res) => res.data)),
    );
  }
}
