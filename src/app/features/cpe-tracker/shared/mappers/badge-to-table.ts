import {
  BadgeContentType,
  BadgeItem,
  CairaCategory,
  CairaLevel,
  CairaLevelBadge,
  LevelProgress,
} from '../../../../shared/core/models/caira/cpe.model';
import { ButtonKind, TrackerTableRow } from './report-to-table';

/**
 * CAIRA badges (#23) → tracker table rows.
 *
 * Replaces `report-to-table.ts` for the CAIRA backend. The Django mapper stays
 * until its last caller goes, but nothing in the tracker reaches it now.
 *
 * **Five of the six row actions have no target.** #23 carries no course id — no
 * `course_id`, no slug, nothing — so resume, exam, retake, feedback and
 * view-details cannot be built from this payload, and the shipped CAIRA LMS's
 * own progress page has no navigation either. The only action a badge row can
 * offer is opening its certificate or Credly badge. Everything else is `'none'`.
 */

export const BADGE_LEVELS: readonly CairaLevel[] = ['L1', 'L2', 'L3'];
export const BADGE_CONTENT_TYPES: readonly BadgeContentType[] = [
  'Masterclass',
  'Webinar',
  'Podcast',
  'Reels',
];
export const BADGE_CATEGORIES: readonly CairaCategory[] = ['CAIRA', 'NON-CAIRA'];

/** Matches the shipped LMS's progress grid. */
export const BADGE_PAGE_SIZE = 6;

export interface BadgeFilterState {
  category: CairaCategory;
  level: CairaLevel;
  contentType: BadgeContentType;
}

/** `'L2'` → `2`. `null` for NON-CAIRA, which has no level concept. */
export function levelNumber(level: CairaLevel | undefined): number | null {
  if (!level) return null;
  const parsed = Number(level.slice(1));
  return Number.isFinite(parsed) ? parsed : null;
}

function pickAction(item: BadgeItem): ButtonKind {
  // A certificate PDF or a Credly accept URL is the only thing a badge row can
  // open. `isPending` means the credential pipeline has not finished yet.
  if (item.isPending) return 'none';
  return item.hasCertificate || item.isBadgeIncluded ? 'download' : 'none';
}

export function badgeToTableRow(item: BadgeItem): TrackerTableRow {
  return {
    key: item.id,
    id: item.id,
    courseName: item.title,
    // ponytail: #23 carries no field-of-study breakdown. The table falls back to
    // its positional accent series when this is empty, so the rows still stripe.
    fieldsOfStudy: [],
    deliveryMethod: item.contentType,
    totalCredits: item.cpeCredits,
    completedAt: item.allocatedOn || null,
    // No registration timestamp anywhere in #23.
    registeredAt: null,
    cairaLevel: levelNumber(item.level),
    actionKind: pickAction(item),
    raw: item,
  };
}

/**
 * The LMS's filter, reproduced: a CAIRA / NON-CAIRA toggle plus level and
 * content type. Level is ignored for NON-CAIRA because those badges carry none.
 */
export function filterBadges(items: BadgeItem[], filter: BadgeFilterState): BadgeItem[] {
  return items.filter((item) => {
    if (item.category !== filter.category) return false;
    if (item.contentType !== filter.contentType) return false;
    if (filter.category === 'CAIRA' && item.level !== filter.level) return false;
    return true;
  });
}

/**
 * Content types that actually have badges under the current category/level.
 *
 * The LMS computes this so the filter cannot land on an always-empty
 * combination — the user picks from what exists, not from the full grid.
 */
export function availableContentTypes(
  items: BadgeItem[],
  category: CairaCategory,
  level: CairaLevel,
): BadgeContentType[] {
  return BADGE_CONTENT_TYPES.filter((type) =>
    items.some(
      (item) =>
        item.category === category &&
        item.contentType === type &&
        (category !== 'CAIRA' || item.level === level),
    ),
  );
}

// ---------------------------------------------------------------------------
// Level achievement badges → the hero swiper
// ---------------------------------------------------------------------------

/**
 * What `BadgeHeroCard` reads. It is an untyped `input.required<any>()` in the
 * design system, so this interface is the contract restated on our side — the
 * field names are the card's, not CAIRA's, and must not be "tidied".
 */
export interface BadgeHeroCardData {
  id: string;
  name: string;
  level: string;
  level_rank: number;
  status: 'unlocked' | 'locked';
  is_claimed: boolean;
  is_claimable: boolean;
  is_coming_soon: boolean;
  image_url: string | null;
  description: string;
  sub_text: string;
  earned_credits: number;
  required_credits: number;
  progress_percentage: number;
  /** #19's payload. Carried through so the claim handler needs no second lookup. */
  credlyAssertionId: string | null;
  credlyAcceptUrl: string | null;
}

/**
 * Join #23's level badges with #5's level progress.
 *
 * **Both endpoints are required.** #23 carries the badge art, status and
 * progress but no `credly_assertion_id`; #5 carries the assertion id that #19
 * needs to mint a claim URL but none of the display fields. The shipped LMS
 * reads them from two different pages and never joins them, which is why its
 * progress page cannot claim and its header cannot show badge art.
 *
 * Joined on `level_name`, the one field both sides spell the same way.
 */
export function toBadgeHeroCards(
  badges: CairaLevelBadge[],
  levels: LevelProgress[],
): BadgeHeroCardData[] {
  return badges.map((badge, index) => {
    const level = levels.find((l) => l.levelName === badge.levelName);
    const rank = level?.levelNumber ?? index + 1;
    // Prefer the per-level numerator over #23's global-grand-total one.
    const progress = badge.progressCorrected ?? badge.progress;
    const isClaimed = badge.allocatedOn !== null;

    return {
      id: badge.badgeLabel || badge.levelName || `level-${rank}`,
      name: badge.levelName,
      level: badge.badgeLabel,
      level_rank: rank,
      // #23's status vocabulary is #5's: Ongoing / Completed / Locked.
      status: badge.status === 'Locked' ? 'locked' : 'unlocked',
      is_claimed: isClaimed,
      // Claimable only when #5 handed us an assertion id and nothing is claimed
      // yet — without the id, #19 has nothing to post.
      is_claimable: !isClaimed && !!level?.credlyAssertionId,
      // CAIRA has no coming-soon state for level badges.
      is_coming_soon: false,
      image_url: badge.badgeImageUrl ?? badge.credlyBadgeImageUrl,
      description: '',
      sub_text: badge.status,
      earned_credits: progress?.earned ?? 0,
      required_credits: progress?.target ?? level?.targetCpe ?? 0,
      progress_percentage: progress?.percent ?? 0,
      credlyAssertionId: level?.credlyAssertionId ?? null,
      // #5 spells it `credly_accepted_url`; #19's response spells it `_accept_`.
      credlyAcceptUrl: badge.credlyAcceptUrl ?? level?.credlyAcceptedUrl ?? null,
    };
  });
}
