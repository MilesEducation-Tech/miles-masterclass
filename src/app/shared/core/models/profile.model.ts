// user/companies/?

import { CommonResponse, RouteConfig } from './http.model';

/**
 * The signed-in user's profile.
 *
 * Lived in `auth.model.ts` until the auth layer was removed. Nothing fetches
 * it any more — it stays because the profile form and the routes below are
 * typed against it.
 */
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
   * Optional for the same reason as `is_profile_completed`. */
  is_ai_lab_user?: boolean;
}

export type QualificationStatus = 'na' | 'yes' | 'no';

export interface OnboardingMessage {
  heading_text: string;
  subtext: string;
}

export interface CompanyList {
  id: number;
  company_name: string;
  is_active: boolean;
}

export interface ProfessionalCourseList {
  id: number;
  title: string;
  description: string;
  professional_type: number;
  is_active: boolean;
  display_order: number;
  updated_by: number;
}

export interface ProfessionList {
  id: number;
  name: string;
}

export interface StateBoardList {
  id: number;
  name: string;
  board_type: string;
  email: string | null;
  phone: string | null;
  priority: number;
  is_active: true;
  updated_by: null;
}

export interface ProfileFormState {
  email: string;
  first_name: string;
  last_name: string;
  country_code: string;
  location: string;
  mobile: string;
  is_currently_working: boolean;
  terms_accepted: boolean;
  license_status: string;
  state_board: number[];
  professional_courses: number[];
  company_id: number | null;
  sector_id: number | null;
  job_role_id: number | null;
}

export interface JobRole {
  id: number;
  name: string;
}

export interface JobSector {
  id: number;
  name: string;
  roles: JobRole[];
}

export const PROFILE_ROUTES = {
  getCompanyList: {
    path: 'user/companies/',
    method: 'GET',
  } as RouteConfig<{}, CommonResponse<CompanyList[]>, {}, { search: string }>,

  getProfessionalCourseList: {
    path: 'user/professional-course/',
    method: 'GET',
  } as RouteConfig<{}, CommonResponse<ProfessionalCourseList[]>>,

  getProfessionList: {
    path: 'professions/',
    method: 'GET',
  } as RouteConfig<{}, CommonResponse<ProfessionList[]>>,

  getStateBoardList: {
    path: 'user/state-boards/',
    method: 'GET',
  } as RouteConfig<{}, CommonResponse<StateBoardList[]>>,

  getJobSectorList: {
    path: 'user/job-sectors/',
    method: 'GET',
  } as RouteConfig<{}, CommonResponse<JobSector[]>, {}, { page?: number }>,

  saveProfile: {
    path: 'user/profile/update/',
    method: 'PATCH',
  } as RouteConfig<Partial<ProfileFormState>, { user: User; message: string; status: boolean }>,

  applyPartnerCode: {
    path: 'apply-partner-code/',
    method: 'POST',
  } as RouteConfig<{ partner_code: string }, CommonResponse<unknown>>,

  applyFirmSponsorship: {
    path: 'promotion/subscription/firm-sponsorship/',
    method: 'POST',
  } as RouteConfig<
    {
      company_id: number;
      consent_given: boolean;
      subscription_id: number;
      ld_spoc_email: string | null;
    },
    CommonResponse<unknown>
  >,
} as const;
