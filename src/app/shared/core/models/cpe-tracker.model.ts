import { CommonResponse, RouteConfig } from './http.model';

/**
 * What survives of the v1 CPE tracker model.
 *
 * The page itself now reads the v2 endpoints — see `cpe-credit.model.ts`. The
 * raw v1 wire shapes (`RawStatistics`, `RawReportRow`, `RawUserBadge` and
 * friends) went with the mappers that translated them, along with the three
 * read routes below them. What is left is the handful of types other features
 * still consume, plus the two download endpoints v2 does not replace.
 */

export type TransactionType = 'masterclass' | 'nano_learning' | 'webinar' | 'podcast';

/** Credits panel + the compliance gauge. */
export interface CreditsSummary {
  total: number;
  earned: number;
  required: number;
  pending?: number;
}

/** One field-of-study / delivery-mode slice of the compliance gauge. */
export interface StudyModeBreakdown {
  id: number;
  name: string;
  credits: number;
  color?: string;
}

/** Shared with the course, feature and micro-learning models. */
export interface UserFeedbackDetails {
  user_feedback_submitted: boolean;
  user_rating?: number;
}

/**
 * Credly badge as the v1 badge surfaces model it. Still consumed by
 * `badge-hero-card`, `badge-info-dialog` and `badge-claim-upsell-dialog`; the
 * CAIRA tracker uses the v2 shapes in `caira-badge.model.ts` instead.
 */
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

/** One row of the bulk-certificate zip manifest. */
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
// Route definitions
// ---------------------------------------------------------------------------

/**
 * The two download endpoints, which have no v2 counterpart. The v1 read routes
 * (`usercredits/statistics/`, `usercredits/`, `user-badges/`) are gone from
 * here — the tracker reads `v2/cpe-tracker/` and `v2/cpe-tracker/summary/`, and
 * badges moved to `v2/caira-badges/` on the CAIRA tracker. Both v1 read
 * endpoints are still live server-side for other consumers.
 */
export const CPE_TRACKER_ROUTES = {
  downloadNasba: { path: 'download_nasba_template', method: 'GET' } as RouteConfig<
    void,
    Blob,
    Record<string, never>,
    Record<string, never>
  >,
  downloadAllCertificates: {
    path: 'user-assessment/download_bulk_certificate/',
    method: 'POST',
  } as RouteConfig<
    { year: number },
    CommonResponse<BulkCertificateItem[]>,
    Record<string, never>,
    Record<string, never>
  >,
};
