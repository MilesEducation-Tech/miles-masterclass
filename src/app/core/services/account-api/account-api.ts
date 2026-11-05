import { HttpContext, httpResource } from '@angular/common/http';
import { Service, computed, effect, inject } from '@angular/core';

import { ACCOUNT_ROUTES, parseUserDetails } from '../../models/account.model';
import { CommonResponse, SKIP_LOADING } from '../../models/http.model';
import { apiUrl } from '../api-client/api-client';
import { AuthSession } from '../auth-session/auth-session';

/**
 * The caller's own user record — `GET user-details/`.
 *
 * Read-only by contract: the old `user_details/` PATCH was deleted, and profile
 * fields are written through `PATCH profile/` (`OnboardingApi.saveAnswers`).
 *
 * A read, so an `httpResource` rather than a method: it fetches itself when the
 * user signs in and goes idle when the user signs out, with no `effect`, no
 * manual `load()` call and no subscription to unwind.
 *
 * Three rules hold this together — break any one and it regresses silently:
 *
 *  1. The request function gates on `isAuthenticated()`, a BOOLEAN. It must
 *     never read the token string: a request function tracks every signal it
 *     reads, so reading the token would re-fire the resource on every
 *     rotation.
 *  2. No `Authorization` header is set here. `appInterceptor` attaches it,
 *     which is what keeps rule 1 possible.
 *  3. Returning `undefined` puts a resource in the idle state and sends no
 *     request at all — that is the signed-out case, not an error.
 *
 * SSR note: `HttpTransferCache` excludes requests carrying an `Authorization`
 * header unless `includeRequestsWithAuthHeaders` is set, and it is not (see
 * `app.config.ts`). It therefore re-fetches once on the client after
 * hydration. That is the intended trade: enabling the flag would write a
 * per-user payload into the served HTML.
 */
@Service()
export class AccountApi {
  private readonly auth = inject(AuthSession);

  /** `parse` is the trust boundary: a body that drifted from the contract lands
   *  in `error()` here, once, instead of rendering `undefined` downstream. */
  // Read in the background on every signed-in load, so it doesn't drive the loading bar.
  readonly user = httpResource(
    () =>
      this.auth.isAuthenticated()
        ? {
            url: apiUrl(ACCOUNT_ROUTES.userDetails.path),
            context: new HttpContext().set(SKIP_LOADING, true),
          }
        : undefined,
    { parse: (raw) => parseUserDetails((raw as CommonResponse<unknown> | null)?.data) },
  );

  /**
   * Whether the learner has a subscription term in force: the one answer every subscription
   * decision in the app reads.
   *
   * - `true`: `current_subscription_details` is set (a cancelled term counts until `expires_at`).
   * - `false`: signed out, or the record says there is no term.
   * - `null`: not known yet. `user-details/` is loading, failed, or didn't send the key.
   *
   * Callers act on a known answer only (`=== true` / `=== false`). Unknown never paywalls: the
   * contract calls this block "a description, not an access gate", so the server stays the real
   * gate, and a subscriber whose read is late or failed must not be sent to the upsell.
   */
  readonly hasSubscription = computed<boolean | null>(() => {
    if (!this.auth.isAuthenticated()) return false;
    if (!this.user.hasValue()) return null;
    const term = this.user.value().current_subscription_details;
    return term === undefined ? null : term !== null;
  });

  constructor() {
    // This record is authoritative for the two stored milestones, and `is_onboarding_completed`
    // is the only thing on it that restricts access. `AuthSession` owns the gate
    // but cannot read the row itself — this service injects it, so the push goes
    // this way round. Until it lands, the gate runs on the value seeded from the
    // session cookie.
    effect(() => {
      if (!this.user.hasValue()) return;
      const row = this.user.value();
      this.auth.setMilestones(row.is_onboarding_completed, row.is_profile_completed);
    });
  }
}
