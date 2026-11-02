import { CategoryListItem } from '@core/models/course.model';
import {
  isBool,
  isNum,
  isNumOrNull,
  isObject,
  isStr,
  isStrOrNull,
  Json,
  listOf,
} from '@core/utils/contract-guards';

/**
 * Wire types for the two reads behind "Your CPE Portfolio":
 *
 *   GET web-api/v1/cpe-tracker/summary/?year=     the card + the compliance gauge
 *   GET web-api/v1/cpe-tracker/credits/?ledger=   the table, paged
 *
 * They replaced `v2/cpe-tracker/` and `v2/cpe-tracker/summary/` on 2026-10-19 (backend MO-2776).
 * The old pair answers a plain-HTML 404 — there is no fallback to keep, which is why the v2 shapes
 * that used to live here are gone rather than deprecated.
 *
 * ## Three things the new contract changed under the same column headings
 *
 * 1. **`course_type` was re-spelled.** `masterclass` is now `course`, and `micro_learning` exists
 *    beside `nano_learning`. Sending an old token is a 400, not an empty list.
 * 2. **Unknown query parameters are refused with 400.** `page_count` and `pagination_data` are gone;
 *    paging is `page` / `page_size` and the block sits under `data.credits`.
 * 3. **Every id is a UUID**, fields of study included.
 *
 * ## The open enums
 *
 * `course.course_type` and `badge.state` are received as plain `string`, deliberately — the same
 * decision as `caira-badge-page.model.ts`, for the same reason. Closing a union here would fail the
 * whole page into its error state the first time the backend adds a content type, and `course_type`
 * has already been re-spelled once. Everything the UI derives keys off booleans
 * (`certificate_available`, `feedback_required`, `is_archived`) or off the one state value whose
 * meaning is settled, so nothing depends on the vocabulary being complete.
 */

/** Every route is under this prefix; `apiUrl()` prepends the origin. */
const CPE_TRACKER_BASE = 'web-api/v1/cpe-tracker/';

export const CPE_SUMMARY_PATH = `${CPE_TRACKER_BASE}summary/`;
export const CPE_CREDITS_PATH = `${CPE_TRACKER_BASE}credits/`;

/** The page asks for 15 rows; the server's own default is 6 and its ceiling 100. */
export const CPE_PAGE_SIZE = 15;

export type CpeLedger = 'caira' | 'others';

/**
 * The tokens the client may send in `?course_type=`. Closed, because this is the set we choose
 * from — unlike `course.course_type` on a row, which is whatever the server has.
 */
export type CpeCourseFilter =
  'course' | 'podcast' | 'nano_learning' | 'micro_learning' | 'ai_lab' | 'webinar';

// ---------------------------------------------------------------------------
// API 1 — summary
// ---------------------------------------------------------------------------

/** One field's share of the year's credits. Ids are UUIDs. */
export interface CpeFieldShare {
  id: string;
  name: string;
  credits: number;
}

export interface CpeCreditsEarned {
  total_credit_earned: number;
  /** Name-matched buckets: contains "account", contains "ethic", everything else. */
  course_credits: { account_credits: number; ethics: number; others: number };
  /** Delivery-method buckets. `nano_learning` here includes AI Lab. */
  study_credits: { self_study: number; webinar: number; nano_learning: number };
  fields_of_study: CpeFieldShare[];
  /** Items with no active field of study. Also counted inside `course_credits.others`. */
  unclassified_credits: number;
}

/** The calendar years a board's cycle covers, ending in the selected year. */
export interface CpeStateBoardPeriod {
  start_year: number;
  end_year: number;
  credits_earned: number;
  ethics_credits_earned: number;
}

/**
 * A board the learner reports to. Every requirement is nullable and `null` means "admin has not
 * configured it", which is not the same as zero — so the gauge says so rather than inventing a
 * denominator, which is what the removed `DEFAULT_CPE_REQUIREMENT = 40` did.
 */
export interface CpeStateBoard {
  id: string;
  name: string;
  state_code: string | null;
  required_credits: number | null;
  required_ethics_credits: number | null;
  reporting_period_years: number | null;
  /** `null` whenever `reporting_period_years` is. */
  period: CpeStateBoardPeriod | null;
}

