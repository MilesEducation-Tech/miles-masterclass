import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalises every refusal the Events API can return into one shape the UI can
 * render.
 *
 * Two rules from the contract drive this file, and both are easy to get wrong:
 *
 * 1. SWITCH ON `code`, NEVER ON THE HTTP STATUS AND NEVER ON `detail`. The
 *    `code` values are the stable contract; wording and status can move. The
 *    legacy V4 endpoint answered 500 for every input problem because FE had
 *    reserved 4xx for session handling — these routes return real 400/404/409,
 *    so any interceptor treating 4xx as "log the user out" has to change.
 * 2. A BAD OR EXPIRED TOKEN ANSWERS 403, NOT 401, on every authenticated route
 *    in this backend. Token-refresh logic keyed on 401 alone silently fails.
 *    The one 401 is a well-formed anonymous request asking for the signed-in
 *    page, and it is the only refusal that carries `message` instead of
 *    `detail` — hence `detail ?? message` below.
 */

/** Per-field validation failure inside a 400 `invalid_request`. */
export interface FieldError {
  /** Dot-joined, so a bad key in a list element reads `chapters.0.chapter_id`. */
  field: string;
  message: string;
}

export interface WebinarError {
  /** The stable contract value. `unknown_error` when nothing usable came back. */
  code: string;
  /** Safe to surface. Already written as user-facing copy for several codes. */
  message: string;
  status: number | null;
  errors?: FieldError[];
  /** Present on `registration_in_progress`. Currently 15. */
  retryAfterSeconds?: number;
  /**
   * True when the refusal names something the user must fix in their profile.
   * None of these is retryable without that fix, so the UI shows a profile link
   * rather than a retry button.
   */
  isProfileProblem: boolean;
  /** True when re-issuing the same request could plausibly succeed. */
  isRetryable: boolean;
}

/**
 * The four profile refusals. Checked BEFORE any Zoom call, so the user learns
 * synchronously instead of polling to a terminal failure, and each `detail` is
 * already written as copy naming what to fix.
 */
const PROFILE_CODES = new Set([
  'missing_email',
  'invalid_email',
  'missing_first_name',
  'invalid_first_name',
]);

/**
 * Codes where retrying the identical request can work. `registration_in_progress`
 * is lock contention; `webinar_start_time_missing` is an ops data problem, not a
 * client error, so the user can come back later.
 */
const RETRYABLE_CODES = new Set([
  'registration_in_progress',
  'webinar_start_time_missing',
  'unknown_error',
]);

/** Fallback copy for codes whose `detail` we cannot rely on being present. */
const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_request: 'Something in that request was not valid. Please try again.',
  webinar_not_found: 'We could not find that webinar.',
  unsupported_webinar_type: 'This session uses a different registration flow.',
  webinar_inactive: 'This webinar is not available right now. It may come back — check later.',
  webinar_cancelled: 'This session was cancelled.',
  webinar_start_time_missing: 'This webinar has no scheduled start time yet. Please check back.',
  registration_in_progress: 'Your registration is already being processed. One moment.',
  attempt_not_found: 'We could not find that registration attempt.',
  authentication_required: 'Please sign in to see your webinars.',
  authentication_failed: 'Your session has expired. Please sign in again.',
  not_registered: 'You are not registered for this webinar.',
  join_window_not_open: 'The join window has not opened yet.',
  webinar_ended: 'This session has ended.',
  session_active: 'You are already in a session on another device or window.',
  session_superseded: 'You joined this session from somewhere else.',
  poll_closed: 'That question has closed.',
  unknown_error: 'Something went wrong. Please try again.',
};

/** The refusal body shape, as far as we are willing to assume it. */
interface RefusalBody {
  status?: string;
  code?: string;
  /** Every refusal carries this... */
  detail?: string;
  /** ...except `authentication_required`, which carries this instead. */
  message?: string;
  errors?: FieldError[];
  retry_after_seconds?: number;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Turn anything thrown by an Events API call into a `WebinarError`.
 *
 * Accepts `unknown` rather than `HttpErrorResponse` because it sits in `catch`
 * blocks, where TypeScript gives no better type.
 */
export function toWebinarError(err: unknown): WebinarError {
  if (!(err instanceof HttpErrorResponse)) {
    return {
      code: 'unknown_error',
      message: err instanceof Error ? err.message : FALLBACK_MESSAGES['unknown_error'],
      status: null,
      isProfileProblem: false,
      isRetryable: true,
    };
  }

  const body: RefusalBody = isRecord(err.error) ? (err.error as RefusalBody) : {};

  let code = typeof body.code === 'string' ? body.code : 'unknown_error';
  // `detail ?? message` — the one documented inconsistency in the envelope.
  let serverText = body.detail ?? body.message;

  // The bad-token 403 is the one refusal that does NOT carry `code`. Verified
  // against UAT on 2026-09-18: a malformed bearer token answers
  // `403 {"detail": "Error decoding signature."}` — DRF's own envelope, not
  // this app's. Switching on `code` alone would file it under `unknown_error`
  // and show the user a JWT library's internal wording.
  if (err.status === 403 && !body.code) {
    code = 'authentication_failed';
    serverText = FALLBACK_MESSAGES['authentication_failed'];
  }

  return {
    code,
    message: serverText || FALLBACK_MESSAGES[code] || FALLBACK_MESSAGES['unknown_error'],
    status: err.status,
    errors: Array.isArray(body.errors) ? body.errors : undefined,
    retryAfterSeconds:
      typeof body.retry_after_seconds === 'number' ? body.retry_after_seconds : undefined,
    isProfileProblem: PROFILE_CODES.has(code),
    isRetryable: RETRYABLE_CODES.has(code),
  };
}

/** True when this refusal means the session lease is held elsewhere. */
export function isSessionConflict(error: WebinarError): boolean {
  return error.code === 'session_active';
}

/** True when this surface has been evicted and must stop pretending it is live. */
export function isSupersededError(error: WebinarError): boolean {
  return error.code === 'session_superseded';
}
