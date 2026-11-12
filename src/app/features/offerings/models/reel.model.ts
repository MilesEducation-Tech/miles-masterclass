import { isMasterclassCourse, MasterclassCourse } from '@core/models/masterclass-home.model';
import {
  contractError,
  isBool,
  isNum,
  isNumOrNull,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@core/utils/contract-guards';
import { CourseMode } from '@features/offerings/models/course-detail.model';

/**
 * The reel player's types, built from the web API's reel feed (Postman
 * `web-masterclass-reels-feed-v1` / `-reels-feed-anchor-v1`, checked on UAT
 * 2026-11-12). A reel is a course of type `nano_learning` or `micro_learning`
 * with one chapter; a feed item is the course card plus that chapter and the
 * learner's state on it, so the player needs no second read to draw a reel.
 * These are the keys the player READS; the item carries more (`like_count`,
 * `reels_subtype`, `instructors`…).
 */

/** `course_type` of a reel. A `micro_learning` reel ends in a chapter quiz, a `nano_learning` one in the exam. */
export type ReelCourseType = 'nano_learning' | 'micro_learning';

/** The next step the server decides for the learner (`Masterclass.utils.reel_actions`); `null` when none. */
export type ReelActionStatus =
  | 'WATCH_IN_CPE_MODE'
  | 'TAKE_QUIZ'
  | 'TAKE_EXAM'
  | 'RETAKE_EXAM'
  | 'REWATCH'
  | 'FEEDBACK'
  | 'DOWNLOAD';

/** The reel's one playable chapter: progress and the chapter quiz are keyed on its `id`. */
export interface ReelChapter {
  id: string;
  name: string;
  duration_seconds: number;
  /** The stream; `null` while the reel is locked to the learner (always signed out). */
  hls_video_url: string | null;
  /** 0 for a reel with no chapter quiz (a nano reel). */
  total_quiz_questions: number;
}

/** The learner's state on a reel; every key at its signed-out value on a `pre_login` read. */
export interface ReelUserState {
  /** `null` until a mode is chosen. */
  course_mode: CourseMode | null;
  /** No entitlement (always signed out): the chapter's stream is stripped. */
  course_is_locked: boolean;
  /** The resume point, in seconds. */
  last_watched_position_seconds: number | null;
  /** The edge of what has been watched straight through, in seconds. */
  max_watched_duration_seconds: number | null;
  is_video_completed: boolean;
  is_chapter_completed: boolean;
  assessment_status: 'not_attempted' | 'failed' | 'passed';
  feedback_submitted: boolean;
  action_status: ReelActionStatus | null;
  /** The issued certificate; `null` until then. */
  certificate_url: string | null;
}

/** A reel's instructor, as the feed names them. */
export interface ReelInstructor {
  id: string;
  name: string;
}

/** One reel of the feed. */
export type Reel = MasterclassCourse & {
  course_type: ReelCourseType;
  instructors: ReelInstructor[];
  /** The 9:16 trailer: what plays while the reel is locked. */
  vertical_trailer_url: string | null;
  chapter: ReelChapter;
  user_state: ReelUserState;
};

/** One page of the feed, unwrapped. */
export interface ReelFeedPage {
  reels: Reel[];
  page: number;
  hasNext: boolean;
}

/** The feed opened on one reel: that reel, then page 1 of the feed without it. */
export interface ReelAnchor {
  anchor: Reel;
  rest: ReelFeedPage;
}

/**
 * A reel by its URL: `:courseId` (a UUID, or an old numeric id) and
 * `:courseTitle` (the slug). Also the About panel's dialog data.
 */
export interface ReelRouteParams {
  courseId: string;
  slug: string;
}

/**
 * What the learner may watch: signed out (`guest`) or without access
 * (`locked`) the trailer, with access (`open`) the reel itself.
 */
export type ReelAccess = 'guest' | 'locked' | 'open';

/** Bring a reel into view; the token lets the same reel be asked for twice. */
export interface ReelScrollRequest {
  id: string;
  token: number;
}

// ---- Trust boundary --------------------------------------------------------
//
// Every key the player reads is checked; extra keys pass. A missing or retyped
// one fails the whole answer in the resource's `parse`, so it lands in
// `error()` rather than half-rendered.

const REEL_COURSE_TYPE_VALUES: readonly string[] = ['nano_learning', 'micro_learning'];

const ACTION_STATUSES: readonly string[] = [
  'WATCH_IN_CPE_MODE',
  'TAKE_QUIZ',
  'TAKE_EXAM',
  'RETAKE_EXAM',
  'REWATCH',
  'FEEDBACK',
  'DOWNLOAD',
];

const ASSESSMENT_STATUSES: readonly string[] = ['not_attempted', 'failed', 'passed'];

const isReelChapter = (v: unknown): v is ReelChapter =>
  isObject(v) &&
  isStr(v['id']) &&
  isStr(v['name']) &&
  isNum(v['duration_seconds']) &&
  isStrOrNull(v['hls_video_url']) &&
  isNum(v['total_quiz_questions']);

const isUserState = (v: unknown): v is ReelUserState =>
  isObject(v) &&
  (v['course_mode'] === null || v['course_mode'] === 'cpe' || v['course_mode'] === 'preview') &&
  isBool(v['course_is_locked']) &&
  isNumOrNull(v['last_watched_position_seconds']) &&
  isNumOrNull(v['max_watched_duration_seconds']) &&
  isBool(v['is_video_completed']) &&
  isBool(v['is_chapter_completed']) &&
  isStr(v['assessment_status']) &&
  ASSESSMENT_STATUSES.includes(v['assessment_status']) &&
  isBool(v['feedback_submitted']) &&
  (v['action_status'] === null ||
    (isStr(v['action_status']) && ACTION_STATUSES.includes(v['action_status']))) &&
  isStrOrNull(v['certificate_url']);

const isInstructor = (v: unknown): v is ReelInstructor =>
  isObject(v) && isStr(v['id']) && isStr(v['name']);

export const isReel = (v: unknown): v is Reel =>
  isMasterclassCourse(v) &&
  isObject(v) &&
  isStr(v['course_type']) &&
  REEL_COURSE_TYPE_VALUES.includes(v['course_type']) &&
  listOf(isInstructor)(v['instructors']) &&
  isStrOrNull(v['vertical_trailer_url']) &&
  isReelChapter(v['chapter']) &&
  isUserState(v['user_state']);

/** The `reels` pagination block, as a page. */
function toPage(block: unknown, route: string): ReelFeedPage {
  if (
    isObject(block) &&
    listOf(isReel)(block['results']) &&
    isNum(block['page']) &&
    isBool(block['has_next'])
  ) {
    return { reels: block['results'], page: block['page'], hasNext: block['has_next'] };
  }
  throw contractError(route);
}

/** `parse` for `reels-feed/`: the envelope and the `reels` block. */
export function parseReelFeed(raw: unknown): ReelFeedPage {
  const data = isObject(raw) ? raw['data'] : undefined;
  return toPage(isObject(data) ? data['reels'] : undefined, 'reels-feed');
}

/** `parse` for `reels-feed/<uuid>/`: the anchor, then the feed without it. */
export function parseReelAnchor(raw: unknown): ReelAnchor {
  const data = isObject(raw) ? raw['data'] : undefined;
  const anchor = isObject(data) ? data['anchor'] : undefined;
  if (!isReel(anchor)) throw contractError('reels-feed anchor');
  return { anchor, rest: toPage(isObject(data) ? data['reels'] : undefined, 'reels-feed anchor') };
}
