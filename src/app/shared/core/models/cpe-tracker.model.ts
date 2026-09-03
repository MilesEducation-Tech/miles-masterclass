import { CommonResponse, RouteConfig } from './http.model';

export type CreditMode = 'upcoming' | 'completed';

export type StudyModeFilter = 'All' | 'Accounting' | 'Ethics' | 'Others';

export type TransactionType = 'masterclass' | 'nano_learning' | 'webinar' | 'podcast';

/** Raw transaction_type as spelled by the server (typo preserved). */
export type RawTransactionType = 'self_study' | 'nano_learning' | 'webinar' | 'podcast' | string;

export type AssessmentStatus = 'Not_Appeared' | 'Exam_Passed' | 'Exam_Failed' | 'Retake' | null;

// ---------------------------------------------------------------------------
// Domain types (used by the UI + facade + mappers)
// ---------------------------------------------------------------------------

export interface CreditsSummary {
  total: number;
  earned: number;
  required: number;
  pending?: number;
}

export interface StudyModeBreakdown {
  id: number;
  name: string;
  credits: number;
  color?: string;
}

export interface StatisticsData {
  year: number;
  credits: CreditsSummary;
  study_modes: StudyModeBreakdown[];
}

export interface FieldOfStudyCredit {
  id: number;
  name: string;
  cpe_credits: number;
}

export interface UserFeedbackDetails {
  user_feedback_submitted: boolean;
  user_rating?: number;
}

export interface ReportAssessment {
  session_id?: number;
  status: AssessmentStatus;
  certificate_url?: string | null;
  exam_passes_date?: string | null;
  all_classes_completed?: boolean;
}

export interface WebinarDetails {
  webinar_id: number;
  webinar_name?: string;
  webinar_session_id?: number;
  webinar_start_date?: string;
  webinar_end_date?: string;
}

export interface ReportRow {
  id: number;
  master_class: number | null;
  nano_learning: number | null;
  podcast: number | null;
  webinar_details?: WebinarDetails | null;
  course_name: string;
  course_image?: string;
  instructor_name?: string;
  transaction_type: TransactionType;
  /**
   * Raw `course_details.type` from the wire, preserved so feature code can
   * route off the original discriminator (incl. `'premiere'`) without going
   * through the normalized `transaction_type`.
   */
  course_type: RawCourseType;
  field_of_study: FieldOfStudyCredit[];
  delivery_method?: string | null;
  all_classes_completed: boolean;
  completed_at?: string | null;
  registered_at?: string | null;
  assessment?: ReportAssessment | null;
  user_feedback_details?: UserFeedbackDetails;
  total_credits?: number;
  caira_level?: number | null;
  /** Per-completion badge inline on the row (carries Credly `accept_url`). */
  user_badge?: RawUserBadgeInline | null;
  /** Premiere/webinar attendance, e.g. `'Present'`. */
  attendance_status?: string | null;
  /**
   * Server-supplied exam rules text (one rule per newline). Forwarded into
   * the shared `Utils.startFinalAssessment` exam-rules dialog when the user
   * triggers "Take Exam" / "Retake Exam" from the tracker table.
   */
  exam_rules?: string | null;
  is_certificate_eligible?: boolean;
  is_subscription_excluded?: boolean;
  was_caira_credit?: boolean;
}

export interface BadgeItem {
  id: number;
  name: string;
  sub_text?: string;
  description?: string;
  image_url?: string;
  level?: string;
  level_rank?: number;
  required_credits?: number;
  earned_credits?: number;
  progress_percentage: number;
  /**
   * Wire-side gate. `'unlocked'` means the user can currently earn this badge
   * (in-progress UI); `'locked'` means it's gated (grayscale + lock icon). The
   * existing `is_coming_soon` / `is_claimed` / `is_claimable` flags take
   * priority over `status` in the state machine.
   */
  status: 'unlocked' | 'locked';
  is_claimed: boolean;
  is_claimable: boolean;
  is_coming_soon: boolean;
  /** Credly acceptance URL, populated once the badge has been claimed. */
  accept_url?: string;
}

/**
 * One row of `user-assessment/download_bulk_certificate/`. The payload is
 * a flat array — courses with multiple fields of study return one row per
 * cert. `id` repeats across rows for the same course.
 */
export interface BulkCertificateItem {
  id: number;
  title: string;
  certificate_url: string;
  certificate_type: string;
  certificate_mode: string;
  field_of_study_name: string | null;
  cpe_credits: number | null;
}

// ---------------------------------------------------------------------------
// Raw API payload types (match server exactly, including naming quirks).
// Map through `shared/mappers/api-adapters.ts` — never expose these to the UI.
// ---------------------------------------------------------------------------

export interface RawUserAssessment {
  status: AssessmentStatus;
  session_id: number | null;
  exam_passes_date: string | null;
}

export interface RawCpeModeDetails {
  cpe_mode: boolean;
  class_started: string;
  class_ends_on: string;
}

/**
 * Discriminator on `RawCourseDetails.type`. The wire ships `'premiere'` for
 * webinar rows (e.g. live/premiere sessions); the adapter normalizes it to
 * the `'webinar'` `TransactionType` so the UI never sees `'premiere'`.
 */
