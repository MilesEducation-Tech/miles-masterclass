import { PartnerPagination } from '../../../partner-platform/shared/models/partner-platform.model';

/**
 * A row from `GET partners/superadmin/users/`. Note the list shape differs from the write
 * payload: `country_selected` comes back as a display NAME (e.g. "USA") here but
 * is sent as a numeric id on onboard/update, and the corporate FKs surface as
 * `company`/`sector`/`job_role` (not `*_id`). Prefill maps best-effort.
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
  profession: number | null;
  professional_courses: number[];
  state_board: number[];
  country_selected: string | number | null;
  company: number | null;
  sector: number | null;
  job_role: number | null;
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
  // Part of the onboard contract but with NO frontend GET source (the profile
  // page doesn't fetch a numeric-country list or an experience list). Left
  // optional/omitted until a real endpoint exists — see facade note.
  country_selected?: number | null;
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

/** `POST partners/superadmin/users/<id>/offline-payment/` response. */
export interface OfflinePaymentResponse {
  status: boolean;
  data?: {
    user_id: number;
    order_id: number;
    transaction_id: number;
    payment_id: string;
    payment_mode: string;
    amount_paid: number;
    subscription_status: string;
    receipt_url: string;
  };
  message: string;
}
