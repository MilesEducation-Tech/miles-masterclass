import { HttpContext } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';

import { SKIP_AUTH_TOKEN, SKIP_ERROR_NOTIFICATION, SKIP_LOADING } from '@core/models/http.model';
import {
  PASSWORD_ROUTES,
  PasswordCodeResponse,
  ResetCredentials,
  SetPasswordRequest,
  SetPasswordResponse,
} from '@core/models/password.model';
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
 * `password-code/` and `password/` act on the signed-in learner, so the bearer attaches as usual.
 * Errors are rendered by the set-password form, which shows its own spinner.
 */
const SIGNED_IN = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true).set(SKIP_LOADING, true);

/**
 * Every password route but sign-in, which mints a session and so belongs to `AuthSession`. Stateless
 * commands: emailing a link and redeeming it need no session (the forgot and reset pages call them
 * directly); asking for a code and setting the password need the learner's (`PasswordFacade`).
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

  /** Email the signed-in learner a code for `set`. No body — see `PASSWORD_ROUTES.code`. */
  requestCode(): Promise<PasswordCodeResponse> {
    return firstValueFrom(
      this.api
        .call(PASSWORD_ROUTES.code, undefined, { context: SIGNED_IN })
        .pipe(map((res) => res.data)),
    );
  }

  /** Set or change the password. `newPassword` goes exactly as typed (contract §2.6). */
  set(body: SetPasswordRequest): Promise<SetPasswordResponse> {
    return firstValueFrom(
      this.api.call(PASSWORD_ROUTES.set, body, { context: SIGNED_IN }).pipe(map((res) => res.data)),
    );
  }
}
