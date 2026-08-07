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
  session_id: string;
  otp: string;
}

export type CountryCodeOption = DialCodeWithLength & { value: string; label: string };

// OTP Request/Response Types
export type SendOTPRequest = { email: string } | { phone: string; country_code: string };
export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface SendOTPResult {
  is_new_user: boolean;
  new_user: unknown | null;
  session_id: number;
  is_lms_access_blocked: boolean;
  lms_user_type: LmsUserType | null;
  otp_dev?: number; // Only in dev environment
}

export interface SendOTPResponse {
  status: boolean;
  path: string;
  statusCode: number;
  result: SendOTPResult;
}

export interface VerifyOTPRequest {
  session_id: number;
  otp: string;
  browser_session_id: string;
  utm_url?: string;
  /** Whether the user checked the SMS/WhatsApp consent box on the login step. Defaults to false. */
  sms_consent: boolean;
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
}

// My Profile Response
export interface MyProfileResponse {
  data: User;
  status_code: boolean;
  message: string;
}

// Verify OTP Response
export interface VerifyOTPData {
  token: string;
  refreshtoken: string;
  expire_time: string;
  user: User;
}

export interface VerifyOTPResponse {
  data: VerifyOTPData;
  status: boolean;
  message: string;
}

export interface RefreshTokenResponse {
  status: boolean;
  path: string;
  statusCode: number;
  result: {
    token: string;
    user: User;
  };
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
  sendOtp: {
    path: 'send-otp-to-phone',
    method: 'POST',
  } as RouteConfig<SendOTPRequest, CommonResponse<SendOTPResponse>>,

  verifyOtp: {
    path: 'v2/verify-otp/',
    method: 'POST',
  } as RouteConfig<VerifyOTPRequest, VerifyOTPResponse>,

  myProfile: {
    path: 'v2/user/myprofile/',
    method: 'GET',
  } as RouteConfig<void, MyProfileResponse>,

  refreshToken: {
    path: 'refresh_token/',
    method: 'POST',
  } as RouteConfig<RefreshTokenRequest, RefreshTokenResponse>,

  currentPlan: {
    path: 'v2/user/active-plan/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<CurrentPlanData>>,
} as const;

export type LmsUserType = 'lms_enrolled' | 'caira' | 'cpa_alumni' | 'cma_alumni' | 'non_lms';

export interface PopupContent {}
