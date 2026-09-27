import { HttpErrorResponse } from '@angular/common/http';

import { RouteConfig } from './http.model';

/**
 * MilesCAIRA Accounts v1 — sign-in.
 *
 * Contract source: the request descriptions in
 * `postman/Merged_Masterclass_Backend_All_APIs.postman_collection.json`,
 * which quote `ACCOUNTS_API_CONTRACT_V1.md` verbatim.
 *
 * `CommonResponse<T>` does NOT apply here — these routes return bare bodies.
 * Field casing is left exactly as the API sends it: `accessToken` and
 * `profile_status` sit in the same body because one half comes from the SSO and
 * the other is merged in locally. Normalising that would hide which is which.
 */

// ── Enumerations ────────────────────────────────────────────────────────────

/**
 * This platform's onboarding milestone.
 *
 * NOT the token claim `miles.onboarding_required`. That claim describes the
 * identity store — whether the SSO still needs a name before it considers the
 * account known — and it is a boolean of the OPPOSITE polarity. A user can be
 * fully known to the SSO and still be `new_user` here. Reading one for the
 * other is how a sign-up gate ends up inverted.
 */
export type ProfileStatus = 'new_user' | 'onboard_completed' | 'profile_completed';

/**
 * Where the code was actually sent. Read this from the send RESPONSE, never
 * infer it from what was submitted: phone routing is a table at the SSO that
 * changes with no deploy on either side. As of 2026-09-08 every country
 * resolves to `sms`, India included — WhatsApp routing is off until delivery is
 * proved end to end.
 *
 * Widened like `AuthMethod`: SSO fields are additive (collection §8.3), so a new
 * channel is data to render generically, not a compile error.
 */
export type OtpChannel = 'email' | 'sms' | 'whatsapp' | (string & {});

// ── Request / response bodies ───────────────────────────────────────────────

/**
 * Every one of these endpoints rejects an UNDECLARED field with a 400 (verified
 * against UAT on 2026-09-22). Send exactly these keys and nothing else — no
 * `appCode`, no `channel`, no leftover `browser_session_id`.
 */
export interface IdentifyRequest {
  identifier: string;
}

/**
 * How a given identifier authenticates.
 *
 * Values seen today are `email_otp`, `phone_otp` and `password`; `saml` arrives
 * with enterprise SSO. Typed as a widening union so an unrecognised method from
 * the SSO is data, not a compile error — this backend passes the SSO's body
 * through whole and does not pin its schema.
 */
export type AuthMethod = 'email_otp' | 'phone_otp' | 'password' | 'saml' | (string & {});

/**
 * The collection documents this 200 in prose only — "`methods`, `defaultMethod`,
 * masked destinations and `communicationId`" — with no saved example. The
 * optional fields below are the names seen before the contract was written;
 * nothing reads them, so they stay optional until an example confirms them.
 */
export interface IdentifyResponse {
  /** Unconfirmed by the collection. */
  accountType?: string;
  /**
   * Render this list rather than assuming a form. `methods` follows the KIND of
   * identifier: an email gives `["email_otp", "password"]`, a phone gives
   * `["phone_otp", "password"]`, a username gives `["password", "email_otp"]`.
   *
   * Note what is NOT in here: the bare string `"otp"`. Matching on that is how
   * every account ends up looking like enterprise SSO.
   */
  methods: AuthMethod[];
  /** The one to pre-select. Do not reorder `methods` to make it first. */
  defaultMethod: AuthMethod;
  /** Built from what was TYPED, not from anything stored. Field names unconfirmed. */
  maskedEmail?: string | null;
  maskedPhone?: string | null;
  /**
   * `null` for an identifier the SSO has never seen — and it is the ONLY
   * negative signal in this body. `methods`, `defaultMethod` and the masks are
   * identical for a known and an unknown identifier, so there is nothing here
   * to build a "no such account" message from. Never render one.
   */
  communicationId: string | null;
}

/** True for any one-time-code method, whatever the channel. */
export function isOtpMethod(method: AuthMethod): boolean {
  return method.endsWith('_otp');
}

export interface OtpSendRequest {
  identifier: string;
}

export interface OtpSendResponse {
  channel: OtpChannel;
  /** How long the resend button stays disabled. Read it; do not hardcode one. */
  cooldownSeconds: number;
}

