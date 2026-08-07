/**
 * Wire shapes for the CAIRA auth surface — endpoints #33, #34, #35, #41,
 * #42, #43, #44, #45.
 *
 * These mirror the API exactly, snake_case and camelCase inconsistencies
 * included. Nothing here reaches a template: `toCairaUser()` maps them onto the
 * app's own view model.
 *
 * Only the **web** login routes are modelled. The unprefixed mobile twins
 * (#39/#40) are deliberately unbound — #39 returns the generated OTP to any
 * anonymous caller with no throttle, and #40 has no profile-completion gate.
 */

// ---------------------------------------------------------------------------
// Shared login payload — #33 and #35 return the same envelope
// ---------------------------------------------------------------------------

/**
 * The SSO's user object, passed through verbatim.
 *
 * ⚠️ `countryCode` arrives as `"91"` from #33 but `"+91"` from #35, for the
 * same account. Normalise on read — `toCairaUser` does.
 */
export interface SsoUser {
  userId: string | null;
  phone: string | null;
  countryCode: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePicture: string | null;
}

/**
 * `result` is an opaque pass-through of the external SSO's JSON. Only the keys
 * this backend itself reads are guaranteed; anything else is SSO-defined and
 * can change without a backend deploy.
 *
 * `refresh_token` is documented on #33 but **absent from #35's example**. Treat
 * it as optional and fall back to an empty string rather than assuming it.
 */
export interface LoginResult {
  token: string;
  refresh_token?: string;
  user?: SsoUser;
}

/** #33 and #35 · 200/201. The SSO body plus exactly three injected keys. */
export interface LoginResponse {
  result?: LoginResult;
  /**
   * ⚠️ **Not a reliable signal on web.** `_finalize_login` sets this to a
   * hardcoded literal `true` on #33, so it says nothing about whether the
   * profile is actually complete. Derive completeness from #42's `mo_*` fields
   * instead — see `isProfileComplete`.
   */
  onboarding?: boolean;
  show_referral_code?: boolean;
  is_test_user?: boolean;
}

// ---------------------------------------------------------------------------
// #33 · POST web/login-with-email-password
// ---------------------------------------------------------------------------

/**
 * `application_id` is never taken from the client — the view injects
 * `settings.SSO_WEB_LOGIN_APPLICATION_ID`. Do not add it.
 *
 * `email` is an alias the view reads only when `user_name` is falsy. Sending
 * `user_name` alone is the unambiguous form.
 */
export interface EmailPasswordLoginRequest {
  user_name: string;
  password: string;
}

/** Machine-readable failures unique to the `web/*` login routes. */
export type WebLoginCode =
  | 'MISSING_CREDENTIALS'
  | 'INVALID_CREDENTIALS'
  | 'PROFILE_INCOMPLETE'
  | 'MULTIPLE_ACCOUNTS'
  | 'MISSING_FIELDS'
  | 'DEV_OTP_NOT_ALLOWED'
  | 'SSO_UNAVAILABLE'
  | 'SSO_MALFORMED_RESPONSE'
  | 'SSO_TIMEOUT'
  | 'SYNC_FAILED';

// ---------------------------------------------------------------------------
// #34 · POST web/login-with-phone-otp
// ---------------------------------------------------------------------------

/**
 * OTP delivery channel, per the SSO's enum.
 *
 * `5` is dev-OTP — the SSO returns the code in the response body instead of
 * sending it. #34 **rejects** it outright with `DEV_OTP_NOT_ALLOWED` and strips
 * `otp_dev` from any response, which is exactly why web binds #34 rather than
 * the mobile twin. It is not in this union and must never be sent.
 */
export const OtpChannel = {
  SMS: 1,
  WHATSAPP: 2,
} as const;
export type OtpChannel = (typeof OtpChannel)[keyof typeof OtpChannel];

export interface SendOtpRequest {
  phone: string;
  country_code: string;
  communication_method: OtpChannel;
}

/** #34 · 200/201 · the SSO payload verbatim, minus `otp_dev`. */
export interface SendOtpResponse {
  result?: {
    session_id: string | number;
    is_new_user?: boolean;
  };
}

// ---------------------------------------------------------------------------
// #35 · POST web/verify-otp
// ---------------------------------------------------------------------------

/** Neither field is trimmed server-side, and there is no length/format check. */
export interface VerifyOtpRequest {
  session_id: string | number;
  otp: string;
}

// ---------------------------------------------------------------------------
// #42 · GET v2/status  (GET only — a POST 405s)
// ---------------------------------------------------------------------------

/** Always `{ text, value }` on #42 — but **not** guaranteed so on #43. */
export interface EducationField {
  text: string;
  value: unknown[];
}

/**
 * Exactly 19 keys. `sso_*` prefer the live SSO value and fall back to the local
 * row — **except `sso_profilePicture`, which only ever reads the local column**.
 */
export interface StatusData {
  sso_user_id: string | null;
  sso_phone: string | null;
  sso_countryCode: string | null;
  sso_profilePicture: string | null;
  mo_first_name: string | null;
  mo_last_name: string | null;
  mo_full_name: string | null;
  mo_location: string | null;
  mo_email: string | null;
  mo_education: EducationField | null;
  /** A Yes/No flag, **not** the raw pick list — those are in `mo_learning_pathway`. */
  mo_pathway: string | null;
  mo_tags: string[] | null;
  mo_professional_qualification: string[] | null;
  mo_work_experience: string | null;
  mo_career_path: string[] | null;
  mo_learning_pathway: string[] | null;
  mo_ai_readiness: string | null;
  mo_email_verified: boolean | null;
  is_test_user: boolean | null;
}

