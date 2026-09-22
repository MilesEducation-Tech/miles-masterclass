import { HttpErrorResponse } from '@angular/common/http';

import { RouteConfig } from './http.model';

/**
 * MilesCAIRA Accounts v1 — sign-in.
 *
 * Contract source: the request descriptions in
 * `Postman Collection/Merged_Masterclass_Backend_All_APIs.postman_collection.json`,
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
 */
export type OtpChannel = 'email' | 'sms' | 'whatsapp';

// ── Request / response bodies ───────────────────────────────────────────────

/**
 * Every one of these endpoints rejects an UNDECLARED field with a 400 (verified
 * against UAT on 2026-09-22). Send exactly these keys and nothing else — no
 * `appCode`, no `channel`, no leftover `browser_session_id`.
 */
export interface IdentifyRequest {
  identifier: string;
}

export interface IdentifyResponse {
  /** Render this list rather than assuming a form. When enterprise SSO ships,
   *  the same endpoint starts answering `saml` and a client that renders the
   *  list needs no change. */
  methods: string[];
  defaultMethod: string;
  /**
   * `null` for an identifier the SSO has never seen — and it is the ONLY
   * negative signal in this body. `methods`, `defaultMethod` and the masks are
   * built from what was typed, not from anything stored, so they are identical
   * for a known and an unknown identifier. Never build a "no such account"
   * message from this response; there is nothing here to build it from.
   */
  communicationId: string | null;
  /** Masked destinations, keyed by method. Exact shape needs a live capture —
   *  UAT answers 503 (SSO not configured) as of 2026-09-22. */
  maskedDestinations?: Record<string, string>;
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

  logout: {
    path: 'api/v1/account/auth-logout/',
    method: 'POST',
  } as RouteConfig<void, void>,
} as const;

/**
 * The five sign-in paths, for the interceptor's skip list. Derived from the
 * registry so a renamed path can never drift out of the exclusion.
 *
 * They are excluded because refreshing before the call that MINTS the session
 * is nonsense, and refreshing before the refresh is recursion.
 */
export const AUTH_ROUTE_PATHS: readonly string[] = Object.values(AUTH_ROUTES).map((r) => r.path);

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
      b['profile_status'] === 'profile_completed')
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
  /** 502 — provisioning failed after a valid token. The code is spent; send
   *  them for a new one. Retryable. */
  | { kind: 'retry_new_code'; message: string }
  /** 503 — our configuration fault, or the mailer refused to deliver. Not the
   *  user's problem, and on send it means nothing went out and nothing will. */
  | { kind: 'misconfigured'; message: string }
  /** 400 — the SSO's own learner-facing copy (e.g. a malformed phone number),
   *  keyed by field. Render it unaltered. */
  | { kind: 'invalid_input'; message: string; fields: Record<string, string> }
  | { kind: 'unknown'; message: string };

const GENERIC = 'Something went wrong. Please try again.';

/**
 * Pull the human-readable line out of a body that may be `{message}`, `{detail}`,
 * a bare string, or a field-keyed 400 map. All four shapes are live on this API.
 */
function messageOf(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body;
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error']) {
      if (typeof b[key] === 'string' && b[key]) return b[key] as string;
    }
    // Field-keyed 400: surface the first message rather than a generic line.
    const first = Object.values(b).find((v) => typeof v === 'string' && v);
    if (typeof first === 'string') return first;
  }
  return fallback;
}

/** A 400 body on this API is a map of field name → learner-facing message. */
function fieldsOf(body: unknown): Record<string, string> {
  if (typeof body !== 'object' || body === null) return {};
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export function toAuthFailure(err: HttpErrorResponse): AuthFailure {
  const body: unknown = err.error;
  const code =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)['code']
      : undefined;

  switch (err.status) {
    case 400:
      return {
        kind: 'invalid_input',
        message: messageOf(body, 'Please check what you entered.'),
        fields: fieldsOf(body),
      };
    case 401:
      return { kind: 'bad_code', message: messageOf(body, 'That code is incorrect or expired.') };
    case 429:
      return { kind: 'locked', message: messageOf(body, 'Too many attempts. Try again later.') };
    case 403:
      // Two distinct columns, two distinct teams. Never collapse them.
      if (code === 'account_deactivated') {
        return {
          kind: 'deactivated',
          message: messageOf(body, 'This account has been deactivated.'),
        };
      }
      return { kind: 'blocked', message: messageOf(body, 'This account cannot sign in.') };
    case 502:
      return {
        kind: 'retry_new_code',
        message: messageOf(body, 'Sign-in could not be completed. Please request a new code.'),
      };
    case 503:
      return {
        kind: 'misconfigured',
        message: messageOf(body, 'Sign-in is unavailable right now. Please try again shortly.'),
      };
    default:
      return { kind: 'unknown', message: messageOf(body, GENERIC) };
  }
}

/** Terminal failures carry no token and no cookie, and no retry can help. */
export function isTerminalFailure(failure: AuthFailure): boolean {
  return failure.kind === 'blocked' || failure.kind === 'deactivated';
}
