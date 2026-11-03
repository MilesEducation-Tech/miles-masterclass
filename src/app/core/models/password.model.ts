import { CommonResponse, RouteConfig } from '@core/models/http.model';

/**
 * MilesCAIRA Accounts v1 — passwords (contract §2.6–2.10, added 2026-10-28).
 *
 * Proxies onto the Miles SSO. Password sign-in mints a session, so it sits with the other session
 * routes in `AUTH_ROUTES`; these are the routes around it. Three contract rules hold for all of them:
 *
 *  - The SSO owns every rule (lockouts, the policy, who may hold a password at all), and its status,
 *    `code` and `message` arrive unmodified. Show `message` as-is; branch on `code`.
 *  - Passwords, PINs, reset tokens and codes are never logged, cached, or kept in a URL, storage or
 *    a persisted form state.
 *  - A password is a JSON string sent exactly as typed: never trimmed, never a number.
 */

/** `auth-password-forgot/`. An email address only; anything else is a 400. */
export interface PasswordForgotRequest {
  identifier: string;
}

/** `auth-password-reset/`. The token from the emailed link's `#token=` fragment. */
export interface PasswordResetRequest {
  token: string;
}

/** What redeeming a link issues: the account's new password, shown ONCE. */
export interface ResetCredentials {
  /** What to sign in with — the account's email. */
  username: string;
  /** A six-digit PIN today. A string, because a number would lose a leading zero. */
  password: string;
}

export const PASSWORD_ROUTES = {
  /**
   * Email a link that sets a new password — one route for "forgot" and "set a first password".
   * ALWAYS 202 with one fixed message, for an unknown account, an ineligible one, a rate limit and a
   * send failure alike, so it can never say whether an account exists. Only a 400 (not an email),
   * 502 or 503 answer differently, and each of those means nothing was sent.
   */
  forgot: {
    path: 'api/v1/account/auth-password-forgot/',
    method: 'POST',
  } as RouteConfig<PasswordForgotRequest, CommonResponse<null>>,

  /**
   * Redeem the emailed link for a new PIN. The token is the credential, and a redeemed link is spent
   * even when the response is lost — so this runs only when the learner clicks, never on load (mail
   * scanners pre-open links). On 200 the SSO has signed the learner out everywhere. A 400 is one
   * fixed message for an invalid, expired, used or ineligible link.
   */
  reset: {
    path: 'api/v1/account/auth-password-reset/',
    method: 'POST',
  } as RouteConfig<PasswordResetRequest, CommonResponse<ResetCredentials>>,
} as const;

/** Password sign-in's floor. The SSO checks it as well; this only saves a round trip. */
export const PASSWORD_MIN_LOGIN = 6;
