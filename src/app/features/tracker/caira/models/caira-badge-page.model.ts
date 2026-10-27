import { environment } from '@env/environment';
import { ButtonVariant } from '@core/models/button.model';

/**
 * Wire types for the CAIRA tracker's one read:
 *
 *   GET web-api/v1/badges/page/   every section of the tracker, in one response
 *
 * It replaced four `v2/` routes on 2026-10-13 — `caira-badges/`, `caira-badges/:id/`,
 * `course-badges/` and `webinar-badges/` — all four of which now answer **404**. There is
 * no fallback to keep; the old shapes are gone, which is why `core/models/caira-badge.model.ts`
 * went with them.
 *
 * `IsAuthenticated`: a request without a token is a 401, not an empty page. The route is
 * `authGuard`-ed and the facade gates on `isAuthenticated()`.
 *
 * ## The half-observed enums
 *
 * `state`, `cta.action` and `badge_claim.state` are typed as plain `string`, deliberately.
 * The only payload anyone has captured is a learner with zero progress: every row is
 * `LOCKED` or `COMING_SOON`, every claim is `NOT_ISSUED`, every action is `NONE` or
 * `OPEN_COURSE`. The values an earned badge carries are unknown. Closing those unions would
 * mean a learner who has actually earned something trips `contractError` and sees the whole
 * page fail — the opposite of what the guard is for. So the guards check shape, not
 * vocabulary, and everything the UI derives keys off `badge_claim.awarded`,
 * `badge_claim.claimed` and `cta.enabled`, whose meaning does not depend on the enum.
 * Close them once the backend answers Q10 in `docs/MASTERCLASS_API_QUESTIONS.md`.
 */

/** The origin root carries the trailing slash; `web-api/` and `api/` are siblings under it. */
export const BADGES_PAGE_URL = `${environment.API.baseUrl}web-api/v1/badges/page/`;

/**
 * The three paged sections, spelled exactly as the API namespaces their query parameters:
 * `?webinar_badges.page=2`. The strings are the contract, not labels.
 */
