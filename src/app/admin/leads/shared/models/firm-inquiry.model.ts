export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed';
export type LeadStatusFilter = 'all' | LeadStatus;

export interface FirmInquiry {
  id: string;
  full_name: string;
  email: string;
  firm_name: string;
  job_role: string | null;
  help_type: string[] | null;
  enquiry_type: string;
  keep_updated: boolean;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const LEAD_STATUSES: readonly LeadStatus[] = ['new', 'contacted', 'converted', 'closed'];
