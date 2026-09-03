/**
 * Models for the admin Reports → User report page.
 *
 * Ported from the CPE-Masterclass `user-reports` feature: the Django
 * `reports/user-report/` endpoint returns one row per platform user with their
 * identity, signup/activity dates, and per-bucket CPE / CAiRA / preview totals.
 * Each numeric metric is paired with a `*_ids` bucket of the underlying course
 * ids so the UI can drill into "which courses?" via `reports/user-course-detail/`.
 *
 * The shape intentionally matches `PartnerUser` (admin Domain-users page) — both
 * are served by the same reporting backend.
 */

/** Per-bucket course id groups returned alongside every metric column. */
export interface CourseIds {
  masterclass_id: number[];
  podcast_id: number[];
  nano_learning_id: number[];
}

/** One row of the user report table. */
export interface UserReportRow {
  name: string;
  email: string;
  phone: string;
  professional_qualification: string;
  state_board: string;
  date_of_signup: string;
  date_of_login: string;

  courses_completed_cpe: number;
  cpe_credits_earned: number;
  courses_in_progress_cpe: number;
  cpe_credits_in_progress: number;
  caira_credits_earned: number;
  caira_credits_in_progress: number;
  courses_completed_preview: number;
  courses_in_progress_preview: number;

  courses_completed_cpe_ids: CourseIds;
  cpe_credits_earned_ids: CourseIds;
  courses_in_progress_cpe_ids: CourseIds;
  cpe_credits_in_progress_ids: CourseIds;
  caira_credits_earned_ids: CourseIds;
  caira_credits_in_progress_ids: CourseIds;
  courses_completed_preview_ids: CourseIds;
  courses_in_progress_preview_ids: CourseIds;
}

/** Normalised page slice the facade exposes to the component. */
export interface UserReportPage {
  rows: UserReportRow[];
  total: number;
  currentPage: number;
  nextPage: number | null;
  prevPage: number | null;
}

/** A single course surfaced when drilling into a metric bucket. */
export interface CourseDetail {
  course_id: number;
  title: string;
  completed_on: string;
  cpe_credits: number;
  is_caira_course: boolean;
  course_type: string;
  caira_level: number | null;
}

/** POST body for the course-detail drill-down endpoint. */
export type CourseDetailRequest = CourseIds;

/** Human-readable label for the metric the dialog was opened from. */
export type CourseDetailCategory =
  | 'CPE Courses Completed'
  | 'CPE Credits Earned'
  | 'CPE Courses In Progress'
  | 'CPE Credits In Progress'
  | 'CAiRA Credits Earned'
  | 'CAiRA Credits In Progress'
  | 'Preview Courses Completed'
  | 'Preview Courses In Progress'
  | 'All Courses';

/** API endpoints backing the feature (relative to `BASE_API_URL`). */
export const USER_REPORT_ENDPOINTS = {
  list: 'reports/user-report/',
  exportCsv: 'reports/user-report-export-csv/',
  courseDetail: 'reports/user-course-detail/',
} as const;

/** True when at least one bucket carries an id worth drilling into. */
export function hasCourseIds(ids: CourseIds | undefined | null): boolean {
  if (!ids) return false;
  return (
    (ids.masterclass_id?.length ?? 0) > 0 ||
    (ids.nano_learning_id?.length ?? 0) > 0 ||
    (ids.podcast_id?.length ?? 0) > 0
  );
}

/** Merge several buckets into one (used by the "All courses" action). */
export function mergeCourseIds(buckets: (CourseIds | undefined | null)[]): CourseIds {
  return {
    masterclass_id: buckets.flatMap((b) => b?.masterclass_id ?? []),
    podcast_id: buckets.flatMap((b) => b?.podcast_id ?? []),
    nano_learning_id: buckets.flatMap((b) => b?.nano_learning_id ?? []),
  };
}
