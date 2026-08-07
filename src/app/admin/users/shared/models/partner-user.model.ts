/**
 * Models for the Django `/api/reports/partner-admin/users/` endpoint that powers
 * the admin Users page.
 */

export interface PartnerUserCourseBuckets {
  masterclass_id: number[];
  podcast_id: number[];
  nano_learning_id: number[];
}

export interface PartnerUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  professional_qualification: string;
  state_board: string;
  date_of_signup: string;
  date_of_login: string;
  is_blocked: boolean;

  courses_completed_cpe: number;
  cpe_credits_earned: number;
  courses_in_progress_cpe: number;
  cpe_credits_in_progress: number;
  caira_credits_earned: number;
  caira_credits_in_progress: number;
  courses_completed_preview: number;
  courses_in_progress_preview: number;

  // Per-metric course ids, already bucketed by type by the backend. (The docs
  // describe flat arrays + top-level type lists, but the live serializer
  // returns this bucket shape — see the RCA on the "No course data" toast.)
  courses_completed_cpe_ids: PartnerUserCourseBuckets;
  cpe_credits_earned_ids: PartnerUserCourseBuckets;
  courses_in_progress_cpe_ids: PartnerUserCourseBuckets;
  cpe_credits_in_progress_ids: PartnerUserCourseBuckets;
  caira_credits_earned_ids: PartnerUserCourseBuckets;
  caira_credits_in_progress_ids: PartnerUserCourseBuckets;
  courses_completed_preview_ids: PartnerUserCourseBuckets;
  courses_in_progress_preview_ids: PartnerUserCourseBuckets;
}

// API expects `all | blocked | active` (see docs/PARTNER_PLATFORM_API.md).
export type BlockedStatusFilter = 'all' | 'blocked' | 'active';

/**
 * Pagination for `/partner-admin/users/` — `next_page`/`previous_page` are
 * full URLs (or null), unlike the coupon endpoints' page numbers.
 */
export interface PartnerUsersPagination {
  total_count: number;
  current_page_number: number;
  next_page: string | null;
  previous_page: string | null;
}

export interface PartnerUsersResponse {
  data: PartnerUser[];
  pagination_data?: PartnerUsersPagination;
}

export interface BlockStatusRequest {
  is_blocked: boolean;
  reason?: string;
}

export interface BlockStatusResponse {
  status: boolean;
  is_blocked: boolean;
  user_id: number;
}