export interface CpeSummaryWire {
  year: number;
  caira_credits_earned: number;
  others_credits_earned: number;
  credits_earned: CpeCreditsEarned;
  /** Empty when the learner has picked no board. */
  state_boards: CpeStateBoard[];
}

/**
 * The first board with a configured requirement, or `null`.
 *
 * The payload is a list and the dialog draws one gauge, so the choice is explicit here rather than
 * implied by an index at the call site. Boards arrive in the learner's own picker order.
 */
export const primaryStateBoard = (summary: CpeSummaryWire | null): CpeStateBoard | null =>
  summary?.state_boards.find((board) => board.required_credits !== null) ?? null;

// ---------------------------------------------------------------------------
// API 2 — credits table
// ---------------------------------------------------------------------------

/**
 * A field of study as the table renders it.
 *
 * The wire spells the share `cpe_credit`; `CategoryListItem` reads `cpe_credits`. Renamed once, in
 * the parse, so no component has to know the contract differs from every other list in the app.
 */
export interface CpeFieldOfStudy extends CategoryListItem {
  id: string;
  name: string;
  cpe_credits: number;
}

export interface CpeCreditCourse {
  id: string | null;
  /** Open union — see the file header. `null` on an archived reel. */
  course_type: string | null;
  title: string | null;
  /** Only courses and webinars have one; `null` for AI Labs and archived items. */
  slug: string | null;
  thumbnail: string | null;
  /** Legacy content with no page to link to. */
  is_archived: boolean;
  fields_of_study: CpeFieldOfStudy[];
}

/**
 * Credly issuance for the row's award. `null` when the item has no badge configured at all, which
 * is always the case for AI Labs — distinct from a badge that exists but is not issued yet.
 */
export interface CpeCreditBadge {
  /** The claim API's `badge_id`. `null` until the badge is issued, so never send it blind. */
  id: string | null;
  name: string | null;
  image_url: string | null;
  /** `NOT_ISSUED` · `PENDING` · `FAILED` · `REVOKED` · `ISSUED_UNCLAIMED` · `CLAIMED`. Open union. */
  state: string;
  claimed: boolean;
  accept_url: string | null;
}

export interface CpeCreditWire {
  /** The **award** id, not the course's. Keys the per-row certificate route. */
  id: string;
  course: CpeCreditCourse;
  /** Frozen at award time and never re-priced. */
  credits: number;
  /** `YYYY-MM-DD` in **UTC** — render it with the pipe's UTC argument or it reads a day early. */
  allocated_on: string;
  was_caira_credit: boolean;
  /** `QAS Self Study` · `Group Internet Based` · `Group Live` · `Nano Learning`, as the certificate prints it. */
  delivery_method: string;
  badge: CpeCreditBadge | null;
  certificate_available: boolean;
  /** The item type asks for feedback. `false` for archived items. */
  feedback_required: boolean;
  feedback_submitted: boolean;
}

/** One page of a list. `slug`, `next` and `previous` are present on the wire and unused here. */
export interface CpePage<T> {
  count: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  results: T[];
}

export const EMPTY_CREDITS_PAGE: CpePage<CpeCreditWire> = {
  count: 0,
  page: 1,
  total_pages: 1,
  has_next: false,
  results: [],
};

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

/**
 * No `download` yet: the certificate lives behind `credits/<award_id>/certificate/`, which arrives
 * with the rest of the certificate work. A button that cannot serve a file is worse than no button,
 * so the action appears when the route it needs does.
 */
export type CpeRowAction = 'feedback' | 'view_badge';

export interface CpeActionUi {
  label: string;
  /** Extra classes merged over the shared action-button base. */
  theme: string;
}

export const CPE_ACTION_UI: Record<CpeRowAction, CpeActionUi> = {
  feedback: { label: 'Feedback', theme: 'bg-accent-premium text-black hover:bg-accent-premium/90' },
  view_badge: { label: 'View Badge', theme: 'bg-white/10 text-white hover:bg-white/20' },
};

