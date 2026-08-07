/**
 * Badge card view-model — design contract, not a wire payload.
 *
 * Lifted out of the deleted `badge.model.ts` during the Django strip. The card
 * component and the badge library page agree on this shape; whatever backend
 * supplies the data maps onto it at the edge. Keeping `BadgeAction` a closed
 * union is what makes the page's exhaustiveness guard catch a new action at
 * compile time, so it stays a union rather than `string`.
 */

export type BadgeAction =
  | 'earn_badge'
  | 'submit_feedback'
  | 'claim_badge'
  | 'download_certificate'
  | 'locked'
  | 'coming_soon';

export interface BadgeCardButton {
  label: string;
  variant: 'primary' | 'outline' | 'disabled';
  action: BadgeAction;
}

/** Flat view-model the `BadgeCard` consumes. */
export interface BadgeCardData {
  badgeId: number;
  courseType: string;
  courseId: number | null;
  badgeIconUrl: string;
  thumbnailUrl: string | null;
  levelRank: number | null;
  isComingSoon: boolean;
  title: string;
  instructor: string | null;
  category: string | null;
  fieldsOfStudy: unknown[];
  credits: number | null;
  shortOverview: string | null;
  buttons: BadgeCardButton[];
  /** Original backend item, passed through for the claim/download handlers. */
  raw: unknown;
}
