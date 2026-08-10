import { CairaDataEnvelope, CairaStatusEnvelope } from './envelope.model';

/**
 * CPE credits, levels and badges — #5 (levels progress), #23 (all badges) and
 * #19 (level badge claim).
 *
 * Scope is **parity, not coverage.** These three are what the shipped CAIRA LMS
 * calls. #22 `get_badges_tracker_web`, #24 `badges_catalog`, #25 `cpe-progress`
 * and #26/#27 (alumni) are in the endpoint registry but unused by the LMS, and
 * are deliberately not modelled here.
 */

// ---------------------------------------------------------------------------
// #5 · levels progress
// ---------------------------------------------------------------------------

/**
 * `"Ongoing"` is the level the learner is working through. Level 1 can never be
 * `"Locked"`, and the server **rotates the array** so the first `"Ongoing"`
 * level leads — order is meaningful and must not be re-sorted.
 */
export type LevelStatus = 'Ongoing' | 'Completed' | 'Locked';

export interface LevelProgressPayload {
  level_number?: number | null;
  level_name?: string | null;
  status?: string | null;
  /**
   * A **string**, not a number: `"12.5/30"`, with a trailing `.0` trimmed. Never
   * bind this raw — parse it.
   */
  progress?: string | null;
  /** `int` when whole, `float` otherwise. */
  target_cpe?: number | null;
  credly_assertion_id?: string | null;
  /** Note the `_accepted_` spelling — #19's response uses `_accept_`. */
  credly_accepted_url?: string | null;
}

export type LevelsProgressResponse = CairaStatusEnvelope<{
  data?: {
    total_cpe_credits?: number | null;
    levels?: LevelProgressPayload[] | null;
  } | null;
}>;

// ---------------------------------------------------------------------------
// #23 · get_all_badges_V4
// ---------------------------------------------------------------------------

/**
 * One earned badge.
 *
 * Webinars nest their detail under `webinar_badge`; masterclass, podcast **and
 * reel** all nest under `masterclass_badge` — the backend reuses one builder
 * for those three, so the key does not tell you the content type. The caller
 * does, from which array it came out of.
 */
export interface BadgeEntryPayload {
  webinar_badge?: BadgeInnerPayload | null;
  masterclass_badge?: BadgeInnerPayload | null;
  credly_accept_url?: string | null;
  credly_badge_image_url?: string | null;
  credly_pdf_certificate_from_masterclass?: string | null;
  is_archived?: boolean | null;
  is_badge_and_certificate_pending_due_to_enrolled_status?: boolean | null;
}

export interface BadgeInnerPayload {
  course_name?: string | null;
  webinar_name?: string | null;
  cpe_credit_allocated?: number | null;
  allocated_on?: string | null;
  image_url?: string | null;
  [key: string]: unknown;
}

/** The level achievement badge — Bronze/Silver/Gold, not a content card. */
export interface LevelBadgePayload {
  level?: string | null;
  /** `"12.5/30"`. See `CairaLevelBadge.progress` for the numerator caveat. */
  progress?: string | null;
  status?: string | null;
  badge_image_url?: string | null;
  credly_badge_image_url?: string | null;
  credly_accept_url?: string | null;
  allocated_on?: string | null;
}

export interface BadgeLevelPayload {
  level_number?: number | null;
  level_name?: string | null;
  caira_badges?: LevelBadgePayload | null;
  caira_masterclass_badges?: BadgeEntryPayload[] | null;
  caira_webinar_badges?: BadgeEntryPayload[] | null;
  caira_podcast_badges?: BadgeEntryPayload[] | null;
  caira_reel_badges?: BadgeEntryPayload[] | null;
}

export interface BadgeTotalsPayload {
  caira_credits?: number | null;
  non_caira_credits?: number | null;
  grand_total?: number | null;
}