/**
 * What the Action cell offers.
 *
 * v2 made feedback and download mutually exclusive — feedback gated the download. The new contract
 * reports them independently (`certificate_available` is "a PDF exists", `feedback_required` is
 * "this item type asks"), so the gate is gone; a row with nothing to offer offers nothing rather
 * than a button that fails on click.
 */
export function cpeRowActions(row: CpeCreditWire): CpeRowAction[] {
  const actions: CpeRowAction[] = [];
  if (row.feedback_required && !row.feedback_submitted) actions.push('feedback');
  if (row.badge?.claimed && row.badge.accept_url) actions.push('view_badge');
  return actions;
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export interface CpeOption<T> {
  value: T;
  label: string;
}

/**
 * What the Course Type selector offers. The value is a plain key, not the token list it stands for,
 * because a select compares values by identity and an array literal would never match itself.
 */
export type CpeCourseChoice = 'all' | 'course' | 'podcast' | 'webinar' | 'reels';

export const CPE_COURSE_TYPE_OPTIONS: readonly CpeOption<CpeCourseChoice>[] = [
  { value: 'all', label: 'All' },
  { value: 'course', label: 'Masterclass' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'reels', label: 'Reels' },
];

/**
 * A selector choice → the `?course_type=` tokens it sends. `[]` means "omit the parameter".
 *
 * "Reels" carries **both** learning tokens: the API accepts `nano_learning` and `micro_learning` as
 * separate types and has not said what distinguishes them, while this app has only ever had the one
 * concept (API `nano_learning`, URL `micro-learning`). Sending both cannot under-count; picking one
 * could. Narrow it when the backend answers.
 *
 * `ai_lab` is a valid token with no selector entry — the design has five options and AI Lab rows
 * appear under "All", exactly as they did before.
 */
export const CPE_COURSE_TYPE_TOKENS: Record<CpeCourseChoice, readonly CpeCourseFilter[]> = {
  all: [],
  course: ['course'],
  podcast: ['podcast'],
  webinar: ['webinar'],
  reels: ['nano_learning', 'micro_learning'],
};

export const CPE_LEDGER_OPTIONS: readonly CpeOption<CpeLedger>[] = [
  { value: 'caira', label: 'CAIRA' },
  { value: 'others', label: 'Others' },
];

// ---------------------------------------------------------------------------
// Contract guards
// ---------------------------------------------------------------------------

/**
 * The trust boundary. Hand-written for the same reason as the CAIRA tracker's and the webinar
 * feed's: a renamed key would otherwise render as `undefined` with no signal, and this contract has
 * already renamed one. Every key a template reads is checked; EXTRA keys pass, because the API adds
 * keys without notice. A missing or retyped key fails the WHOLE response, once, so it lands in
 * `error()` rather than half-rendered.
 */

/** Thrown from a `parse`; the message names the route so the log says where. */
function contractError(part: string): Error {
  return new Error(`[cpe-tracker] ${part} does not match the contract.`);
}

function isFieldShare(v: unknown): v is CpeFieldShare {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['credits']);
}

function isCreditsEarned(v: unknown): v is CpeCreditsEarned {
  if (!isObject(v) || !isNum(v['total_credit_earned']) || !isNum(v['unclassified_credits'])) {
    return false;
  }
  const course = v['course_credits'];
  const study = v['study_credits'];
  return (
    isObject(course) &&
    isNum(course['account_credits']) &&
    isNum(course['ethics']) &&
    isNum(course['others']) &&
    isObject(study) &&
    isNum(study['self_study']) &&
    isNum(study['webinar']) &&
    isNum(study['nano_learning']) &&
    listOf(isFieldShare)(v['fields_of_study'])
  );
}

function isPeriod(v: unknown): v is CpeStateBoardPeriod {
  return (
    isObject(v) &&
    isNum(v['start_year']) &&
    isNum(v['end_year']) &&
    isNum(v['credits_earned']) &&
    isNum(v['ethics_credits_earned'])
  );
}

function isStateBoard(v: unknown): v is CpeStateBoard {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStrOrNull(v['state_code']) &&
    isNumOrNull(v['required_credits']) &&
    isNumOrNull(v['required_ethics_credits']) &&
    isNumOrNull(v['reporting_period_years']) &&
    (v['period'] === null || isPeriod(v['period']))
  );
}

