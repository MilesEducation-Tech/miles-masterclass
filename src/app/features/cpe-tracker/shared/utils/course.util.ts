import { TransactionType } from '@core/models/cpe-tracker.model';

/** URL-facing segment used when navigating to a course. */
export type CourseUrlSegment = 'masterclass' | 'micro-learning' | 'podcast' | 'webinar';

/**
 * Course type → URL segment. Shared by the CAIRA tracker's badge cards and the
 * CPE tracker's row links; v2's `course_type` uses the same spellings as
 * `TransactionType` once `ai_lab` is folded in (see `CPE_TYPE_TO_TRANSACTION`).
 */
export const TRANSACTION_TO_URL: Record<TransactionType, CourseUrlSegment> = {
  masterclass: 'masterclass',
  nano_learning: 'micro-learning',
  podcast: 'podcast',
  webinar: 'webinar',
};
