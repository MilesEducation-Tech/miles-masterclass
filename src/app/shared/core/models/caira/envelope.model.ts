import { HttpContext, HttpContextToken, HttpHeaders, HttpParams } from '@angular/common/http';

/**
 * CAIRA transport vocabulary — response envelopes, the failure taxonomy, and the
 * per-request `HttpContext` flags.
 *
 * CAIRA does not have one envelope. It has six on the success path and five
 * different error vocabularies, and no endpoint tells you which it uses. This
 * file names all of them so that knowledge lives in exactly one place; the
 * unwrap helpers in `core/http/envelope.ts` and the classifier in
 * `core/http/caira-error.ts` are its only consumers.
 *
 * There is deliberately no `CommonResponse<T>`. The old Django API had a single
 * `{ status, message, data, pagination_data }` wrapper and modelling CAIRA that
 * way would be a lie that costs a runtime crash per exception.
 */

// ---------------------------------------------------------------------------
// Success envelopes
// ---------------------------------------------------------------------------

/**
 * `{ "status": true, ...payload }` — the web LMS module (`Top_Section`,
 * `Masterclass_Course_Section`, `Masterclass_Course_Detail`, `levels_progress`,
 * `level_based_badge_clicked`).
 *
 * Note the payload is spread at the top level *next to* `status`, not nested
 * under a `data` key. Compose it: `CairaStatusEnvelope<{ total_count: number }>`.
 */
export type CairaStatusEnvelope<T extends object> = { status: true } & T;

/**
 * `{ "status": "success", "data": {...} }` — most `caira/*` endpoints
 * (`get_badges_tracker_web`, `badges_catalog`, `cpe-progress`, `all_webinars_web`,
 * course-progress get/update, bookmark).
 *
 * `message` is present on some (`all_webinars_web`, `badges_catalog`) and absent
 * on others (`get_badges_tracker_web`) for the same shape — always optional.
 */
export interface CairaDataEnvelope<T> {
  status: 'success';
  message?: string;
  data: T;
}

/**
 * The string `"error"` discriminator some endpoints use on the success-shaped
 * envelope. Only useful for narrowing a 200 body that carries a failure; real
 * failures arrive as an `HttpErrorResponse` and go through `cairaError()`.
 */
export interface CairaErrorEnvelope {
  status: 'error' | false;
  message?: string;
  reason?: string;
  data?: unknown;
}

/**
 * Endpoints returning bare fields with no envelope at all: chapter start, quiz
 * questions/submit, assessment questions/submit/result, feedback
 * questions/submit, enrollment. There is nothing to unwrap — the response *is*
 * the payload. Typed only for documentation; use `unwrapBare` at the call site.
 */
export type CairaBareResponse<T> = T;

// ---------------------------------------------------------------------------
// Failure taxonomy
// ---------------------------------------------------------------------------

/** A single field error, normalised from pydantic's and DRF's two formats. */
export interface CairaFieldError {
  /** Dotted path, e.g. `answers.0.question_id`. `'__all__'` for non-field errors. */
  field: string;
  message: string;
}

/**
 * Every way a CAIRA call can fail, reduced to five cases the UI can act on.
 *
 * The split that matters is `domain` vs everything else: a locked chapter, an
 * active cool-off and an already-submitted feedback form all arrive as HTTP
 * 403/409, but they are ordinary UI states, not errors. Toasting them would
 * mean users see "Error: chapter_locked" during normal navigation.
 */
export type CairaFailure =
  /**
   * A business rule said no. Body carries a `reason` key.
   * Reasons in the wild: `chapter_locked`, `already_completed`,
   * `chapters_not_complete`, `already_passed`, `cool_off_active`,
   * `assessment_not_passed`, `feedback_already_submitted`,
   * `already_started_via_7dc`.
   *
   * Render this as state. Never as a toast.
   */
  | {
      kind: 'domain';
      status: number;
      reason: string;
      message?: string;
      /** Sibling keys, e.g. `cool_off_minutes_remaining`, `cool_off_ends_at`. */
      extra: Record<string, unknown>;
    }
  /**
   * The token was missing, malformed or expired.
   *
   * Arrives as **403 far more often than 401**: `USP/authentication.py` never
   * overrides `authenticate_header()`, so stock DRF downgrades
   * `NotAuthenticated`/`AuthenticationFailed` from 401 to 403. Anything keying
   * only on 401 silently never refreshes.
   */
  | { kind: 'auth'; status: number; detail: string; expired: boolean }
  /** Request body failed validation — pydantic (web LMS) or DRF (webinar feedback). */
  | { kind: 'validation'; status: number; fields: CairaFieldError[] }
  /** The addressed resource does not exist, or is invisible to this caller. */
  | { kind: 'notFound'; status: number; message: string }
  /**
   * Anything we cannot attribute: 5xx, network failure, an unparseable body, and
   * the two catch-alls that return 400 where a 500 was meant (`all_webinars_web`,
   * `badges_catalog`).
   *
   * This is the only bucket that raises a toast.
   */
  | { kind: 'unexpected'; status: number; message: string };

/** Narrowing helper for the common `switch (failure.kind)` in a facade. */
export type CairaFailureKind = CairaFailure['kind'];

// ---------------------------------------------------------------------------
// Per-request flags
// ---------------------------------------------------------------------------

/**
 * Suppress the global error toast for this request. Use for background or
 * silent calls that handle their own failure — the token refresh, SSR
 * pre-fetches, anything whose failure the user should not see.
 */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);

/**
 * Do not attach an `Authorization` header. For CAIRA's genuinely open routes
 * (`web/login-*`, `web/verify-otp`, `qr/initiate`, `qr/confirm`, `refresh`,
 * `country`) and for non-CAIRA hosts (WordPress, S3).
 */
export const SKIP_AUTH_TOKEN = new HttpContextToken<boolean>(() => false);

/**
 * Never attempt a token refresh-and-retry for this request.
 *
 * Set on the refresh call itself, so a failing refresh cannot recurse. The old
 * interceptor guarded this with `req.url.includes('refresh_token')` — CAIRA's
 * path is `refresh`, so that substring check silently stopped matching and the
 * guard was dead. An explicit flag cannot drift with a URL.
 */
export const SKIP_AUTH_REFRESH = new HttpContextToken<boolean>(() => false);

/** Options bag accepted by every `ApiClient` verb. */
export interface RequestOptions {
  body?: unknown;
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  observe?: 'body' | 'events' | 'response';
  params?:
    HttpParams | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  reportProgress?: boolean;
  responseType?: 'json' | 'arraybuffer' | 'blob' | 'text';
  withCredentials?: boolean;
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * Pagination accepted by the three web LMS list endpoints.
 *
 * Server clamps `limit` to `max(1, min(100, limit))` (default 6) and `page` to
 * `max(1, page)`. An out-of-range page is not an error — the slice yields `[]`
 * while `total_count` stays the full pre-slice count.
 *
 * `offset` is legacy and **overrides `page`** whenever it is present and
 * non-blank. Send one or the other, never both.
 */
export interface CairaPagination {
  limit?: number;
  page?: number;
  /** @deprecated Overrides `page` server-side. Present only for legacy callers. */
  offset?: number;
}

/**
 * Course, chapter, instructor, level and badge-template ids are UUID strings.
 * Aliased so the UUID-vs-integer split stays visible at every call site —
 * `Webinar.webinar_id` is an integer and must not be typed with this.
 */
export type CairaUuid = string;

/** `Webinar.webinar_id` — an integer, unlike every other CAIRA identifier. */
export type WebinarId = number;
