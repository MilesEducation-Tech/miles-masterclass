import { CairaFailure, CairaFieldError } from '../models/caira/envelope.model';

/**
 * The shape this module needs from a failed request. `HttpErrorResponse`
 * satisfies it structurally, and so does the error `httpResource().error()`
 * surfaces — but neither is imported here.
 *
 * Importing `HttpErrorResponse` pulls `@angular/common/http` in, which pulls in
 * `BrowserXhr`, which needs the JIT compiler. That makes a pure function
 * untestable without booting Angular. Structural typing costs nothing and keeps
 * the classifier runnable in a bare test.
 */
interface HttpErrorLike {
  status: number;
  error: unknown;
  message?: string;
}

/**
 * The single place that knows how CAIRA reports failure.
 *
 * CAIRA speaks five error vocabularies, and which one you get depends on which
 * Django app answered rather than on what went wrong:
 *
 * | Body                                       | Where                                   |
 * |--------------------------------------------|-----------------------------------------|
 * | `{ detail }`                               | DRF — auth, 405, throttle, some 400/404 |
 * | `{ status: "error", reason }`              | web LMS business rules                  |
 * | `{ status: "error", message }`             | web LMS not-found / bad-request         |
 * | `{ status: "error", errors: [{field,…}] }` | pydantic request validation             |
 * | `{ code, message }`                        | `web/*` login routes                    |
 * | `{ error }` (+ `attempts_remaining`)       | `qr/*` and the mobile `account` routes  |
 *
 * A naive `error?.error?.message ?? 'Something went wrong'` — what the deleted
 * interceptor did — reads `undefined` on four of those six and toasts a generic
 * string over what was actually a renderable UI state.
 *
 * Pure function, no injection: the error interceptor uses it to decide whether
 * to toast, and facades use it again to switch on `kind`. Same answer both times.
 */
export function cairaError(err: unknown): CairaFailure {
  if (!isHttpErrorLike(err)) {
    return { kind: 'unexpected', status: 0, message: messageOf(err) };
  }

  const status = err.status;
  const body = err.error;
  const fallback = err.message ?? 'Request failed.';

  // Status 0 is a network failure, a CORS preflight rejection or an aborted
  // request — never a response we can read. Most likely cause on day one is the
  // preflight, so keep the status in the log line.
  if (status === 0) {
    return { kind: 'unexpected', status: 0, message: 'Network request failed.' };
  }

  // A non-JSON body (HTML error page, plain text). Django's UUID converter
  // returns a plain-text 404 for a non-canonical UUID rather than the JSON
  // envelope, so this path is reachable in normal use.
  if (typeof body === 'string') {
    return status === 404
      ? { kind: 'notFound', status, message: 'Not found.' }
      : { kind: 'unexpected', status, message: fallback };
  }

  if (!isRecord(body)) {
    return { kind: 'unexpected', status, message: fallback };
  }

  // 1. pydantic validation — the only body carrying an `errors` array.
  if (Array.isArray(body['errors'])) {
    return { kind: 'validation', status, fields: toFieldErrors(body['errors']) };
  }

  // 2. Business rules always carry `reason`. This is the branch that keeps
  //    `chapter_locked` and `cool_off_active` out of the toast bucket. Sibling
  //    keys (`cool_off_minutes_remaining`, `cool_off_ends_at`) ride along in
  //    `extra` — dropping them would make the cool-off countdown unrenderable.
  if (typeof body['reason'] === 'string') {
    return {
      kind: 'domain',
      status,
      reason: body['reason'],
      message: stringOrUndefined(body['message']),
      extra: omit(body, ['status', 'reason', 'message']),
    };
  }

  // 3. The `web/*` login routes are the only ones with a machine-readable
  //    `code`. Their 401 is a *wrong password*, not a bad token — classifying it
  //    as `auth` would fire a pointless refresh and clear a session the user is
  //    still trying to create.
  if (typeof body['code'] === 'string') {
    const code = body['code'];
    const message = stringOrUndefined(body['message']) ?? code;
    if (status >= 500) return { kind: 'unexpected', status, message };
    if (status === 400) return { kind: 'validation', status, fields: [nonField(message)] };
    return { kind: 'domain', status, reason: code, message, extra: {} };
  }

  // 4. DRF's `{ detail }`. Note this is NOT always auth — #31 uses it for a 400
  //    and #43/#45 use it for a 404 — so branch on status, not on the key.
  if (typeof body['detail'] === 'string') {
    const detail = body['detail'];
    if (status === 401 || status === 403) {
      // 403 is the common case, not 401: `USP/authentication.py` never overrides
      // `authenticate_header()`, so DRF downgrades every auth failure to 403.
      return { kind: 'auth', status, detail, expired: isExpiredDetail(detail) };
    }
    if (status === 404) return { kind: 'notFound', status, message: detail };
    if (status === 429)
      return { kind: 'domain', status, reason: 'throttled', message: detail, extra: {} };
    if (status === 400) return { kind: 'validation', status, fields: [nonField(detail)] };
    return { kind: 'unexpected', status, message: detail };
  }

  // 5. A `message` + `error` pair means "internal failure, flattened": `error`
  //    is the raw exception string. `all_webinars_web` and `badges_catalog`
  //    return this as **400**, not 500, and `refresh` collapses every local
  //    failure to 400 the same way. Without this branch those all read as
  //    validation errors and get shown to the user as if they typed something
  //    wrong. Must be checked before the lone-`error` branch below.
  if (typeof body['error'] === 'string' && typeof body['message'] === 'string') {
    return { kind: 'unexpected', status, message: body['message'] };
  }

  // 6. `{ error }` — the QR routes and the mobile `account` routes.
  //    QR's 401 "Incorrect PIN" and 429 lockout are user-facing states, and
  //    `attempts_remaining` must survive into `extra` for the retry counter.
  if (typeof body['error'] === 'string') {
    const message = body['error'];
    if (status === 404) return { kind: 'notFound', status, message };
    if (status === 400) return { kind: 'validation', status, fields: [nonField(message)] };
    if (status === 401 || status === 409 || status === 429) {
      return {
        kind: 'domain',
        status,
        reason: reasonFromStatus(status),
        message,
        extra: omit(body, ['error']),
      };
    }
    return { kind: 'unexpected', status, message };
  }

  // 7. `{ status: "error" | false, message }` — the web LMS fallback.
  if (typeof body['message'] === 'string') {
    const message = body['message'];
    if (status === 404) return { kind: 'notFound', status, message };
    if (status === 400) return { kind: 'validation', status, fields: [nonField(message)] };
    return { kind: 'unexpected', status, message };
  }

  // 8. DRF's field-keyed ValidationError dict: `{ field: ["msg", …], … }`.
  const fieldErrors = toDrfFieldErrors(body);
  if (fieldErrors.length > 0) {
    return { kind: 'validation', status, fields: fieldErrors };
  }

  return { kind: 'unexpected', status, message: fallback };
}