export type AllBadgesResponse = CairaDataEnvelope<{
  totals?: BadgeTotalsPayload | null;
  caira_based_data?: { levels?: BadgeLevelPayload[] | null } | null;
  non_caira_based_data?: {
    non_caira_masterclass_badges?: BadgeEntryPayload[] | null;
    non_caira_webinar_badges?: BadgeEntryPayload[] | null;
    non_caira_podcast_badges?: BadgeEntryPayload[] | null;
    non_caira_reel_badges?: BadgeEntryPayload[] | null;
  } | null;
}>;

// ---------------------------------------------------------------------------
// #19 · level badge claim
// ---------------------------------------------------------------------------

/** `{ credly_assertion_id }`. #28 is a different endpoint taking a full URL. */
export interface ClaimLevelBadgeBody {
  credly_assertion_id: string;
}

/** Note `_accept_`, where #5's level payload spells it `_accepted_`. */
export type ClaimLevelBadgeResponse = CairaDataEnvelope<{
  credly_accept_url?: string | null;
}>;

// ---------------------------------------------------------------------------
// View models
// ---------------------------------------------------------------------------

export type CairaCategory = 'CAIRA' | 'NON-CAIRA';
export type BadgeContentType = 'Masterclass' | 'Webinar' | 'Podcast' | 'Reels';
export type CairaLevel = 'L1' | 'L2' | 'L3';

/** A parsed `"12.5/30"` string. `null` when the server sent nothing usable. */
export interface CreditProgress {
  earned: number;
  target: number;
  /** 0–100, clamped. `0` when `target` is 0, rather than `NaN` or `Infinity`. */
  percent: number;
}

export interface LevelProgress {
  levelNumber: number;
  levelName: string;
  status: LevelStatus;
  progress: CreditProgress | null;
  targetCpe: number | null;
  credlyAssertionId: string | null;
  credlyAcceptedUrl: string | null;
}

export interface CairaLevelBadge {
  levelName: string;
  badgeLabel: string;
  /**
   * **#23's numerator is the global grand total**, so all three levels report
   * the same earned figure over different denominators. `progressCorrected`
   * below is this value rebuilt from the level's own badges; prefer it.
   */
  progress: CreditProgress | null;
  progressCorrected: CreditProgress | null;
  status: string;
  badgeImageUrl: string | null;
  credlyBadgeImageUrl: string | null;
  credlyAcceptUrl: string | null;
  allocatedOn: string | null;
}

export interface BadgeItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  contentType: BadgeContentType;
  category: CairaCategory;
  /** `undefined` for NON-CAIRA — there is no level concept outside CAIRA. */
  level?: CairaLevel;
  isBadgeIncluded: boolean;
  cpeCredits: number;
  allocatedOn: string;
  isArchived: boolean;
  hasCertificate: boolean;
  isPending: boolean;
  badgeUrl: string | null;
  certificateUrl: string | null;
}

