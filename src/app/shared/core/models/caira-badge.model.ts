import { ButtonVariant } from './button.model';
import { TransactionType } from './cpe-tracker.model';
import { parseNextPage } from '../../utils/parse-next-page';

/**
 * Wire types for the v2 badge endpoints (`Badge_API_v2.md`):
 *
 *   GET v2/caira-badges/        the logged-in user's CAIRA level ladder
 *   GET v2/caira-badges/:id/    + `description` and the info-modal `content`
 *   GET v2/course-badges/       one card per masterclass/podcast/nano/webinar course badge
 *   GET v2/webinar-badges/      one card per webinar badge, collapsed across its series
 *
 * These deliberately do NOT reuse `badge.model.ts`. That file models the **v1**
 * payloads and carries `toBadgeCardData()` — a client-side state machine that
 * derives which button a card shows. v2 ships a server-computed `action_state`
 * instead, so the machine is replaced by the `BADGE_ACTION_UI` lookup below.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * v2 pagination. Documented as `{ count, next, previous }`, but the v1 envelope
 * on this API spells the same fields `total_count` / `next_page`. Both are
 * accepted so a serializer that ships the legacy shape doesn't silently break
 * infinite scroll — read them through `badgeTotalCount` / `badgeNextPage`.
 */
export interface BadgeV2Pagination {
  count?: number;
  next?: string | number | null;
  previous?: string | number | null;
  total_count?: number;
  next_page?: string | number | null;
}

export interface BadgeV2Response<T> {
  status_code?: number;
  data: T;
  message?: string;
  pagination_data?: BadgeV2Pagination;
}

export const badgeTotalCount = (p: BadgeV2Pagination | undefined): number =>
  p?.count ?? p?.total_count ?? 0;

export const badgeNextPage = (p: BadgeV2Pagination | undefined): number | null =>
  parseNextPage(p?.next ?? p?.next_page);

// ---------------------------------------------------------------------------
// Shared refs
// ---------------------------------------------------------------------------

export type UserBadgeStatus = 'locked' | 'unlocked' | 'earned' | 'revoked';

/** v2 `course_type` uses the same spellings as the tracker's `TransactionType`. */
export type BadgeCourseType = TransactionType;

/** The `UserBadge` row, present from `unlocked` onward. `id` is what claims. */
export interface BadgeUserRef {
  id: number;
  status: UserBadgeStatus;
  awarded_at: string | null;
  accept_url: string | null;
}

// ---------------------------------------------------------------------------
// CAIRA ladder
// ---------------------------------------------------------------------------

export interface CairaBadgeBullet {
  title: string;
  description: string;
}

/** The ⓘ modal's three tabs. Retrieve-only — absent from the list response. */
export interface CairaBadgeContent {
  what_you_will_learn: CairaBadgeBullet[];
  how_will_you_learn: CairaBadgeBullet[];
  what_will_you_get: CairaBadgeBullet[];
}

export interface CairaBadgeRef {
  id: number;
  name: string;
  sub_text: string | null;
  badge_type: string;
  level_name: string | null;
  level_rank: number;
  icon_url: string | null;
  required_credits: number | string;
  is_coming_soon: boolean;
  /** Retrieve only. */
  description?: string;
  /** Retrieve only. */
  content?: CairaBadgeContent;
}

export interface CairaLadderItem {
  id: number;
  badge: CairaBadgeRef;
  status: UserBadgeStatus;
  progress: { earned: number; required: number; percentage: number };
  awarded_at: string | null;
  image_url: string | null;
  accept_url: string | null;
}

/** Status line in the ⓘ modal — "Current Reward Status: …". */
export const CAIRA_STATUS_LABEL: Record<UserBadgeStatus, string> = {
  locked: 'Locked',
  unlocked: 'In Progress',
  earned: 'Earned',
  revoked: 'Revoked',
};

// ---------------------------------------------------------------------------
// Course / webinar badge cards
// ---------------------------------------------------------------------------

export type BadgeActionState =
  | 'coming_soon'
  | 'register_now'
  | 'registered'
  | 'locked'
  | 'in_progress'
  | 'submit_feedback'
  | 'claim_badge'
  | 'view_badge';

export interface CourseBadgeItem {
  /** `CourseBadge` id — a badge can be attached to several courses. */
  id: number;
  name: string | null;
  icon_url: string | null;
  action_state: BadgeActionState;
  course: {
    id: number;
    course_type: BadgeCourseType;
    title: string;
    thumbnail: string | null;
    credits: number;
  };
  user_badge: BadgeUserRef | null;
}