/** `parse` for `summary/`: peels the `{success, message, data}` envelope. */
export function parseCpeSummary(raw: unknown): CpeSummaryWire {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('summary envelope');

  const credits_earned = data['credits_earned'];
  const state_boards = data['state_boards'];

  if (
    !isNum(data['year']) ||
    !isNum(data['caira_credits_earned']) ||
    !isNum(data['others_credits_earned'])
  ) {
    throw contractError('summary totals');
  }
  if (!isCreditsEarned(credits_earned)) throw contractError('summary credits_earned');
  if (!listOf(isStateBoard)(state_boards)) throw contractError('summary state_boards');

  return {
    year: data['year'],
    caira_credits_earned: data['caira_credits_earned'],
    others_credits_earned: data['others_credits_earned'],
    credits_earned,
    state_boards,
  };
}

/** A wire field of study, before `cpe_credit` is renamed. */
function isWireField(v: unknown): v is Json {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['cpe_credit']);
}

function isCourse(v: unknown): v is Json {
  return (
    isObject(v) &&
    isStrOrNull(v['id']) &&
    isStrOrNull(v['course_type']) &&
    isStrOrNull(v['title']) &&
    isStrOrNull(v['slug']) &&
    isStrOrNull(v['thumbnail']) &&
    isBool(v['is_archived']) &&
    listOf(isWireField)(v['fields_of_study'])
  );
}

function isBadge(v: unknown): v is CpeCreditBadge {
  return (
    isObject(v) &&
    isStrOrNull(v['id']) &&
    isStrOrNull(v['name']) &&
    isStrOrNull(v['image_url']) &&
    isStr(v['state']) &&
    isBool(v['claimed']) &&
    isStrOrNull(v['accept_url'])
  );
}

function isCreditRow(v: unknown): v is Json {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isCourse(v['course']) &&
    isNum(v['credits']) &&
    isStr(v['allocated_on']) &&
    isBool(v['was_caira_credit']) &&
    isStr(v['delivery_method']) &&
    (v['badge'] === null || isBadge(v['badge'])) &&
    isBool(v['certificate_available']) &&
    isBool(v['feedback_required']) &&
    isBool(v['feedback_submitted'])
  );
}

/** Rebuilds one checked row, renaming `cpe_credit` on the way through. */
function toCreditRow(raw: Json): CpeCreditWire {
  const course = raw['course'] as Json;
  const fields = course['fields_of_study'] as Json[];

  return {
    id: raw['id'] as string,
    course: {
      id: course['id'] as string | null,
      course_type: course['course_type'] as string | null,
      title: course['title'] as string | null,
      slug: course['slug'] as string | null,
      thumbnail: course['thumbnail'] as string | null,
      is_archived: course['is_archived'] as boolean,
      fields_of_study: fields.map((field) => ({
        id: field['id'] as string,
        name: field['name'] as string,
        cpe_credits: field['cpe_credit'] as number,
      })),
    },
    credits: raw['credits'] as number,
    allocated_on: raw['allocated_on'] as string,
    was_caira_credit: raw['was_caira_credit'] as boolean,
    delivery_method: raw['delivery_method'] as string,
    badge: raw['badge'] as CpeCreditBadge | null,
    certificate_available: raw['certificate_available'] as boolean,
    feedback_required: raw['feedback_required'] as boolean,
    feedback_submitted: raw['feedback_submitted'] as boolean,
  };
}

/**
 * `parse` for `credits/`: peels the envelope and lifts the paging block out of `data.credits`, so
 * the page reads one flat shape rather than two levels of nesting.
 */
export function parseCpeCredits(raw: unknown): CpePage<CpeCreditWire> {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('credits envelope');

  const page = data['credits'];
  if (
    !isObject(page) ||
    !isNum(page['count']) ||
    !isNum(page['page']) ||
    !isNum(page['total_pages']) ||
    !isBool(page['has_next']) ||
    !listOf(isCreditRow)(page['results'])
  ) {
    throw contractError('credits page');
  }

  return {
    count: page['count'],
    page: page['page'],
    total_pages: page['total_pages'],
    has_next: page['has_next'],
    results: page['results'].map(toCreditRow),
  };
}