export interface BadgeTotals {
  cairaCredits: number;
  nonCairaCredits: number;
  grandTotal: number;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function img(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toLevelStatus(value: string | null | undefined): LevelStatus {
  // Unknown values read as Locked — the conservative default. Showing a level
  // as available when the server did not say so would let a learner into
  // content they have not unlocked.
  if (value === 'Ongoing' || value === 'Completed' || value === 'Locked') return value;
  return 'Locked';
}

/**
 * Parse the `"earned/target"` string both #5 and #23 use for progress.
 *
 * Returns `null` rather than zeros for an unparseable value, so a caller can
 * tell "no data" from "genuinely zero credits".
 */
export function parseCreditProgress(value: string | null | undefined): CreditProgress | null {
  const parts = value?.split('/');
  if (!parts || parts.length !== 2) return null;
  const earned = Number(parts[0]);
  const target = Number(parts[1]);
  if (!Number.isFinite(earned) || !Number.isFinite(target)) return null;
  // `target === 0` would make the ratio Infinity or NaN.
  const percent = target > 0 ? Math.min(100, Math.max(0, (earned / target) * 100)) : 0;
  return { earned, target, percent };
}

/**
 * #5 · the level rail.
 *
 * Server order is preserved — the array is **rotated** so the first `"Ongoing"`
 * level leads, and re-sorting it would undo that.
 */
export function toLevelProgress(response: LevelsProgressResponse | undefined): LevelProgress[] {
  return (response?.data?.levels ?? []).map((level, index) => ({
    levelNumber: level.level_number ?? index + 1,
    levelName: level.level_name ?? '',
    status: toLevelStatus(level.status),
    progress: parseCreditProgress(level.progress),
    targetCpe: level.target_cpe ?? null,
    credlyAssertionId: level.credly_assertion_id?.trim() || null,
    credlyAcceptedUrl: img(level.credly_accepted_url),
  }));
}

export function toTotalCpeCredits(response: LevelsProgressResponse | undefined): number {
  return response?.data?.total_cpe_credits ?? 0;
}

/**
 * The learner's current level.
 *
 * `"Ongoing"` wins. With no ongoing level, everything completed means they have
 * finished level 3 — the LMS also treats `total > 90` as level 3, which is the
 * gold threshold expressed as a magic number; the completed check covers it
 * without hardcoding the credit total, so only the completed check is kept.
 */
export function currentLevelNumber(levels: LevelProgress[]): number | null {
  const ongoing = levels.find((l) => l.status === 'Ongoing');
  if (ongoing) return ongoing.levelNumber;
  if (levels.length > 0 && levels.every((l) => l.status === 'Completed')) {
    return levels[levels.length - 1].levelNumber;
  }
  return null;
}

/**
 * The badge thumbnail.
 *
 * Webinars carry no content image on #23, so they fall back to the Credly badge
 * art — a product decision, not a bug. Everything else scans the payload for an
 * image-shaped key, because the field name varies by content type and the
 * backend has not settled it.
 *
 * ponytail: confirm the real key names against a live capture and replace the
 * scan with a field read.
 */
function pickThumbnail(
  entry: BadgeEntryPayload,
  inner: BadgeInnerPayload,
  contentType: BadgeContentType,
): string | null {
  if (contentType === 'Webinar' && entry.credly_badge_image_url) {
    return img(entry.credly_badge_image_url);
  }
  const scan = (obj: Record<string, unknown>): string | null => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value !== 'string' || !value) continue;
      if (!/(image|thumbnail|thumb|cover|poster|banner|photo)/i.test(key)) continue;
      if (!/url/i.test(key)) continue;
      // Skip the Credly art — that is the badge, not the content.
      if (/credly|badge/i.test(key)) continue;
      return value;
    }
    return null;
  };
  return scan(inner) ?? scan(entry as unknown as Record<string, unknown>);
}

function toBadgeItem(
  entry: BadgeEntryPayload,
  contentType: BadgeContentType,
  category: CairaCategory,
  index: number,
  level?: CairaLevel,
): BadgeItem {
  const inner = entry.webinar_badge ?? entry.masterclass_badge ?? {};
  return {
    id: `${category}-${level ?? 'NC'}-${contentType}-${index}`,
    title: inner.course_name ?? inner.webinar_name ?? '',
    thumbnailUrl: pickThumbnail(entry, inner, contentType),
    contentType,
    category,
    level,
    isBadgeIncluded: !!entry.credly_accept_url,
    cpeCredits: inner.cpe_credit_allocated ?? 0,
    allocatedOn: inner.allocated_on ?? '',
    isArchived: !!entry.is_archived,
    hasCertificate: !!entry.credly_pdf_certificate_from_masterclass,
    isPending: !!entry.is_badge_and_certificate_pending_due_to_enrolled_status,
    badgeUrl: img(entry.credly_accept_url) ?? img(entry.credly_badge_image_url),
    certificateUrl: img(entry.credly_pdf_certificate_from_masterclass),
  };
}

