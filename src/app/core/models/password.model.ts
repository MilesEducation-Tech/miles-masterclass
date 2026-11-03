import { HttpErrorResponse } from '@angular/common/http';

import { readErrorBody } from '@core/models/auth.model';
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

/** `password-code/`'s 202: where the code went, and when another may be asked for. */
export interface PasswordCodeResponse {
  /** The account's own confirmed address, masked by the SSO (`p***a@example.com`). */
  maskedEmail: string;
  cooldownSeconds: number;
  /** A code sent in the last five minutes is still live and was NOT re-sent: "use the code we sent". */
  reused?: boolean;
  /** With `reused`: how long that code has left. */
  validForSeconds?: number;
}

/**
 * `password/`. At most one proof: `emailCode` (from `password-code/`) or `currentPassword` — or
 * neither, for a FIRST password sent within 15 minutes of a code sign-in, once. An absent proof is
 * omitted, never sent empty.
 */
export interface SetPasswordRequest {
  newPassword: string;
  emailCode?: string;
  currentPassword?: string;
}

/** `password/`'s 200. Every OTHER session is signed out; `signedOut` means this one was too. */
export interface SetPasswordResponse {
  signedOutOtherSessions: boolean;
  signedOut: boolean;
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

  /**
   * Email the signed-in learner a code that proves it is them: the `emailCode` proof for `set`. The
   * same code, throttle and cooldown as the email sign-in code. NO body: any key is a 400.
   */
  code: {
    path: 'api/v1/account/password-code/',
    method: 'POST',
  } as RouteConfig<void, CommonResponse<PasswordCodeResponse>>,

  /**
   * Set a first password or change the current one. The client need not know which proof applies:
   * `400 verification_required` says when one is needed. A 401 WITH a `code` is a wrong proof, not
   * an expired session — signing the learner out on it would sign them out for a typo.
   */
  set: {
    path: 'api/v1/account/password/',
    method: 'POST',
  } as RouteConfig<SetPasswordRequest, CommonResponse<SetPasswordResponse>>,
} as const;

/** Password sign-in's floor. The SSO checks it as well; this only saves a round trip. */
export const PASSWORD_MIN_LOGIN = 6;

/** A new password is 8 to 72 UTF-8 BYTES, with at least one letter and one number. The SSO enforces it. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

/** The 403 `code`s of `password-code/` and `password/`: this account cannot hold a password here at all. */
export const PASSWORD_REFUSAL_CODES = [
  'lms_managed',
  'organisation_managed',
  'email_required',
  'email_not_confirmed',
  'account_inactive',
  'not_available',
] as const;

export type PasswordRefusalCode = (typeof PASSWORD_REFUSAL_CODES)[number];

/** The documented outcomes of `password-code/` and `password/` (contract §2.10). */
export type PasswordFailure =
  /** 400 `password_policy` — under the new password; nothing was spent. */
  | { kind: 'policy'; message: string }
  /** 400 `verification_required` — a proof is needed: the emailed code. */
  | { kind: 'verification_required'; message: string }
  /** Any other 400, e.g. the strict-input refusal of an undeclared key. */
  | { kind: 'invalid_input'; message: string }
  /** 401 `email_code_incorrect` — keep the form. */
  | { kind: 'code_incorrect'; message: string }
  /** 401 `current_password_incorrect` — keep the form. */
  | { kind: 'current_password_incorrect'; message: string }
  /** 401 with no `code` — the session itself failed. */
  | { kind: 'session_expired'; message: string }
  /** 403, one of the six refusals — hide the password form; show `message`. */
  | { kind: 'refused'; code: PasswordRefusalCode; message: string }
  /** 429 — `password-code/` says how long to wait, `password/` does not. */
  | { kind: 'rate_limited'; message: string; retryAfterSeconds: number | null }
  /** 502, or no answer at all — nothing happened; try again. */
  | { kind: 'unavailable'; message: string }
  /** 503 "The password could not be set" — the code was spent: ask for a new one first. */
  | { kind: 'code_spent'; message: string }
  /** Any other 503. */
  | { kind: 'misconfigured'; message: string }
  | { kind: 'unknown'; message: string };

const isRefusalCode = (code: string | null): code is PasswordRefusalCode =>
  (PASSWORD_REFUSAL_CODES as readonly string[]).includes(code ?? '');

/**
 * The 503 that spent the code. Copy only, no `code` — the same ponytail as `SPENT_CODE_502` in
 * `auth.model.ts`: a reworded message lands on `misconfigured`, which at worst costs one more try.
 */
const SPENT_CODE_503 = /could not be set/i;

/** `data.retryAfterSeconds` — a number, so `readErrorBody` (strings only) doesn't carry it. */
function retryAfterOf(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const data = (body as Record<string, unknown>)['data'];
  if (typeof data !== 'object' || data === null) return null;
  const seconds = (data as Record<string, unknown>)['retryAfterSeconds'];
  return typeof seconds === 'number' && seconds > 0 ? seconds : null;
}

export function toPasswordFailure(err: HttpErrorResponse): PasswordFailure {
  const body = readErrorBody(err.error);
  const message = (fallback: string): string => body.message ?? fallback;

  switch (err.status) {
    case 0:
      return { kind: 'unavailable', message: "We couldn't reach the server. Please try again." };
    case 400:
      if (body.code === 'password_policy') {
        return { kind: 'policy', message: message('This password does not meet the rules.') };
      }
      if (body.code === 'verification_required') {
        return {
          kind: 'verification_required',
          message: message('Enter the code we sent to your email to set your password.'),
        };
      }
      return { kind: 'invalid_input', message: message('Please check what you entered.') };
    case 401:
      if (body.code === 'email_code_incorrect') {
        return {
          kind: 'code_incorrect',
          message: message('That code is incorrect or has expired.'),
        };
      }
      if (body.code === 'current_password_incorrect') {
        return {
          kind: 'current_password_incorrect',
          message: message('Your current password is incorrect.'),
        };
      }
      return { kind: 'session_expired', message: message('Your session has ended.') };
    case 403:
      // Only the six documented refusals end the form; any other 403 stays retryable.
      if (isRefusalCode(body.code)) {
        return {
          kind: 'refused',
          code: body.code,
          message: message('A password is not available for this account.'),
        };
      }
      return { kind: 'unknown', message: message('Something went wrong. Please try again.') };
    case 429:
      return {
        kind: 'rate_limited',
        message: message('Too many attempts. Please try again later.'),
        retryAfterSeconds: retryAfterOf(err.error),
      };
    case 502:
      return {
        kind: 'unavailable',
        message: message('This is temporarily unavailable. Please try again.'),
      };
    case 503:
      if (body.message !== null && SPENT_CODE_503.test(body.message)) {
        return { kind: 'code_spent', message: body.message };
      }
      return {
        kind: 'misconfigured',
        message: message('This is unavailable right now. Please try again shortly.'),
      };
    default:
      return { kind: 'unknown', message: message('Something went wrong. Please try again.') };
  }
}
