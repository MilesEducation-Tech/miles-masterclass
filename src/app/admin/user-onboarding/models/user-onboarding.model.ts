import { PartnerPagination } from '@admin/core/models/partner-platform.model';

/**
 * A row from `GET partners/superadmin/users/`. The list shape differs from the
 * write payload: every FK comes back as a display NAME (`profession: "CPA"`,
 * `state_board: ["New York"]`, `company: "Acme LLP"`, `country_selected: "USA"`)
 * while onboard/update take numeric ids (`profession`, `company_id`, …). The
 * edit form maps names → ids by label against the reference lists; backend ask:
 * return the ids alongside the names so that mapping isn't fragile.
 */
export interface InternalUser {
  id: number;
  email: string;
  email_domain: string | null;
  first_name: string;
  last_name: string;
  mobile: string | null;
  country_code: string | null;
  location: string | null;
  qualification_status: string;
  license_status: string | null;
  is_currently_working: boolean;
  terms_accepted: boolean;
  sms_consent: boolean | null;
  created_at: string;
  last_login: string | null;
  creation_platform: string | null;
  account_type: string | null;
  profession: string | null;
  professional_courses: string[];
  state_board: string[];
  country_selected: string | null;
  company: string | null;
  sector: string | null;
  job_role: string | null;
  partner_code: string | null;
  is_subscribed: boolean;
}

export interface UsersListResponse {
  status_code?: number;
  data: InternalUser[];
  message?: string;
  pagination_data?: PartnerPagination;
}

/** Body for `POST partners/superadmin/users/`. Corporate FKs are optional. */
export interface OnboardUserPayload {
  email: string;
  // Everything below is optional — the form only sends fields the admin filled.
  first_name?: string;
  last_name?: string;
  mobile?: string;
  country_code?: string;
  location?: string;
  partner_code?: string;
  profession?: number | null;
  professional_courses?: number[];
  state_board?: number[];
  qualification_status?: string | null;
  license_status?: string | null;
  is_currently_working?: boolean;
  terms_accepted?: boolean;
  sms_consent?: boolean;
  company_id?: number | null;
  sector_id?: number | null;
  job_role_id?: number | null;
  // No admin-callable country list exists (`GET /api/country/` needs a learner
  // JWT) — omitted until a superadmin endpoint lands. See backend asks.
  country_selected?: number | null;
  /** Fixed backend map (no table): 1 = 0-2 yrs, 2 = 2-5, 3 = 5-10, 4 = 10+. */
  experience_id?: number | null;
}

/** Body for `PATCH partners/superadmin/users/` — the onboard payload plus the id. */
export interface UpdateUserPayload extends OnboardUserPayload {
  user_id: number;
}

/** Both `partners/superadmin/users/` writes (POST and PATCH) return this. */
export interface MutateUserResponse {
  status: boolean;
  message: string;
}

/**
 * `POST partners/superadmin/users/<id>/offline-payment/` success `data`.
 * `receipt_url` is null when a comment (not an invoice) was the proof;
 * `payment_note` echoes that comment back.
 */
export interface OfflinePaymentResult {
  user_id: number;
  order_id: number;
  transaction_id: number;
  payment_id: string;
  payment_mode: string;
  amount_paid: number;
  subscription_status: string;
  receipt_url: string | null;
  payment_note: string | null;
}

export interface OfflinePaymentResponse {
  status: boolean;
  data?: OfflinePaymentResult;
  message: string;
}
