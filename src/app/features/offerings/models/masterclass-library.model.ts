import { isMasterclassCourse, MasterclassCourse } from '@core/models/masterclass-home.model';
import {
  contractError,
  isBool,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@core/utils/contract-guards';

/**
 * Types for an offering landing page's signed-in rails (Postman, checked on UAT
 * 2026-10-26). Offerings-level since MIL-179: every course type is served by
 * the same `web-api/v1/masterclass/` routes, narrowed by `course_type`, so the
 * names keep the API's `masterclass` namespace.
 * - `GET web-api/v1/masterclass/library/` (`web-masterclass-library-v1`):
 *   every learner rail in one read, each its own pagination block.
 * - `GET web-api/v1/masterclass/completed-course-section/`
 *   (`web-masterclass-completed-course-section-v1`): the courses the learner
 *   has closed.
 * - `GET web-api/v1/masterclass/reels-activity/`
 *   (`web-masterclass-reels-activity-v1`, checked on UAT 2026-11-12): the
 *   reels' learner rails, in place of the two above: Continue Watching, My
 *   List and the mastered reels.
 * - `GET web-api/v1/masterclass/coming-soon/` (`web-masterclass-coming-soon-v1`,
 *   checked on UAT 2026-10-27): the teasers, which are not courses yet. Each
 *   row carries the learner's `notify_me` since 2026-10-28.
 * - `POST api/v1/masterclass/coming-soon/<id>/notify-me/`
 *   (`masterclass-coming-soon-notify-me-v1`): a card's Remind Me.
 *
 * These are the keys the page READS, not a mirror of the payload: `library/`
 * also carries `popular` and `latest` (the hero reads `highlight/` instead),
 * and both carry paging metadata beyond `results`. Every card is the
 * `tracks-page/` card (`MasterclassCourse`), checked with the same guard.
 */

// ---- Offerings -------------------------------------------------------------

/**
 * `course_type` on the web masterclass list routes, as the contract lists it
 * (Postman `web-masterclass-library-v1`). A masterclass is a `course`.
 */
export type WebCourseType = 'course' | 'podcast' | 'nano_learning' | 'micro_learning';

/**
 * The offerings `MasterclassLibraryFacade` serves: those whose landing page
 * shows the learner rails. An offering joins by adding its `LIBRARY_OFFERINGS`
 * entry.
 */
export type LibraryOffering = 'masterclass' | 'podcast' | 'reels';

/**
 * Where an offering's signed-in rails come from: `library/` plus
 * `completed-course-section/` (masterclass, podcast), or `reels-activity/`,
 * the reels' own read of Continue Watching, My List and the mastered reels.
 */
export type LearnerRowsSource = 'library' | 'reels-activity';

/** What differs per offering on its landing page's rails. */
export interface LibraryOfferingConfig {
  /**
   * Narrows every list read and My List, sent comma-joined as `course_type`:
   * reels are two course types (`nano_learning`, `micro_learning`).
   */
  courseTypes: readonly WebCourseType[];
  /**
   * Whether the facade reads the offering's `tracks-page/` itself. Masterclass
   * does not: its tracks come from the root `MasterclassHomeFacade`, which the
   * home page shares.
   */
  ownTracks: boolean;
  learnerRows: LearnerRowsSource;
}

// ---- Rails -----------------------------------------------------------------

/** The `library/` rails the page shows, by their response keys. */
export type LibraryRailKey =
  'in_progress' | 'recommended' | 'complimentary' | 'because_you_watched' | 'bookmarked';

/**
 * A `library/` card: the track rails' card plus its `course_type`, which My
 * List needs because `bookmarked` is not narrowed by the request's
 * `course_type`.
 */
export type LibraryCourse = MasterclassCourse & { course_type: string };

/** One answer of `library/`, unwrapped. */
export interface MasterclassLibrary {
  /** The learner's firm, for the Complimentary heading; `null` when there is none. */
  companyName: string | null;
  rails: Readonly<Record<LibraryRailKey, LibraryCourse[]>>;
}

/**
 * A `coming-soon/` row: a teaser, not a course yet (`course-detail/` answers
 * 404 for its id), so it has no link and no bookmark. These are the keys the
 * rail reads; it also sends `slug`, `priority` (the order it comes in) and
 * `fields_of_study`.
 */
export interface MasterclassComingSoonCourse {
  id: string;
  name: string;
  thumbnail_url: string | null;
  trailer_url: string | null;
  /** The learner's reminder for it; `false` signed out. */
  notify_me: boolean;
}

/** A rail above the tracks: the `library/` rail it reads, its section id and heading. */
export interface LibraryRailConfig {
  key: LibraryRailKey;
  id: string;
  heading: string;
}

/** The `reels-activity/` rails, by their response keys. */
export type ReelsActivityRailKey = 'continue_watching' | 'my_list' | 'mastered';

/**
 * One answer of `reels-activity/`, unwrapped: each rail's reels. Already
 * narrowed by the request's `course_type`, unlike `library/`'s `bookmarked`.
 * A row is the reel feed's item (the card plus `chapter` and `user_state`);
 * the landing page reads its card.
 */
export type ReelsActivity = Readonly<Record<ReelsActivityRailKey, LibraryCourse[]>>;

/** A `reels-activity/` rail on the page: the key it reads, its section id and heading. */
export interface ReelsActivityRailConfig {
  key: ReelsActivityRailKey;
  id: string;
  heading: string;
}

// ---- Trust boundary --------------------------------------------------------
//
// Like `masterclass-home.model.ts`: every key the page reads is checked, extra
// keys pass, and a missing or retyped one fails the whole answer in the
// resource's `parse`, so it lands in `error()` rather than half-rendered.

const isLibraryCourse = (v: unknown): v is LibraryCourse =>
  isMasterclassCourse(v) && isObject(v) && isStr(v['course_type']);

const isComingSoonCourse = (v: unknown): v is MasterclassComingSoonCourse =>
  isObject(v) &&
  isStr(v['id']) &&
  isStr(v['name']) &&
  isStrOrNull(v['thumbnail_url']) &&
  isStrOrNull(v['trailer_url']) &&
  isBool(v['notify_me']);

/** A pagination block whose `results` all pass `guard`. */
const blockOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is { results: T[] } =>
    isObject(v) && listOf(guard)(v['results']);

/** `parse` for `library/`: the envelope, the firm and the five learner rails. */
export function parseMasterclassLibrary(raw: unknown): MasterclassLibrary {
  const data = isObject(raw) ? raw['data'] : undefined;
  const companyName = isObject(data) ? data['company_name'] : undefined;
  if (!isObject(data) || !isStrOrNull(companyName)) throw contractError('library');

  const rail = (key: LibraryRailKey): LibraryCourse[] => {
    const block = data[key];
    if (blockOf(isLibraryCourse)(block)) return block.results;
    throw contractError('library');
  };

  return {
    companyName,
    rails: {
      in_progress: rail('in_progress'),
      recommended: rail('recommended'),
      complimentary: rail('complimentary'),
      because_you_watched: rail('because_you_watched'),
      bookmarked: rail('bookmarked'),
    },
  };
}

/** `parse` for `reels-activity/`: the envelope and the three learner rails. */
export function parseReelsActivity(raw: unknown): ReelsActivity {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('reels-activity');

  const rail = (key: ReelsActivityRailKey): LibraryCourse[] => {
    const block = data[key];
    if (blockOf(isLibraryCourse)(block)) return block.results;
    throw contractError('reels-activity');
  };

  return {
    continue_watching: rail('continue_watching'),
    my_list: rail('my_list'),
    mastered: rail('mastered'),
  };
}

/** `parse` for `completed-course-section/`: `data.all_courses`, a block of cards. */
export function parseCompletedSection(raw: unknown): MasterclassCourse[] {
  const data = isObject(raw) ? raw['data'] : undefined;
  const block = isObject(data) ? data['all_courses'] : undefined;
  if (blockOf(isMasterclassCourse)(block)) return block.results;
  throw contractError('completed-course-section');
}

/** `parse` for `coming-soon/`: `data` is the one pagination block. */
export function parseComingSoon(raw: unknown): MasterclassComingSoonCourse[] {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (blockOf(isComingSoonCourse)(data)) return data.results;
  throw contractError('coming-soon');
}

/** The notify-me answer: where the reminder landed, `data.notify_me` (200 and 201 alike). */
export function parseNotifyMe(raw: unknown): boolean {
  const data = isObject(raw) ? raw['data'] : undefined;
  const notifyMe = isObject(data) ? data['notify_me'] : undefined;
  if (isBool(notifyMe)) return notifyMe;
  throw contractError('coming-soon notify-me');
}
