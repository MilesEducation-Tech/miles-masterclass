import { UserBadgeStatus } from '@core/models/caira-badge.model';
import { BadgePaginationData } from '@core/models/badge.model';
import { FieldOfStudy } from '@core/models/course.model';
import { TransactionType } from '@core/models/cpe-tracker.model';

/**
 * Wire types for the v2 CPE tracker endpoints (`CPE_Tracker_API_v2.md`):
 *
 *   GET v2/cpe-tracker/          one row per **earned** credit (no upcoming list in v2)
 *   GET v2/cpe-tracker/summary/  headline totals for the portfolio card
 *
 * These replace the `RawStatistics` / `RawReportRow` half of `cpe-tracker.model.ts`.
 * The envelope here is the v1-style `{ total_count, current_page_number, next_page,
 * previous_page }` — note that differs from the badge v2 endpoints' `{ count, next,
 * previous }`, so this file reuses `BadgePaginationData` and `parseNextPage` rather
 * than the `badgeNextPage` helper written for those.
 */

export type CpeLedger = 'caira' | 'others';

/** `nano_learning` is labelled "Reels" in the UI and excludes AI Lab on the list endpoint. */
export type CpeCourseType = 'masterclass' | 'podcast' | 'nano_learning' | 'ai_lab' | 'webinar';

export interface CpeCreditBadge {
  id: number;
  name: string;
  icon_url: string | null;
  status: UserBadgeStatus;
  accept_url: string | null;
}

/** The course a credit was earned on. Nested under the row since the Sept-2026 serializer. */
export interface CpeCreditCourse {
  id: number;
  course_type: CpeCourseType;
  title: string;
  thumbnail: string | null;
  is_free: boolean;
  is_subscription_excluded: boolean;
  has_plan: boolean;
  fields_of_study: FieldOfStudy[];
}

export interface CpeCreditWire {
  /** The credit record's id — the course id is `course.id`. */
  id: number;
  course: CpeCreditCourse;
  credits: number;
  allocated_on: string;
  /** Always matches the `ledger` the row was fetched under. */
  was_caira_credit: boolean;
  badge: CpeCreditBadge | null;
  /** Gates the certificate action — see the doc's "Feedback gate". */
  feedback_submitted: boolean;
}

export interface CpeSummaryWire {
  caira_credits_earned: number;
  others_credits_earned: number;
  credits_earned: {
    total_credit_earned: number;
    /** Earned side of the compliance gauge. */
    course_credits: { account_credits: number; ethics: number; others: number };
    /** `nano_learning` here *includes* AI Lab, unlike the list's `?course_type=`. */
    study_credits: { webinar: number; self_study: number; nano_learning: number };
  };
}

export interface CpeTrackerResponse<T> {
  status_code?: number;
  data: T;
  message?: string;
  pagination_data?: BadgePaginationData;
}

// ---------------------------------------------------------------------------
// Derived display values
// ---------------------------------------------------------------------------

/**
 * Delivery method is a pure function of course type — v2 drops the field, but
 * this is the same mapping v1's `DELIVERY_METHOD_MAP` applied.
 */
export const DELIVERY_METHOD: Record<CpeCourseType, string> = {
  masterclass: 'QAS Self Study',
  podcast: 'QAS Self Study',
  ai_lab: 'QAS Self Study',
  nano_learning: 'Nano Learning',
  webinar: 'Group Internet Based',
};

/**
 * v2 `course_type` → the token the course URLs and the certificate API use.
 *
 * `ai_lab` has no counterpart of its own; it is folded into `nano_learning`
 * because the summary endpoint already counts AI Lab under `nano_learning`.
 * Unverified against the certificate API — flagged in the plan.
 */
export const CPE_TYPE_TO_TRANSACTION: Record<CpeCourseType, TransactionType> = {
  masterclass: 'masterclass',
  podcast: 'podcast',
  nano_learning: 'nano_learning',
  ai_lab: 'nano_learning',
  webinar: 'webinar',
};

/**
 * What `CertificateDownloadDialog` needs to fetch a certificate. Replaces the
 * `ReportRow` the v1 tracker passed around, so the download services no longer
 * depend on any wire shape.
 */
export interface CertificateTarget {
  courseId: number;
  courseType: TransactionType;
  courseTitle: string;
  badge?: {
    id?: number;
    acceptUrl?: string;
    name?: string;
    image?: string;
    description?: string;
  };
}

export function toCertificateTarget(row: CpeCreditWire): CertificateTarget {
  return {
    courseId: row.course.id,
    courseType: CPE_TYPE_TO_TRANSACTION[row.course.course_type],
    courseTitle: row.course.title,
    badge: row.badge
      ? {
          id: row.badge.id,
          acceptUrl: row.badge.accept_url ?? undefined,
          name: row.badge.name,
          image: row.badge.icon_url ?? undefined,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

export type CpeRowAction = 'download' | 'feedback' | 'view_badge';

export interface CpeActionUi {
  label: string;
  /** Extra classes merged over the shared action-button base. */
  theme: string;
  icon: boolean;
}

export const CPE_ACTION_UI: Record<CpeRowAction, CpeActionUi> = {
  download: { label: 'Download', theme: 'bg-accent text-white hover:bg-accent/90', icon: true },
  feedback: {
    label: 'Feedback',
    theme: 'bg-accent-premium text-black hover:bg-accent-premium/90',
    icon: false,
  },
  view_badge: {
    label: 'View Badge',
    theme: 'bg-white/10 text-white hover:bg-white/20',
    icon: false,
  },
};

/**
 * What the Action cell offers for a row.
 *
 * v2 lists earned credits only, so v1's seven-way tree (Registered / Resume /
 * Take Exam / Retake / …) has nothing left to branch on — `feedback_submitted`
 * and `badge` are the only signals. `view_badge` needs the Credly `accept_url`.
 */
export function cpeRowActions(row: CpeCreditWire): CpeRowAction[] {
  const actions: CpeRowAction[] = [row.feedback_submitted ? 'download' : 'feedback'];
  if (row.badge?.status === 'earned' && row.badge.accept_url) actions.push('view_badge');
  return actions;
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export interface CpeOption<T> {
  value: T;
  label: string;
}

export const CPE_LEDGER_OPTIONS: readonly CpeOption<CpeLedger>[] = [
  { value: 'caira', label: 'CAIRA' },
  { value: 'others', label: 'Others' },
];

/** `null` = every course type. */
export const CPE_COURSE_TYPE_OPTIONS: readonly CpeOption<CpeCourseType | null>[] = [
  { value: null, label: 'All' },
  { value: 'masterclass', label: 'Masterclass' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'nano_learning', label: 'Reels' },
];
