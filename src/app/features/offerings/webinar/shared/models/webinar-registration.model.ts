import { LmsUserType } from '../../../../../shared/core/models/auth.model';

/**
 * Pre-login webinar registration API contracts.
 *
 * Flow:
 *   1. `POST /webinar/registrations/` with the registration form payload.
 *   2. Backend returns one of three flows:
 *      - `direct_enrolled`  → user is enrolled immediately, no further action.
 *      - `already_enrolled` → already-enrolled short-circuit, no further action.
 *      - `otp_required`     → backend emailed an OTP; hit `/verify-otp/` next.
 *   3. On OTP path, `POST /webinar/registrations/verify-otp/` with the
 *      `identifier` the code was sent to + the 6-digit code finalises the
 *      enrollment.
 *
 * Out-of-band: if the email is LMS-routed (CAIRA / enrolled / alumni), the
 * registration call returns `status: false` with `data.is_lms_access_blocked`
 * set — the UI then surfaces the same "content has moved" dialog used in the
 * login flow instead of progressing.
 */

/** Request body for `POST /webinar/registrations/`. */
export interface WebinarRegistrationRequest {
  email: string;
  first_name: string;
  last_name: string;
  mobile: string;
  country_code: string;
  location: string;
  webinar_id: number;
  webinar_date_id: number;
  company_id?: number | null;
  browser_session_id: string;
  /** Raw campaign token captured from the `?dXRt=` landing link (see `Utm`). */
  utm_url?: string;
}

/** Discriminator returned in `data.flow`. */
export type WebinarRegistrationFlow = 'otp_required' | 'direct_enrolled' | 'already_enrolled';

/** `data` payload returned when OTP verification is required. */
export interface WebinarRegistrationOtpRequired {
  flow: 'otp_required';
  already_enrolled: false;
  /**
   * The address the code was sent to, echoed back by the server.
   *
   * Replaces `session_id`: Miles SSO has no server-side OTP session, so the
   * identifier is what ties send to verify.
   */
  identifier: string;
  /** How the code was actually delivered. Email-only on this form today. */
  channel?: 'email' | 'sms' | 'whatsapp';
  /** A server-side stopgap being withdrawn upstream. Never branch on it. */
  dev_code?: string;
}

/** `data` payload returned when the registration short-circuits to enrolled. */
export interface WebinarRegistrationDirectEnrolled {
  flow: 'direct_enrolled';
  already_enrolled: boolean;
  auto_login: boolean;
  user?: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
}

/** `data` payload returned when the user was already registered for this session. */
export interface WebinarRegistrationAlreadyEnrolled {
  flow: 'already_enrolled';
  already_enrolled: true;
}

export type WebinarRegistrationResult =
  | WebinarRegistrationOtpRequired
  | WebinarRegistrationDirectEnrolled
  | WebinarRegistrationAlreadyEnrolled;

/**
 * `data` payload returned when the email is access-restricted (LMS routing).
 *
 * Currently the backend surfaces this as **HTTP 403** with the body below,
 * so it lands in the RxJS `error` callback (at `err.error.data`). The same
 * shape may also appear on a 200 with `status: false` if the backend ever
 * flips — the type guard operates on `unknown` so either path can route
 * through it without re-typing.
 */
export interface WebinarRegistrationAccessBlocked {
  is_lms_access_blocked: boolean;
  lms_user_type: LmsUserType | null;
}

export interface WebinarRegistrationResponse {
  status: boolean;
  message: string;
  data?: WebinarRegistrationResult;
}

/** Type guard for the access-restricted branch of the registration response. */
export function isWebinarRegistrationAccessBlocked(
  data: unknown,
): data is WebinarRegistrationAccessBlocked {
  return (
    !!data &&
    typeof data === 'object' &&
    'is_lms_access_blocked' in data &&
    (data as { is_lms_access_blocked: unknown }).is_lms_access_blocked === true
  );
}

/** Request body for `POST /webinar/registrations/verify-otp/`. */
export interface WebinarRegistrationVerifyRequest {
  /** Echoed back from the register step — see `WebinarRegistrationOtpRequired`. */
  identifier: string;
  otp: string;
  /** Raw campaign token captured from the `?dXRt=` landing link (see `Utm`). */
  utm_url?: string;
}

/**
 * Verification response. `data` mirrors the post-OTP success shape from the
 * registration endpoint (direct_enrolled or already_enrolled).
 */
export interface WebinarRegistrationVerifyResponse {
  status: boolean;
  message: string;
  data?: WebinarRegistrationDirectEnrolled | WebinarRegistrationAlreadyEnrolled;
}