export type RawCourseType = TransactionType | 'premiere';

export interface RawCourseDetails {
  course_category?: string;
  course_type?: string;
  master_class_name?: string | null;
  podcast_format?: string | null;
  /** Nano-learning row title (mirrors `master_class_name` for nano courses). */
  nano_learning_name?: string | null;
  horizontal_thumbnail?: string | null;
  instructor_name?: string | null;
  exam_rules?: string | null;
  type: RawCourseType;
  all_classes_completed: boolean;
  user_assessment: RawUserAssessment | null;
  cpe_mode_details?: RawCpeModeDetails | null;
  /** Premiere/webinar attendance, e.g. `'Present'`. */
  attendance_details?: string | null;
  /** Premiere/webinar registration flag. */
  registered_webinar?: { added: boolean } | null;
  is_subscription_excluded?: boolean;
  is_free?: boolean;
  is_certificate_eligible?: boolean;
  caira_level?: number | null;
  fields_of_study: FieldOfStudyCredit[];
}

export interface RawUserBadgeInline {
  id: number;
  badge_name: string;
  badge_image?: string | null;
  sub_text?: string | null;
  description?: string | null;
  awarded_at?: string | null;
  accept_url?: string | null;
}

/**
 * Per-row active plan — historical (the plan that was active when the row
 * was created/enrolled), NOT the user's current recommended plan. Treat the
 * fields as a typed subset; the wire carries more but the UI only reads these.
 */
export interface RawCurrentActivePlan {
  id?: number;
  remaining_days?: number;
  subscription_status?: 'Active' | string | null;
  item_type?: 'subscription' | 'masterclass' | 'nano_learning' | 'webinar' | string | null;
  base_price?: number;
  selling_price?: number;
  is_unlimited?: boolean;
  status?: boolean;
  /** Set on free premiere rows. */
  free_access?: boolean;
}

export interface RawReportRow {
  id: number;
  /**
   * Nullable for webinar rows on the user-credit endpoint — the wire ships
   * `course_details: null` and surfaces the relevant fields under
   * `webinar_details` instead. The adapter falls back accordingly.
   */
  course_details: RawCourseDetails | null;
  user_feedback_details?: UserFeedbackDetails;
  webinar_details: WebinarDetails | null;
  current_active_plan?: RawCurrentActivePlan | null;
  user_badge?: RawUserBadgeInline | null;
  /** API typo preserved — adapters normalize this into `transaction_type`. */
  transcation_type: RawTransactionType;
  transcation_details?: unknown;
  total_credits: number;
  completed_date: string | null;
  status: boolean;
  was_caira_credit?: boolean;
  caira_level_snapshot?: number | null;
  created_at: string;
  master_class: number | null;
  nano_learning: number | null;
  chapter: number | null;
  course: number;
  webinar_session: number | null;
  user_enrollment: number | null;
  user: number;
  updated_by: number | null;
}

export interface RawBadge {
  id: number;
  name: string;
  sub_text: string | null;
  description: string;
  level_name: string;
  level_rank: number;
  icon_url: string;
  required_credits: string;
  is_coming_soon: boolean;
}

export type RawBadgeStatus = 'unlocked' | 'locked' | string;

export interface RawUserBadge {
  id: number;
  badge: RawBadge;
  status: RawBadgeStatus;
  awarded_at: string | null;
  current_progress: { earned: number; required: number };
  progress_percentage: number;
  /** Credly acceptance URL, set server-side after `user-badges/:id/claim/`. */
  accept_url?: string | null;
}

export interface RawCourseCredits {
  account_credits: number;
  ethics: number;
  others: number;
}

export interface RawStudyCredits {
  webinar: number;
  self_study: number;
  nano_learning: number;
}

export interface RawCreditBreakdown {
  total_credit_earned: number;
  course_credits: RawCourseCredits;
  study_credits: RawStudyCredits;
}

export interface RawStateBoard {
  id: number;
  name: string;
  required_credits?: number;
}

export interface RawStatistics {
  user_state_board: RawStateBoard[];
  overall_credits_earned: number;
  overall_upcoming_credits: number;
  credits_earned: RawCreditBreakdown;
  upcoming_credits: RawCreditBreakdown;
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

export const CPE_TRACKER_ROUTES = {
  getStatistics: {
    path: 'usercredits/statistics/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<RawStatistics>, {}, { year: number }>,

  getReport: {
    path: 'usercredits/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<RawReportRow[]>, {}, { year: number; status: boolean }>,

  getUserBadges: {
    path: 'user-badges/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<RawUserBadge[]>, {}, {}>,

  downloadNasba: {
    path: 'download_nasba_template',
    method: 'GET',
  } as RouteConfig<void, Blob, {}, {}>,

  downloadAllCertificates: {
    path: 'user-assessment/download_bulk_certificate/',
    method: 'POST',
  } as RouteConfig<{ year: number }, CommonResponse<BulkCertificateItem[]>, {}, {}>,
};