/** #23 · every earned badge, CAIRA levels first, then the flat NON-CAIRA set. */
export function toBadgeItems(response: AllBadgesResponse | undefined): BadgeItem[] {
  const data = response?.data;
  if (!data) return [];
  const items: BadgeItem[] = [];

  for (const level of data.caira_based_data?.levels ?? []) {
    const key = `L${level.level_number ?? 1}` as CairaLevel;
    const arrays: [BadgeEntryPayload[] | null | undefined, BadgeContentType][] = [
      [level.caira_masterclass_badges, 'Masterclass'],
      [level.caira_webinar_badges, 'Webinar'],
      [level.caira_podcast_badges, 'Podcast'],
      [level.caira_reel_badges, 'Reels'],
    ];
    for (const [entries, contentType] of arrays) {
      (entries ?? []).forEach((entry, i) =>
        items.push(toBadgeItem(entry, contentType, 'CAIRA', i, key)),
      );
    }
  }

  const nc = data.non_caira_based_data;
  if (nc) {
    const arrays: [BadgeEntryPayload[] | null | undefined, BadgeContentType][] = [
      [nc.non_caira_masterclass_badges, 'Masterclass'],
      [nc.non_caira_webinar_badges, 'Webinar'],
      [nc.non_caira_podcast_badges, 'Podcast'],
      [nc.non_caira_reel_badges, 'Reels'],
    ];
    for (const [entries, contentType] of arrays) {
      (entries ?? []).forEach((entry, i) =>
        items.push(toBadgeItem(entry, contentType, 'NON-CAIRA', i)),
      );
    }
  }

  return items;
}

/**
 * #23 · the three level achievement badges.
 *
 * **Corrects a backend defect.** `caira_badges.progress` uses the *global*
 * grand total as its numerator, so all three levels report the same earned
 * figure over different denominators. `progressCorrected` rebuilds the
 * numerator from the level's own badges and keeps the server's denominator; the
 * raw value stays on `progress` so the divergence is inspectable.
 *
 * #22 `get_badges_tracker_web` computes this correctly server-side, but the
 * shipped LMS does not call it, so parity means fixing it here.
 */
export function toLevelBadges(response: AllBadgesResponse | undefined): CairaLevelBadge[] {
  return (response?.data?.caira_based_data?.levels ?? []).map((level) => {
    const badge = level.caira_badges ?? {};
    const raw = parseCreditProgress(badge.progress);
    const earned = [
      level.caira_masterclass_badges,
      level.caira_webinar_badges,
      level.caira_podcast_badges,
      level.caira_reel_badges,
    ]
      .flatMap((entries) => entries ?? [])
      .reduce((sum, entry) => {
        const inner = entry.webinar_badge ?? entry.masterclass_badge ?? {};
        return sum + (inner.cpe_credit_allocated ?? 0);
      }, 0);

    const target = raw?.target ?? 0;
    return {
      levelName: level.level_name ?? '',
      badgeLabel: badge.level ?? '',
      progress: raw,
      progressCorrected: raw
        ? {
            earned,
            target,
            percent: target > 0 ? Math.min(100, Math.max(0, (earned / target) * 100)) : 0,
          }
        : null,
      status: badge.status ?? '',
      badgeImageUrl: img(badge.badge_image_url),
      credlyBadgeImageUrl: img(badge.credly_badge_image_url),
      credlyAcceptUrl: img(badge.credly_accept_url),
      allocatedOn: badge.allocated_on?.trim() || null,
    };
  });
}

export function toBadgeTotals(response: AllBadgesResponse | undefined): BadgeTotals {
  const totals = response?.data?.totals;
  return {
    cairaCredits: totals?.caira_credits ?? 0,
    nonCairaCredits: totals?.non_caira_credits ?? 0,
    grandTotal: totals?.grand_total ?? 0,
  };
}