export const BADGE_SECTIONS = ['level_badges', 'webinar_badges', 'masterclass_badges'] as const;
export type BadgeSection = (typeof BADGE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

/**
 * The server-computed call to action. This is the whole reason the old
 * `BADGE_ACTION_UI` label table is gone: the backend now sends the wording, so the
 * client decides only how it looks and what the click does.
 */
export interface BadgeCta {
  label: string;
  /** Observed: `NONE`, `OPEN_COURSE`. Open union on purpose — see the file header. */
  action: string;
  url: string | null;
  enabled: boolean;
  course_id: string | null;
  webinar_id: string | null;
}

/**
 * Credly issuance. Note what is NOT here: an id. The old flow claimed through
 * `GET user-badges/:id/claim/` keyed on `user_badge.id`; that route is 404 and nothing in
 * this block replaces it. The client can only open `accept_url` once the server fills it.
 */
export interface BadgeClaim {
  /** Observed: `NOT_ISSUED`. Open union — see the file header. */
  state: string;
  awarded: boolean;
  claimed: boolean;
  status_raw: string | null;
  accept_url: string | null;
  assertion_id: string | null;
}

/** A rung on the CAIRA ladder. The same object appears on `cpe_summary` and on a level badge. */
export interface CairaLevel {
  id: string;
  /** "Level 1" — the rung's short name. */
  name: string;
  /** "AI Mindset, Skillset & Toolset" — the rung's subject. */
  level_actual_name: string;
  number: number;
  cpe_threshold: number;
}

/** One page of a section. The API pages every list, including the three-rung ladder. */
export interface BadgeSectionPage<T> {
  count: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  results: T[];
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Fields every row carries, whichever section it came from. */
interface BadgeRowBase {
  badge_template_id: string;
  badge_name: string;
  badge_image_url: string | null;
  subtitle: string | null;
  /** Observed: `LOCKED`, `COMING_SOON`. Open union — see the file header. */
  state: string;
  cta: BadgeCta;
  badge_claim: BadgeClaim;
  certificate_url: string | null;
}

export interface LevelBadge extends BadgeRowBase {
  level: CairaLevel;
  is_eligible: boolean;
}

export interface WebinarBadge extends BadgeRowBase {
  total_cpe_credits: number;
  /** Pre-formatted, e.g. "2.0 Credits" — rendered as sent so it matches the app elsewhere. */
  credits_label: string | null;
  upcoming_sessions_count: number;
  is_registered: boolean;
  is_attended: boolean;
  is_cpe_eligible: boolean;
}

export interface MasterclassBadge extends BadgeRowBase {
  course_id: string | null;
  course_name: string | null;
  course_thumbnail_url: string | null;
  is_course_closed: boolean;
}

/**
 * The learner's credit standing. `progress_percent` and `progress_label` describe progress
 * towards `next_level` ONLY — there is no per-level progress on this endpoint, which is why
 * the hero derives a rung's own bar from `caira_cpe_credits` against its `cpe_threshold`.
 */
export interface CpeSummary {
  total_cpe_credits: number;
  caira_cpe_credits: number;
  current_level: CairaLevel | null;
  next_level: CairaLevel | null;
  credits_to_next_level: number | null;
  progress_percent: number;
  progress_label: string | null;
}

export interface CairaBadgesPage {
  cpe_summary: CpeSummary;
  level_badges: BadgeSectionPage<LevelBadge>;
  webinar_badges: BadgeSectionPage<WebinarBadge>;
  masterclass_badges: BadgeSectionPage<MasterclassBadge>;
}

/** The shape templates read before the first response lands. */
export const EMPTY_SECTION: BadgeSectionPage<never> = {
  count: 0,
  page: 1,
  total_pages: 1,
  has_next: false,
  results: [],
};

export const EMPTY_BADGES_PAGE: CairaBadgesPage = {
  cpe_summary: {
    total_cpe_credits: 0,
    caira_cpe_credits: 0,
    current_level: null,
    next_level: null,
    credits_to_next_level: null,
    progress_percent: 0,
    progress_label: null,
  },
  level_badges: EMPTY_SECTION,
  webinar_badges: EMPTY_SECTION,
  masterclass_badges: EMPTY_SECTION,
};

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * The next page number for one section, or `null` at the end.
 *
 * Derived from `has_next` + `page`, NOT by parsing the response's `next` URL.
 * That URL namespaces its parameter (`?webinar_badges.page=2`), and
 * `core/utils/parse-next-page.ts` looks for a bare `page`, so it returns `null` for every
 * one of these — reusing it would silently disable infinite scroll. Two integers already
 * in the payload beat re-parsing a URL.
 */
export const nextSectionPage = (page: BadgeSectionPage<unknown>): number | null =>
  page.has_next ? page.page + 1 : null;

// ---------------------------------------------------------------------------
// Derived UI state
// ---------------------------------------------------------------------------

/** The filter chips' buckets. */
export type BadgeFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';

export interface BadgeFilterOption {
  value: BadgeFilter;
  label: string;
}

export const WEBINAR_BADGE_FILTERS: readonly BadgeFilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export const COURSE_BADGE_FILTERS: readonly BadgeFilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Which bucket a row falls in.
 *
 * Keyed on `badge_claim` and the one `state` value whose meaning is unambiguous, rather
 * than on the `state` enum as a whole — see the file header. A badge the learner has been
 * awarded is done whatever the row calls itself; a badge whose content has not shipped is
 * upcoming; everything else is in progress.
 */
export function badgeProgress(row: BadgeRowBase): Exclude<BadgeFilter, 'all'> {
  if (row.badge_claim.awarded || row.badge_claim.claimed) return 'completed';
  if (row.state === 'COMING_SOON') return 'upcoming';
  return 'in_progress';
}

export const matchesBadgeFilter = (row: BadgeRowBase, filter: BadgeFilter): boolean =>
  filter === 'all' || badgeProgress(row) === filter;

/** "N Badges Earned" counts awarded and already-claimed alike. */
export const isEarned = (row: BadgeRowBase): boolean =>
  row.badge_claim.awarded || row.badge_claim.claimed;

/**
 * How a row's CTA is painted. The label is no longer here — the server sends it on `cta`.
 *
 * The design's CTA blue is `--accent` (#2a85ff, Figma "Primary/01"), brighter than the
 * `--primary` the `primary` variant paints; amber is `accent-premium`. Carried over from
 * the v2 `BADGE_ACTION_UI` table unchanged, so the cards look the same as before.
 */
export interface BadgeCtaUi {
  variant: ButtonVariant;
  /** Theme-token override merged over the variant by `cn()`. */
  class: string;
  disabled: boolean;
  /** Accent ring on the webinar card, which has no button of its own. */
  ring: string;
}

const CTA_BLUE = 'bg-accent hover:bg-accent/90 text-white';
const CTA_AMBER = 'bg-accent-premium hover:bg-accent-premium/90 text-black';
const CTA_QUIET = 'border-white/15 bg-transparent text-white hover:bg-white/5';

export function badgeCtaUi(row: BadgeRowBase): BadgeCtaUi {
  const { awarded, claimed } = row.badge_claim;

  // Ready to accept on Credly — the one state worth shouting about.
  if (awarded && !claimed) {
    return {
      variant: 'primary',
      class: CTA_AMBER,
      disabled: false,
      ring: 'ring-1 ring-accent-premium/60',
    };
  }
  if (claimed) {
    return { variant: 'outline', class: CTA_QUIET, disabled: false, ring: 'ring-1 ring-accent/40' };
  }
  // `enabled` is the server's own word for "this click does something".
  if (row.cta.enabled) {
    return { variant: 'primary', class: CTA_BLUE, disabled: false, ring: 'ring-1 ring-accent/40' };
  }
  return { variant: 'outline', class: CTA_QUIET, disabled: true, ring: '' };
}

// ---------------------------------------------------------------------------
// Contract guards
// ---------------------------------------------------------------------------

/**
 * The trust boundary. Hand-written for the same reason as the webinar feed's: a renamed key
 * would otherwise render as `undefined` with no signal. Every key a template reads is
 * checked; EXTRA keys pass, because the contract adds keys without notice. A missing or
 * retyped key fails the WHOLE response, once, in `parse`, so it lands in `error()` rather
 * than half-rendered on screen.
 *
 * These primitives are a local copy of `features/offerings/utils/contract-guards.ts` on
 * purpose: a feature may not import another feature (AGENTS.md §3), which is also why
 * `offerings/webinar` and `home` carry their own.
 */
type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

const listOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

/** Thrown from `parse`; the message names the route so the log says where. */
function contractError(part: string): Error {
  return new Error(`[caira-tracker] badges/page ${part} does not match the contract.`);
}

function isCta(v: unknown): v is BadgeCta {
  return (
    isObject(v) &&
    isStr(v['label']) &&
    isStr(v['action']) &&
    isStrOrNull(v['url']) &&
    isBool(v['enabled']) &&
    isStrOrNull(v['course_id']) &&
    isStrOrNull(v['webinar_id'])
  );
}

function isClaim(v: unknown): v is BadgeClaim {
  return (
    isObject(v) &&
    isStr(v['state']) &&
    isBool(v['awarded']) &&
    isBool(v['claimed']) &&
    isStrOrNull(v['status_raw']) &&
    isStrOrNull(v['accept_url']) &&
    isStrOrNull(v['assertion_id'])
  );
}

function isLevel(v: unknown): v is CairaLevel {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStr(v['level_actual_name']) &&
    isNum(v['number']) &&
    isNum(v['cpe_threshold'])
  );
}

const isLevelOrNull = (v: unknown): v is CairaLevel | null => v === null || isLevel(v);

/**
 * The keys every row shares. Takes an already-narrowed `Json` and returns a plain boolean
 * rather than a type predicate, so each section's guard can keep checking its OWN keys off
 * the same object — narrowing to `BadgeRowBase` first would lose the index signature.
 */
function hasRowBase(v: Json): boolean {
  return (
    isStr(v['badge_template_id']) &&
    isStr(v['badge_name']) &&
    isStrOrNull(v['badge_image_url']) &&
    isStrOrNull(v['subtitle']) &&
    isStr(v['state']) &&
    isCta(v['cta']) &&
    isClaim(v['badge_claim']) &&
    isStrOrNull(v['certificate_url'])
  );
}

function isLevelBadge(v: unknown): v is LevelBadge {
  return isObject(v) && hasRowBase(v) && isLevel(v['level']) && isBool(v['is_eligible']);
}

function isWebinarBadge(v: unknown): v is WebinarBadge {
  return (
    isObject(v) &&
    hasRowBase(v) &&
    isNum(v['total_cpe_credits']) &&
    isStrOrNull(v['credits_label']) &&
    isNum(v['upcoming_sessions_count']) &&
    isBool(v['is_registered']) &&
    isBool(v['is_attended']) &&
    isBool(v['is_cpe_eligible'])
  );
}

function isMasterclassBadge(v: unknown): v is MasterclassBadge {
  return (
    isObject(v) &&
    hasRowBase(v) &&
    isStrOrNull(v['course_id']) &&
    isStrOrNull(v['course_name']) &&
    isStrOrNull(v['course_thumbnail_url']) &&
    isBool(v['is_course_closed'])
  );
}

/** A section block whose rows all pass `guard`. A bare array is not one. */
const sectionOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is BadgeSectionPage<T> =>
    isObject(v) &&
    isNum(v['count']) &&
    isNum(v['page']) &&
    isNum(v['total_pages']) &&
    isBool(v['has_next']) &&
    listOf(guard)(v['results']);

function isCpeSummary(v: unknown): v is CpeSummary {
  return (
    isObject(v) &&
    isNum(v['total_cpe_credits']) &&
    isNum(v['caira_cpe_credits']) &&
    isLevelOrNull(v['current_level']) &&
    isLevelOrNull(v['next_level']) &&
    isNumOrNull(v['credits_to_next_level']) &&
    isNum(v['progress_percent']) &&
    isStrOrNull(v['progress_label'])
  );
}

/**
 * `parse` for `badges/page/`: peels the `{success, message, data}` envelope and rebuilds
 * each section, so the paging metadata the UI does not use stays at the boundary.
 */
export function parseBadgesPage(raw: unknown): CairaBadgesPage {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('envelope');

  // Pulled into locals so each guard narrows its own value — no cast needed.
  const cpe_summary = data['cpe_summary'];
  const level_badges = data['level_badges'];
  const webinar_badges = data['webinar_badges'];
  const masterclass_badges = data['masterclass_badges'];

  if (!isCpeSummary(cpe_summary)) throw contractError('cpe_summary');
  if (!sectionOf(isLevelBadge)(level_badges)) throw contractError('level_badges');
  if (!sectionOf(isWebinarBadge)(webinar_badges)) throw contractError('webinar_badges');
  if (!sectionOf(isMasterclassBadge)(masterclass_badges)) throw contractError('masterclass_badges');

  return { cpe_summary, level_badges, webinar_badges, masterclass_badges };
}