export interface OtpVerifyRequest {
  identifier: string;
  /** A string, and its length is NOT validated client-side — the code length is
   *  set server-side at the SSO. */
  code: string;
}

/** Optional by design: a browser may send `{}` and let the httpOnly
 *  `miles_sso_refresh` cookie be forwarded upstream instead. */
export interface RefreshRequest {
  refreshToken?: string;
}

/** Returned by BOTH `auth-otp-verify/` and `auth-token-refresh/`. */
export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  /** Merged in locally; the SSO knows nothing about it. */
  profile_status: ProfileStatus;
  /** Gates `#TestCourse` visibility. Always `false` on a fresh account. */
  is_test_user: boolean;
}

// ── Route registry ──────────────────────────────────────────────────────────

export const AUTH_ROUTES = {
  identify: {
    path: 'api/v1/account/auth-identify/',
    method: 'POST',
  } as RouteConfig<IdentifyRequest, IdentifyResponse>,

  sendOtp: {
    path: 'api/v1/account/auth-otp-send/',
    method: 'POST',
  } as RouteConfig<OtpSendRequest, OtpSendResponse>,

  verifyOtp: {
    path: 'api/v1/account/auth-otp-verify/',
    method: 'POST',
  } as RouteConfig<OtpVerifyRequest, SessionResponse>,

  refresh: {
    path: 'api/v1/account/auth-token-refresh/',
    method: 'POST',
  } as RouteConfig<RefreshRequest, SessionResponse>,

  /** No body, and — unlike the other four — it REQUIRES `Authorization: Bearer`.
   *  Without it the answer is 401 "Authorization header with a Bearer token is
   *  required.", which is why it is not in `SESSION_MINTING_PATHS`. */
  logout: {
    path: 'api/v1/account/auth-logout/',
    method: 'POST',
  } as RouteConfig<void, void>,
} as const;

/**
 * The four routes that MINT or rotate a session, for the interceptor's skip
 * list: no bearer, no refresh first. Refreshing before the call that mints the
 * session is nonsense, and refreshing before the refresh is recursion.
 *
 * Logout is deliberately absent — it needs the bearer (see `AUTH_ROUTES.logout`).
 * Derived from the registry so a renamed path can never drift out of the list.
 */
export const SESSION_MINTING_PATHS: readonly string[] = Object.entries(AUTH_ROUTES)
  .filter(([key]) => key !== 'logout')
  .map(([, route]) => route.path);

// ── Trust boundary ──────────────────────────────────────────────────────────

/**
 * The one shape whose corruption is unrecoverable: a malformed session writes
 * garbage into the session cookie and bricks every later request with no
 * signal. Everything else degrades visibly.
 *
 * ponytail: hand-written because it guards ONE shape. Reach for zod only when a
 * second boundary needs the same rigour — a dependency for five interfaces is
 * not worth the bundle. `httpResource`'s `parse` option is the seam for that.
 */
export function isSessionResponse(body: unknown): body is SessionResponse {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b['accessToken'] === 'string' &&
    b['accessToken'].length > 0 &&
    typeof b['refreshToken'] === 'string' &&
    b['refreshToken'].length > 0 &&
    (b['profile_status'] === 'new_user' ||
      b['profile_status'] === 'onboard_completed' ||
      b['profile_status'] === 'profile_completed') &&
    typeof b['is_test_user'] === 'boolean'
  );
}

// ── Failures ────────────────────────────────────────────────────────────────

/**
 * The documented outcomes of `auth-otp-verify/`, as a discriminated union.
 *
 * Six of these render genuinely different screens — two are terminal and send
 * the user to two DIFFERENT teams — so a bare `string` message cannot drive the
 * UI. `active` and `is_blocked` are separate columns set by different people
 * for different reasons; telling a blocked learner their account is
 * "deactivated" sends them to the wrong place.
 */
