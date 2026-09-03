import { DialCodeWithLength } from '../constant/dial-code';
import { CommonResponse, RouteConfig } from './http.model';

export interface AuthModel {
  identifier: string;
  email: string;
  country_code: string;
  phone: string;
  /** Mandatory Terms & conditions acceptance. Gates the Send OTP action. */
  terms: boolean;
  /** Optional SMS/WhatsApp (or email) marketing consent. Feeds `sms_consent`. */
  consent: boolean;
}

export interface OtpModel {
  /**
   * The email or E.164 phone the code was sent to.
   *
   * Replaces the old `session_id`: Miles SSO has no server-side OTP session.
   * The same identifier is posted to send and then to verify, so it has to
   * survive the LOGIN -> OTP transition.
   */
  identifier: string;
  otp: string;
}

export type CountryCodeOption = DialCodeWithLength & { value: string; label: string };

// ─────────────────────────────────────────────────────────────────────────────
// Miles SSO auth types
//
// Three differences from the previous integration drive everything below:
//
//   1. There is no `session_id`. The *identifier* is what the client carries
//      between send and verify.
//   2. Send answers a delivery `channel`. UI copy must be written from that
//      value, never from which tab the user clicked — an Indian phone number is
//      routed by WhatsApp, and a WhatsApp send the provider refuses is retried
//      on SMS and comes back as `sms`.
//   3. Refresh returns a **new** refresh token. They rotate; the old one dies
//      seconds after use.
// ─────────────────────────────────────────────────────────────────────────────

/** How a code was actually delivered. Read it; never infer it. */
export type SsoOtpChannel = 'email' | 'sms' | 'whatsapp';

/** Which credential to ask for. Render whatever the server returns, in order. */
export type SsoAuthMethod = 'email_otp' | 'phone_otp' | 'password' | 'saml';

/**
 * Identifier shape shared by identify / send / verify.
 *
 * Send either `identifier` outright, or the `email` / `phone` + `country_code`
 * pair the login form already produces and let the backend join it into E.164.
 */
export type SsoIdentifierRequest =
  { identifier: string } | { email: string } | { phone: string; country_code: string };

export interface SsoIdentifyResult {
  identifier: string;
  account_type: 'b2c' | 'b2b' | null;
  /**
   * Ordered. Render all of them and pre-select `default_method`; do not
   * reorder, and do not assume the list. This is the seam enterprise SSO
   * arrives through — the same call starts answering `saml` and a client that
   * renders `methods` needs no change.
   */
  methods: SsoAuthMethod[];
  default_method: SsoAuthMethod | null;
  masked_email: string | null;
  masked_phone: string | null;
  /**
   * Whether an account already exists.
   *
   * Safe for branching UI copy, and **not** proof of anything: anyone can ask
   * about any address. Authorisation still comes from a verified token.
   */
  is_existing_user: boolean;
}

export interface SsoSendOtpRequest {
  identifier?: string;
  email?: string;
  phone?: string;
  country_code?: string;
  /**
   * Forces delivery for a phone identifier — the "the WhatsApp code never
   * arrived, send me an SMS" action. Honoured exactly as sent and never
   * rerouted, so only ever set it from a deliberate user action.
   */
  channel?: 'sms' | 'whatsapp';
}

export interface SsoSendOtpResult {
  /** Echoed back so the client stores exactly what verify must be posted with. */
  identifier: string;
  channel: SsoOtpChannel;
  /** A server-side stopgap being withdrawn. Never branch on it. */
  dev_code?: string;
}

export interface SsoVerifyOtpRequest {
  identifier?: string;
  email?: string;
  phone?: string;
  country_code?: string;
  /**
   * 4-10 digits. Not fixed at 6: the code length is a server-side setting, and
   * a field that does not care survives a change to it without a deploy.
   */
  code: string;
  sms_consent?: boolean;
  browser_session_id?: string;
  utm_url?: string;
}

export interface SsoRefreshRequest {
  refresh_token: string;
}

/** The one session shape returned by verify, password login and refresh. */
export interface SsoSessionData {
  token: string;
  /**
   * Always present, including on refresh. Refresh tokens rotate — storing the
   * one you already had loses the session on the next refresh.
   */
  refreshtoken: string;
  /** Seconds. Short by design (15 min target), so refresh on a timer. */
  expires_in: number;
  token_type: string;
  communication_id: string | null;
  /** True while SSO does not yet know who this person is. */
  onboarding_required: boolean;
  roles: string[];
  /** Applications this user may enter. Test membership; never index. */
  apps: string[];
  /** Applications with an active enrollment. */
  enrolled: string[];
  /** Absent on refresh; present on a login. */
  is_signup?: boolean;
  user: User;
}

/**
 * Body of a 403 when a pre-login gate refuses the identifier — the LMS
 * migration prompt rather than a login error.
 */
export interface SsoBlockedData {
  is_lms_access_blocked?: boolean;
  lms_user_type?: LmsUserType | null;
}

/** Body of a 429. Drive the countdown from this, not from a hardcoded 60. */
export interface SsoRateLimitData {
  retry_after_seconds: number | null;
}