export interface StatusResponse {
  message: string;
  data: StatusData;
}

// ---------------------------------------------------------------------------
// #43 · POST v2/update  (partial update — every field optional)
// ---------------------------------------------------------------------------

/**
 * Multi-selects accept a list, a tuple or a string; the view normalises and
 * re-joins with `", "`.
 *
 * Two combinations are rejected with a 400: `"Not Sure Yet"` alongside another
 * pathway pick, and `"None"` alongside another professional-qualification pick.
 * Both are enforced client-side too — cheaper than a round trip.
 *
 * `learning_pathway` is **overwritten by `pathway`** whenever `pathway` is
 * sent, so sending both is pointless.
 */
export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  city?: string;
  /** Aliased to `profile_picture`; if both are sent the snake_case wins. */
  profilePicture?: string;
  pathway?: string[];
  career_path?: string[];
  professional_qualification?: string[];
  learning_pathway?: string[];
  work_experience?: string;
  ai_readiness?: string;
  graduation?: string;
  graduation_year?: string;
  gender?: string;
}

/**
 * #43 · 200. `data` has **18** keys, not #42's 19 — `is_test_user` is absent.
 *
 * When the email-verification loopback fails the call still returns **200**,
 * with `email_verification` present and the email simply not saved. Check for
 * that key before telling the user their email changed.
 */
export interface UpdateUserResponse {
  message: string;
  data: Partial<StatusData>;
  email_verification?: {
    status: 'failed';
    submitted_email: string;
    details: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// #44 / #45 · certificate name
// ---------------------------------------------------------------------------

/**
 * camelCase, unlike every other write on this surface.
 *
 * ⚠️ An explicit `"firstName": null` 400s rather than falling back to
 * `first_name` — `dict.get(k, default)` evaluates the default eagerly. Always
 * send non-empty strings.
 */
export interface UpdateCertificateNameRequest {
  firstName: string;
  lastName: string;
}

/** Note `status: "success"`, where #42/#43 use `message: "Success"`. */
export interface UpdateCertificateNameResponse {
  status: 'success';
  first_name: string;
  last_name: string;
  name: string;
}

/** #45 · exactly 2 keys. ⚠️ `name` is **not** returned despite the docstring. */
export interface CertificateName {
  first_name: string;
  last_name: string;
}

// ---------------------------------------------------------------------------
// App-side view model
// ---------------------------------------------------------------------------

/**
 * What the app holds and templates read. Camel-cased and normalised, so no
 * component has to know that the same account reports `"91"` on one endpoint
 * and `"+91"` on another.
 */
export interface CairaUser {
  userId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  /** Always stored with a leading `+`, whichever form the endpoint returned. */
  countryCode: string;
  profilePicture: string | null;
  location: string;
  emailVerified: boolean;
  isTestUser: boolean;
  tags: string[];
  pathway: string | null;
  learningPathway: string[];
  careerPath: string[];
  professionalQualification: string[];
  workExperience: string | null;
  aiReadiness: string | null;
  education: EducationField | null;
}

/** `"91"` and `"+91"` both become `"+91"`; blank stays blank. */
export function normalizeCountryCode(code: string | null | undefined): string {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

/** Empty strings are as good as absent; keeps `||` chains in templates honest. */
function str(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function list(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

/** #42's `data` → the app's user. */
export function toCairaUser(data: StatusData): CairaUser {
  const firstName = str(data.mo_first_name);
  const lastName = str(data.mo_last_name);
  return {
    userId: data.sso_user_id,
    firstName,
    lastName,
    fullName: str(data.mo_full_name) || `${firstName} ${lastName}`.trim(),
    email: str(data.mo_email),
    phone: str(data.sso_phone),
    countryCode: normalizeCountryCode(data.sso_countryCode),
    // `''` would break `ngSrc` (NG02952) the moment this reaches an <img>.
    profilePicture: str(data.sso_profilePicture) || null,
    location: str(data.mo_location),
    emailVerified: data.mo_email_verified === true,
    isTestUser: data.is_test_user === true,
    tags: list(data.mo_tags),
    pathway: data.mo_pathway,
    learningPathway: list(data.mo_learning_pathway),
    careerPath: list(data.mo_career_path),
    professionalQualification: list(data.mo_professional_qualification),
    workExperience: data.mo_work_experience,
    aiReadiness: data.mo_ai_readiness,
    education: data.mo_education,
  };
}

/** A login response's `user` object → a partial user, for the pre-#42 window. */
export function ssoUserToCairaUser(sso: SsoUser): CairaUser {
  const firstName = str(sso.firstName);
  const lastName = str(sso.lastName);
  return {
    userId: sso.userId,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: '',
    phone: str(sso.phone),
    countryCode: normalizeCountryCode(sso.countryCode),
    profilePicture: str(sso.profilePicture) || null,
    location: '',
    emailVerified: false,
    isTestUser: false,
    tags: [],
    pathway: null,
    learningPathway: [],
    careerPath: [],
    professionalQualification: [],
    workExperience: null,
    aiReadiness: null,
    education: null,
  };
}

/**
 * Whether the learner has enough of a profile to use the app.
 *
 * Mirrors what the **mobile** `verify-otp` computes for its `onboarding` flag:
 * `bool(first_name) and bool(name) and bool(email)`. The web login routes
 * cannot be used for this — #33 hardcodes `onboarding: true` — so it is derived
 * from `v2/status`, which reports the real column values.
 */
export function isProfileComplete(user: CairaUser | null): boolean {
  return !!user && !!user.firstName && !!user.fullName && !!user.email;
}
