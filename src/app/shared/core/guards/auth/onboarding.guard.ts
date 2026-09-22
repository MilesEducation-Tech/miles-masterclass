import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthSession } from '../../services/auth-session/auth-session';

/**
 * Sends a learner who has not completed onboarding to the profile form.
 *
 * RULE 4: this branches on `profile_status`, and must never be rewritten to
 * read the token's `miles.onboarding_required` claim instead. That claim
 * describes the identity store — whether the SSO still needs a name — and it is
 * a boolean of the OPPOSITE polarity. A user can be fully known to the SSO and
 * still be `new_user` here. Swapping one for the other inverts this gate
 * silently, which is why `onboarding.guard.spec.ts` asserts it.
 */
export const onboardingGuard: CanMatchFn = () => {
  const auth = inject(AuthSession);
  const router = inject(Router);

  return auth.needsOnboarding() ? router.parseUrl('/auth/profile') : true;
};
