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

/**
 * Every `code` this client knows. The Events contract's refusals, plus
 * `authentication_failed` (our name for DRF's code-less 403) and
 * `unknown_error` (nothing usable came back). The live-session codes belong to
 * the embedded meeting path, which is not in the contract yet.
 */
export type KnownWebinarErrorCode =
  | 'invalid_request'
  | 'authentication_required'
  | 'authentication_failed'
  | 'webinar_not_found'
  | 'attempt_not_found'
  | 'missing_email'
  | 'invalid_email'
  | 'missing_first_name'
  | 'invalid_first_name'
  | 'registration_in_progress'
  | 'unsupported_webinar_type'
  | 'webinar_cancelled'
  | 'webinar_inactive'
  | 'webinar_start_time_missing'
  // Live-session path (liveEnabled: false).
  | 'not_registered'
  | 'join_window_not_open'
  | 'webinar_ended'
  | 'session_active'
  | 'session_superseded'
  | 'poll_closed'
  | 'unknown_error';

/**
 * Widened like `AuthMethod`: codes are ADDITIVE on the backend, so a new one is
 * data that falls through to the generic copy — not a compile error, and never
 * a crash. Switch on the known members; the widening keeps the rest honest.
 */
export type WebinarErrorCode = KnownWebinarErrorCode | (string & {});

/** Per-field validation failure inside a 400 `invalid_request`. */
export interface FieldError {
  /** Dot-joined, so a bad key in a list element reads `chapters.0.chapter_id`. */
  field: string;
  message: string;
}

export interface WebinarError {
  /** The stable contract value. `unknown_error` when nothing usable came back. */
  code: WebinarErrorCode;
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
const PROFILE_CODES = new Set<WebinarErrorCode>([
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
const RETRYABLE_CODES = new Set<WebinarErrorCode>([
  'registration_in_progress',
  'webinar_start_time_missing',
  'unknown_error',
]);

const UNKNOWN_COPY = 'Something went wrong. Please try again.';

/** Fallback copy for codes whose `detail` we cannot rely on being present. */
// The profile codes are absent on purpose: their `detail` is always the copy.
// `satisfies` checks every key is a known code; the annotation lets a widened
// (unknown) code index it and read `undefined` rather than fail to compile.
const FALLBACK_MESSAGES: Readonly<Record<string, string | undefined>> = {
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
  unknown_error: UNKNOWN_COPY,
} satisfies Partial<Record<KnownWebinarErrorCode, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const stringOr = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

function isFieldErrors(v: unknown): v is FieldError[] {
  return (
    Array.isArray(v) &&
    v.every(
      (e) => isRecord(e) && typeof e['field'] === 'string' && typeof e['message'] === 'string',
    )
  );
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
      message: err instanceof Error ? err.message : UNKNOWN_COPY,
      status: null,
      isProfileProblem: false,
      isRetryable: true,
    };
  }

  // Read key by key rather than cast to a body type: this is untrusted input,
  // and a refusal that is not even an object still has to become a WebinarError.
  const body: Record<string, unknown> = isRecord(err.error) ? err.error : {};
  const bodyCode = stringOr(body['code']);

  let code: WebinarErrorCode = bodyCode ?? 'unknown_error';
  // `detail ?? message` — the one documented inconsistency in the envelope.
  let serverText = stringOr(body['detail']) ?? stringOr(body['message']);

  // The bad-token 403 is the one refusal that does NOT carry `code`. Verified
  // against UAT on 2026-09-18: a malformed bearer token answers
  // `403 {"detail": "Error decoding signature."}` — DRF's own envelope, not
  // this app's. Switching on `code` alone would file it under `unknown_error`
  // and show the user a JWT library's internal wording.
  if (err.status === 403 && !bodyCode) {
    code = 'authentication_failed';
    serverText = FALLBACK_MESSAGES['authentication_failed'];
  }

  return {
    code,
    message: serverText || FALLBACK_MESSAGES[code] || UNKNOWN_COPY,
    status: err.status,
    errors: isFieldErrors(body['errors']) ? body['errors'] : undefined,
    retryAfterSeconds:
      typeof body['retry_after_seconds'] === 'number' ? body['retry_after_seconds'] : undefined,
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