/**
 * Whether this failure means the access token should be refreshed and the
 * request retried.
 *
 * Deliberately narrower than `kind === 'auth'`: a malformed header or an
 * unknown user will not be fixed by a new token, and retrying those turns one
 * rejected request into two.
 */
export function isRefreshable(failure: CairaFailure): boolean {
  return failure.kind === 'auth' && failure.expired;
}

/**
 * User-facing text for a failure. Never returns a raw exception string: several
 * CAIRA 500 handlers echo `str(exc)` straight to the client, which leaks
 * internals and reads as gibberish. The raw text still reaches `Logger`.
 */
export function userMessage(failure: CairaFailure): string {
  switch (failure.kind) {
    case 'domain':
      return failure.message ?? 'That action is not available right now.';
    case 'auth':
      return 'Your session has expired. Please sign in again.';
    case 'validation':
      return failure.fields[0]?.message ?? 'Please check the details and try again.';
    case 'notFound':
      return failure.message;
    case 'unexpected':
      return 'Something went wrong. Please try again.';
  }
}

// ---------------------------------------------------------------------------

/** `Signature has expired.` / `Admin signature has expired.` */
function isExpiredDetail(detail: string): boolean {
  return /signature has expired/i.test(detail);
}

function reasonFromStatus(status: number): string {
  if (status === 401) return 'invalid_pin';
  if (status === 409) return 'not_claimed';
  return 'locked_out';
}

function toFieldErrors(errors: unknown[]): CairaFieldError[] {
  const mapped = errors.filter(isRecord).map((e) => ({
    field: stringOrUndefined(e['field']) ?? '__all__',
    message: stringOrUndefined(e['message']) ?? 'Invalid value.',
  }));
  return mapped.length > 0 ? mapped : [nonField('Invalid request.')];
}

/** `{ answers: ["This field is required."] }` → one entry per message. */
function toDrfFieldErrors(body: Record<string, unknown>): CairaFieldError[] {
  const out: CairaFieldError[] = [];
  for (const [field, value] of Object.entries(body)) {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      for (const message of value as string[]) out.push({ field, message });
    }
  }
  return out;
}

function nonField(message: string): CairaFieldError {
  return { field: '__all__', message };
}

function omit(body: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

function isHttpErrorLike(value: unknown): value is HttpErrorLike {
  return isRecord(value) && typeof value['status'] === 'number' && 'error' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error.';
}