export interface WebinarBadgeItem {
  /** Badge id (not `CourseBadge`) — webinar badges collapse across their series. */
  id: number;
  name: string;
  icon_url: string | null;
  action_state: BadgeActionState;
  /** Soonest upcoming or most recent past session; `null` when `coming_soon`. */
  session: { id: number; title: string; start_time: string; credits: number } | null;
  user_badge: BadgeUserRef | null;
}

// ---------------------------------------------------------------------------
// Action state → UI
// ---------------------------------------------------------------------------

export interface BadgeActionUi {
  /** Button label. Also carries the state's meaning — cards render no separate
   *  status line, so their height stays independent of the action state. */
  label: string;
  variant: ButtonVariant;
  /**
   * Theme-token override merged over the variant by `cn()`. The design's CTA
   * blue is `--accent` (#2a85ff, Figma "Primary/01"), which is brighter than
   * the `--primary` the `primary` variant paints; amber uses `accent-premium`.
   */
  class: string;
  disabled: boolean;
  /** Amber/blue accent ring on webinar cards, which have no button. */
  ring: string;
}

const ACTION_BLUE = 'bg-accent hover:bg-accent/90 text-white';
const ACTION_AMBER = 'bg-accent-premium hover:bg-accent-premium/90 text-black';
const ACTION_QUIET = 'border-white/15 bg-transparent text-white hover:bg-white/5';

export const BADGE_ACTION_UI: Record<BadgeActionState, BadgeActionUi> = {
  coming_soon: {
    label: 'Coming Soon',
    variant: 'outline',
    class: ACTION_QUIET,
    disabled: true,
    ring: '',
  },
  register_now: {
    label: 'Register Now',
    variant: 'primary',
    class: ACTION_BLUE,
    disabled: false,
    ring: 'ring-1 ring-accent/40',
  },
  registered: {
    label: 'Registered',
    variant: 'outline',
    class: ACTION_QUIET,
    disabled: false,
    ring: 'ring-1 ring-accent/40',
  },
  locked: {
    label: 'Locked',
    variant: 'outline',
    class: ACTION_QUIET,
    disabled: true,
    ring: '',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'outline',
    class: ACTION_QUIET,
    disabled: false,
    ring: '',
  },
  submit_feedback: {
    label: 'Submit Feedback',
    variant: 'primary',
    class: ACTION_AMBER,
    disabled: false,
    ring: 'ring-1 ring-accent-premium/60',
  },
  claim_badge: {
    label: 'Claim Badge',
    variant: 'primary',
    class: ACTION_BLUE,
    disabled: false,
    ring: 'ring-1 ring-accent-premium/60',
  },
  view_badge: {
    label: 'View Badge',
    variant: 'outline',
    class: ACTION_QUIET,
    disabled: false,
    ring: 'ring-1 ring-accent/40',
  },
};

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

export type BadgeFilter = 'all' | 'upcoming' | 'in_progress' | 'completed';

/**
 * Chip → action states. Client-side: v2 exposes no status filter param, so the
 * chips narrow whatever pages have been loaded. See the plan's open deps.
 *
 * `locked` (paid content the user hasn't bought) sits under "In Progress"
 * because it is un-started rather than finished — confirm with product.
 */
export const BADGE_FILTER_STATES: Record<
  Exclude<BadgeFilter, 'all'>,
  readonly BadgeActionState[]
> = {
  upcoming: ['register_now', 'registered', 'coming_soon'],
  in_progress: ['in_progress', 'submit_feedback', 'locked'],
  completed: ['claim_badge', 'view_badge'],
};

export const matchesBadgeFilter = (state: BadgeActionState, filter: BadgeFilter): boolean =>
  filter === 'all' || BADGE_FILTER_STATES[filter].includes(state);

/** "N Badges Earned" counts both the ready-to-claim and already-claimed states. */
export const isEarnedState = (state: BadgeActionState): boolean =>
  state === 'claim_badge' || state === 'view_badge';

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

/** Course-type chips on the Course Badges page. `null` = every non-webinar type. */
export interface CourseTypeOption {
  value: BadgeCourseType | null;
  label: string;
}

export const COURSE_BADGE_TYPES: readonly CourseTypeOption[] = [
  // { value: null, label: 'All' },
  { value: 'masterclass', label: 'Masterclass' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'nano_learning', label: 'Nano-Learning' },
];