export type AuthFailure =
  /** 401 — wrong or expired code. Let them retype. */
  | { kind: 'bad_code'; message: string }
  /** 429 — too many failures; the identifier is locked. Do not retry. */
  | { kind: 'locked'; message: string }
  /** 403 `account_blocked` — partner-imposed. Terminal; point at Miles support. */
  | { kind: 'blocked'; message: string }
  /** 403 `account_deactivated` — Miles deactivation. Terminal; different team. */
  | { kind: 'deactivated'; message: string }
  /** 502 "…Please request a new code." — provisioning failed after a valid
   *  token (verify only). The code is spent; send them for a new one. */
  | { kind: 'retry_new_code'; message: string }
  /** 502 "Sign-in is temporarily unavailable. Please try again." — every auth
   *  route. Transient: nothing was consumed, so retry the same step. */
  | { kind: 'unavailable'; message: string }
  /** 503 — our configuration fault, or the mailer refused to deliver. Not the
   *  user's problem, and on send it means nothing went out and nothing will. */
  | { kind: 'misconfigured'; message: string }
  /** 400 — the SSO's own learner-facing copy (e.g. a malformed phone number),
   *  or the strict-input refusal of an undeclared key, keyed by field. Render
   *  it unaltered. */
  | { kind: 'invalid_input'; message: string; fields: Record<string, string> }
  | { kind: 'unknown'; message: string };

/**
 * The error bodies the collection documents for the five auth routes. There is
 * no shared envelope (collection §8.2) — each is the SSO's body or one of these:
 *
 * - `{ message }` — 401 / 502 / 503.
 * - `{ code, message }` — 403 on verify; `code` is `account_blocked` or
 *   `account_deactivated`.
 * - `{ [field]: message }` — 400: the strict-input refusal of an undeclared key,
 *   or the SSO's field-keyed copy.
 *
 * Normalised once by `readErrorBody`, so nothing downstream casts an `unknown`.
 */
interface AuthErrorBody {
  message: string | null;
  code: string | null;
  /** Every string-valued key. A 400 is field → message; elsewhere this is
   *  harmless and unused. */
  fields: Record<string, string>;
}

const GENERIC = 'Something went wrong. Please try again.';

/** `message` first, then the DRF/legacy spellings — all live on this API. */
const MESSAGE_KEYS = ['message', 'detail', 'error'] as const;

function readErrorBody(body: unknown): AuthErrorBody {
  if (typeof body === 'string') {
    return { message: body.trim() || null, code: null, fields: {} };
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { message: null, code: null, fields: {} };
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value) fields[key] = value;
  }
  const named = MESSAGE_KEYS.map((key) => fields[key]).find((value) => value !== undefined);
  return {
    // A field-keyed 400 has no `message`: surface its first line rather than a
    // generic one.
    message: named ?? Object.values(fields)[0] ?? null,
    code: fields['code'] ?? null,
    fields,
  };
}

/**
 * The one signal that separates the two 502s: there is no `code`, only copy.
 * ponytail: text match — if the SSO rewords it, the miss lands on `unavailable`
 * (retry the same step), which at worst costs a 401 and a resend. Ask the
 * backend for a `code` on 502 if that ever bites.
 */
const SPENT_CODE_502 = /new code/i;

export function toAuthFailure(err: HttpErrorResponse): AuthFailure {
  const body = readErrorBody(err.error);
  const message = (fallback: string): string => body.message ?? fallback;

  switch (err.status) {
    case 400:
      return {
        kind: 'invalid_input',
        message: message('Please check what you entered.'),
        fields: body.fields,
      };
    case 401:
      return { kind: 'bad_code', message: message('That code is incorrect or expired.') };
    case 429:
      return { kind: 'locked', message: message('Too many attempts. Try again later.') };
    case 403:
      // Two distinct columns, two distinct teams. Never collapse them — and never
      // show a terminal screen for a 403 the contract does not document.
      if (body.code === 'account_deactivated') {
        return { kind: 'deactivated', message: message('This account has been deactivated.') };
      }
      if (body.code === 'account_blocked') {
        return { kind: 'blocked', message: message('This account cannot sign in.') };
      }
      return { kind: 'unknown', message: message(GENERIC) };
    case 502:
      if (body.message !== null && SPENT_CODE_502.test(body.message)) {
        return { kind: 'retry_new_code', message: body.message };
      }
      return {
        kind: 'unavailable',
        message: message('Sign-in is temporarily unavailable. Please try again.'),
      };
    case 503:
      return {
        kind: 'misconfigured',
        message: message('Sign-in is unavailable right now. Please try again shortly.'),
      };
    default:
      return { kind: 'unknown', message: message(GENERIC) };
  }
}

/** Terminal failures carry no token and no cookie, and no retry can help. */
export function isTerminalFailure(failure: AuthFailure): boolean {
  return failure.kind === 'blocked' || failure.kind === 'deactivated';
}
