/**
 * Reports API models — the Partner Platform API contract § Reports API.
 *
 * The same five endpoints exist under BOTH bases: `partners/superadmin/report/…`
 * (super admins, must pass exactly one of `network_id`/`firm_id`) and
 * `partners/panel/report/…` (network/firm admins, auto-scoped server-side —
 * never send a scope param there).
 *
 * Every call requires `?subject=courses|webinars`, and each subject returns a
 * different set of fields. They're modelled here as one flat interface with
 * per-subject optionals rather than a discriminated union: `subject` lives on
 * the component, not on the row, so a union would force a cast at every
 * template binding without buying any real safety.
 */
import { PartnerPagination } from '../../../shared/models/partner-platform.model';

export type ReportSubject = 'courses' | 'webinars' | 'group_live';

export type ReportExportView = 'user-summary' | 'user-items';

export type ReportBase = 'superadmin' | 'panel';

export const reportUrl = (base: ReportBase, path: string): string =>
  `partners/${base}/report/${path}`;

/** `GET .../filters/` — static reference data for a filter bar. */
export interface ReportFilters {
  delivery_types: string[];
  /** Reference data only — no report endpoint accepts a fields-of-study filter, so it isn't rendered. */
  fields_of_study: string[];
}

// ---------------------------------------------------------------------------
// Summary (stat cards)
// ---------------------------------------------------------------------------

export interface ReportSummary {
  // Shared by both subjects.
  users_onboarded: number;
  active_in_last_15_days: number;
  total_cpe_credits_awarded: number;
  avg_cpe_credits_per_user: number;
  total_certificates_awarded: number;
  total_partner_codes: number;

  // subject=courses only.
  total_courses_completed?: number;
  avg_courses_completed_per_user?: number;
  avg_feedback_per_course?: number;

  // subject=webinars only.
  webinars_registered_for?: number;
  total_registrations?: number;
  avg_registrations_per_webinar?: number;
  total_attendance?: number;
  avg_attendance_per_webinar?: number;
  avg_feedback_per_webinar?: number;
}

// ---------------------------------------------------------------------------
// Certificates — `GET .../certificates/` (Partner Platform API contract § Course Certificates)
// ---------------------------------------------------------------------------

/**
 * One awarded certificate. No `subject` param on this endpoint — webinars come
 * back as `course_type: "webinar"`, so callers filter by subject client-side.
 */
export interface ReportCertificate {
  course_type: string;
  course_id: number;
  course_name: string;
  cpe_credits: number;
  issued_on: string;
  /** Resolves to the NASBA PDF only — null when the user holds just a Miles certificate. */
  certificate_url: string | null;
  // Flat (`user_id`) shape only; the grouped shapes carry these on the parent.
  user_id?: number;
  uuid?: string;
  name?: string;
  email?: string;
}

export interface ReportCertificateUser {
  user_id: number;
  uuid: string;
  name: string;
  email: string;
  certificates: ReportCertificate[];
}

export interface ReportCertificateFirm {
  firm_id: number;
  firm_name: string;
  users: ReportCertificateUser[];
}

/**
 * Shape follows how narrow the query is: `user_id` → `certificates`; a firm →
 * `users`; a network → `firms` + `unassigned_users` (network-pool seats with
 * no firm). Exactly one of the three layouts is present per response.
 */
export interface ReportCertificatesResponse {
  certificates?: ReportCertificate[];
  users?: ReportCertificateUser[];
  firms?: ReportCertificateFirm[];
  unassigned_users?: ReportCertificateUser[];
}

// ---------------------------------------------------------------------------
// Per-user roll-up — rolls up exactly to the summary above
// ---------------------------------------------------------------------------

export interface ReportUserRow {
  user_id: number;
  uuid: string;
  name: string;
  email: string;
  active_in_last_15_days: boolean;
  total_cpe_credits_awarded: number;
  total_certificates_awarded: number;

  // subject=courses only.
  total_courses_completed?: number;
  avg_feedback_per_course?: number;

  // subject=webinars only.
  total_webinars_registered?: number;
  total_webinars_attended?: number;
  avg_feedback_per_webinar?: number;
}

/** Same page-number envelope as the coupon endpoints. */
export interface ReportUsersResponse {
  users: ReportUserRow[];
  pagination_data: PartnerPagination;
}

// ---------------------------------------------------------------------------
// Drill-down — one row per course/webinar for a single user
// ---------------------------------------------------------------------------

export interface ReportItemRow {
  name: string;
  uuid: string;
  email: string;
  user_id: number;
  cpe_credits: number;
  feedback_rating: number | null;
  has_certificate: boolean;

  // subject=courses only.
  course_type?: string;
  course_id?: number;
  course_name?: string;
  cpe_mode?: boolean;
  is_completed?: boolean;
  /**
   * Chapters watched ÷ total chapters × 100 — deliberately independent of
   * `is_completed`: a CPE course completes on the assessment, so 100% progress
   * does not imply completion (nor the reverse). Never derive one from the other.
   */
  progress_percent?: number;

  // subject=webinars only.
  webinar_id?: number;
  webinar_name?: string;
  is_attended?: boolean;
}

/** One subject's slice of the printable preview: its summary + every user row. */
export interface ReportPreviewSubject {
  summary: ReportSummary;
  users: ReportUserRow[];
}

/**
 * Everything the "Partner Learning Report" preview renders, fetched in one go
 * for BOTH subjects (the page itself only ever holds one at a time).
 */
export interface ReportPreviewBundle {
  /** ISO timestamp — the footer's "generated" date. */
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
  courses: ReportPreviewSubject;
  webinars: ReportPreviewSubject;
}

export interface ReportItemsResponse {
  items: ReportItemRow[];
}
