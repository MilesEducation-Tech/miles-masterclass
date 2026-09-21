import { PartnerPagination } from '../../../partner-platform/shared/models/partner-platform.model';

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed';
export type LeadStatusFilter = 'all' | LeadStatus;

/** One row of `partners/superadmin/leads/` (docs/LEADS_API.md). */
export interface FirmInquiry {
  id: number;
  full_name: string;
  email: string;
  firm_name: string;
  job_role: string;
  help_type: string[];
  enquiry_type: string;
  keep_updated: boolean;
  status: LeadStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LeadsResponse {
  data: FirmInquiry[];
  pagination_data: PartnerPagination;
}

/** `PATCH /<id>/` body — the API requires at least one of the two. */
export type LeadPatch = Partial<Pick<FirmInquiry, 'status' | 'notes'>>;

export const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'converted', 'closed'];
