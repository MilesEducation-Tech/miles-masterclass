// user/companies/?

import { User } from './auth.model';
import { CommonResponse, RouteConfig } from './http.model';

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