// Country Detail
export interface CountryDetail {
  id: number;
  created_at: string;
  country_name: string;
  country_code: string;
  currency: string;
  currency_symbol: string;
  tax_percent: number;
  updated_by: string | null;
}

// Onboarding Message
export interface OnboardingMessage {
  heading_text: string;
  subtext: string;
}

// User Type Enums
export type UserType = 'User' | 'Admin' | 'Staff';
export type QualificationStatus = 'na' | 'yes' | 'no';
export type LmsStatus = 'cpa_alumni' | 'student' | 'enrolled' | null;
export type AccountType = 'UGA' | 'CPA' | null;
export type CreationPlatform = 'Masterclass' | 'LMS' | 'Mobile';
export type AppSource = 'WA' | 'IOS' | 'AN' | null;

// Full User Model from myProfile API
export interface User {
  id: number;
  company: { id: number; company_name: string }[] | null;
  sector: { id: number; name: string } | null;
  job_role: { id: number; name: string } | null;
  state_board_name: string[] | null;
  professional_courses: number[] | null;
  onboarding_message: OnboardingMessage | null;
  has_platform_free_access: boolean;
  email: string;
  first_name: string;
  last_name: string;
  miles_user_id: string;
  country_code: string;
  location: string | null;
  mobile: string | null;
  is_existing_user: boolean;
  is_currently_working: boolean;
  terms_accepted: boolean;
  qualification_status: QualificationStatus | null;
  license_status: string | null;
  experience_id: number | null;
  is_beta_access: boolean;
  /** True once the user has filled the mandatory fields in their profile.
   * Required to submit course feedback / download CPE certificates. Field is
   * optional in the type because legacy responses may omit it — treat
   * anything other than literal `true` as not-completed. */
  is_profile_completed?: boolean;
  /** True once the Microsoft AI Lab account has been provisioned for this user.
   * Optional for the same reason as `is_profile_completed` — a cached or legacy
   * profile payload omits it, and anything other than literal `true` means the
   * account doesn't exist yet. */
  is_ai_lab_user?: boolean;
}

// My Profile Response
export interface MyProfileResponse {
  data: User;
  status_code: boolean;
  message: string;
}

// Verify OTP Response
//
// Legacy shape, still used by the faculty registration page (`v2/faculty/*`),
// which has its own OTP flow on the previous SSO integration. The login page no
// longer uses it — see `SsoSessionData`.
export interface VerifyOTPData {
  token: string;
  refreshtoken: string;
  expire_time?: string;
  /**
   * Access-token lifetime in seconds. Pass it to `Auth.storeTokens` — it is
   * what arms the proactive refresh, and without it a short token expires
   * mid-session instead of renewing silently.
   */
  expires_in?: number;
  user: User;
}

export interface VerifyOTPResponse {
  data: VerifyOTPData;
  status: boolean;
  message: string;
}

export interface CurrentPlanData {
  id: number;
  remaining_days: number;
  paid_amount: number;
  transaction_mode: string;
  subscription_status: string;
  trial_duration: number | null;
  current_time: string;
  platform: string;
  valid_from: string;
  valid_to: string;
}

export const AUTH_ROUTES = {
  myProfile: {
    path: 'v2/user/myprofile/',
    method: 'GET',
  } as RouteConfig<void, MyProfileResponse>,

  currentPlan: {
    path: 'v2/user/active-plan/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<CurrentPlanData>>,
} as const;

/**
 * Miles SSO routes, proxied by the Masterclass backend (`apps.sso`).
 *
 * The browser never calls SSO directly: it sends no CORS headers and a
 * preflight `OPTIONS` answers 404. Going through our own backend is the
 * recommended shape anyway — no SSO token reaches a foreign origin.
 */
export const SSO_AUTH_ROUTES = {
  /**
   * Which login methods to offer. Called before rendering credential UI so the
   * form is never hardcoded to one method.
   */
  identify: {
    path: 'sso/identify/',
    method: 'POST',
  } as RouteConfig<SsoIdentifierRequest, CommonResponse<SsoIdentifyResult>>,

  sendOtp: {
    path: 'sso/otp/send/',
    method: 'POST',
  } as RouteConfig<SsoSendOtpRequest, CommonResponse<SsoSendOtpResult>>,

  verifyOtp: {
    path: 'sso/otp/verify/',
    method: 'POST',
  } as RouteConfig<SsoVerifyOtpRequest, CommonResponse<SsoSessionData>>,

  refreshToken: {
    path: 'sso/token/refresh/',
    method: 'POST',
  } as RouteConfig<SsoRefreshRequest, CommonResponse<SsoSessionData>>,

  logout: {
    path: 'sso/logout/',
    method: 'POST',
  } as RouteConfig<{ scope?: 'local' | 'global' }, CommonResponse<unknown>>,
} as const;

export type LmsUserType = 'lms_enrolled' | 'caira' | 'cpa_alumni' | 'cma_alumni' | 'non_lms';

export interface PopupContent {}
