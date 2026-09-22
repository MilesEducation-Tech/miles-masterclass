import { httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ACCOUNT_ROUTES,
  AppStatus,
  UserDetails,
  UserDetailsPatch,
} from '../../models/account.model';
import { ApiClient, apiUrl } from '../api-client/api-client';
import { AuthSession } from '../auth-session/auth-session';

/**
 * The caller's own user record and the web startup probe.
 *
 * Both are reads, so both are `httpResource`s rather than methods: they fetch
 * themselves when the user signs in and go idle when the user signs out, with
 * no `effect`, no manual `load()` call and no subscription to unwind.
 *
 * Three rules hold this together — break any one and it regresses silently:
 *
 *  1. The request function gates on `isAuthenticated()`, a BOOLEAN. It must
 *     never read the token string: a request function tracks every signal it
 *     reads, so reading the token would re-fire both resources on every
 *     rotation.
 *  2. No `Authorization` header is set here. `appInterceptor` attaches it,
 *     which is what keeps rule 1 possible.
 *  3. Returning `undefined` puts a resource in the idle state and sends no
 *     request at all — that is the signed-out case, not an error.
 *
 * SSR note: `HttpTransferCache` excludes requests carrying an `Authorization`
 * header unless `includeRequestsWithAuthHeaders` is set, and it is not (see
 * `app.config.ts`). These therefore re-fetch once on the client after
 * hydration. That is the intended trade: enabling the flag would write a
 * per-user payload into the served HTML.
 */
@Service()
export class AccountApi {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthSession);

  readonly user = httpResource<UserDetails>(() =>
    this.auth.isAuthenticated() ? apiUrl(ACCOUNT_ROUTES.userDetails.path) : undefined,
  );

  readonly appStatus = httpResource<AppStatus>(() =>
    this.auth.isAuthenticated() ? apiUrl(ACCOUNT_ROUTES.appStatus.path) : undefined,
  );

  /**
   * PATCH the caller's own row, then reload so the resource stays the single
   * source of truth for it. An empty patch is a 400 server-side
   * ("Send at least one field to update."), so it is refused here first.
   */
  async updateUser(patch: UserDetailsPatch): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await firstValueFrom(this.api.call(ACCOUNT_ROUTES.updateUserDetails, patch));
    this.user.reload();
  }
}
