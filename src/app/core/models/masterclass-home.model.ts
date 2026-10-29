import {
  isBool,
  isNum,
  isNumOrNull,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@core/utils/contract-guards';

/**
 * Types for the web masterclass API (`web-api/v1/masterclass/`): `tracks-page/`
 * (read by `MasterclassHomeFacade` for the home page and the masterclass page),
 * and the flat course lists `highlight/` and `ai-labs/`, which serve the same
 * card.
 *
 * These are the keys those pages READ, not a mirror of the payload. The legacy
 * shapes in `masterclass.model.ts` and `course.model.ts` next door (`Content`,
 * integer ids, `course_short_overview`, `class_credits`) describe a different
 * contract and must not be mixed in here — this API addresses courses by UUID
 * and slug.
 *
 * Checked against live UAT on 2026-10-07 (`tracks-page/`, which replaced
 * `home-page/` that day with the same body). Live differs from the Postman
 * export in two places: the envelope is `{ success, message, data }` (Postman
 * shows `status: "success"`), and a field of study carries `cpe_credit`
 * (Postman shows `cpe_credits`). The live keys win. `data.is_test_user` is
 * sent and not read.
 */

// ---- Login state -----------------------------------------------------------

/**
 * The literal values the backend filters on, so there is one vocabulary end to
 * end. Required with no default: a signed-in client that forgot it must get a
 * 400, not the anonymous page as a valid 200.
 */
export type MasterclassLoginType = 'pre_login' | 'post_login';

// ---- Cards -----------------------------------------------------------------

/** Which shared-card design a course renders in; tracks alternate the two. */
export type MasterclassCardLayout = 'vertical' | 'horizontal';

export interface MasterclassThumbnails {
  horizontal: string | null;
  vertical: string | null;
  square: string | null;
}

/**
 * Which extras a course comes with. Only the flags: the AI Kit and exercise
 * files themselves are in `course-detail/`. Every card route sends it (checked
 * live on 2026-10-14: `filter/`, `highlight/`, `ai-labs/`, `tracks-page/`).
 */
export interface MasterclassAdditionalResources {
  has_exercise_files: boolean;
  has_ai_kit: boolean;
  has_ai_labs: boolean;
  has_tools: boolean;
}

export interface MasterclassFieldOfStudy {
  id: string;
  name: string;
  cpe_credit: number;
}

/** One course card, as it sits inside a track. */
export interface MasterclassCourse {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  thumbnails: MasterclassThumbnails;
  /** Was `trailer_url` until UAT renamed it on 2026-10-14 (Postman not updated yet). */
  horizontal_trailer_url: string | null;
  fields_of_study: MasterclassFieldOfStudy[];
  /** The course total, summed by the API. Render it as sent; never re-sum. */
  total_cpe_credits: number | null;
  has_individual_badge: boolean;
  included_for_caira: boolean;
  has_additional_resources: MasterclassAdditionalResources;
  /**
   * The learner's bookmark; `false` on every anonymous read. Optional because
   * `completed-course-section/` has no captured body to confirm it; every other
   * card route sends it (UAT and Postman, 2026-10-27).
   */
  is_bookmarked?: boolean;
}

/** What a bookmark is read off: a card, or the course page's course. */
export type MasterclassBookmarkable = Pick<MasterclassCourse, 'id' | 'is_bookmarked'>;

/**
 * What the course-info ("i") dialog opens with: the card the learner clicked.
 * Here, not in the dialog's feature, because the home page opens it too.
 */
export interface MasterclassCourseInfoDialogData {
  course: MasterclassCourse;
}

// ---- Home page -------------------------------------------------------------

export interface MasterclassTrack {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priority: number;
  /**
   * The track's courses, unwrapped from the API's paginated block. The page asks
   * for all of them in one call (`HOME_PAGE_LIST_PAGE_SIZE`). Can be empty.
   */
  courses: MasterclassCourse[];
}

/** `data` of `tracks-page/`, unwrapped: the tracks out of their paginated block. */
export interface MasterclassHomePage {
  login_type: MasterclassLoginType;
  tracks: MasterclassTrack[];
}

// ---- Rails -----------------------------------------------------------------

/** One rail as a page renders it. */
export interface MasterclassRail {
  /**
   * The section's element id, which the masterclass page's sidenav scrolls to.
   * Also keys the rail's filter.
   */
  id: string;
  heading: string;
  /** The line under the heading; only tracks have one. */
  subText?: string;
  courses: MasterclassCourse[];
}

/** A track as a rail, so it renders and filters like the signed-in ones. */
export const trackRail = (track: MasterclassTrack): MasterclassRail => ({
  id: `masterclass-track-${track.slug}`,
  heading: track.name,
  subText: track.description ?? '',
  courses: track.courses,
});

// ---- CAIRA levels ----------------------------------------------------------

/**
 * One rung of a programme's level ladder, from `levels/` (read by guests and
 * signed-in users alike; UAT still answers a guest 401 as of 2026-10-12).
 * Every programme's ladder comes back in one list, so `subject_name` says which
 * one a row belongs to. Checked live on UAT 2026-10-11 (signed in): three
 * CAIRA rows, `description` null on all three.
 */
export interface MasterclassLevel {
  id: string;
  /** "Level 1". */
  name: string;
  /** The level's editorial title, e.g. "AI Mindset, Skillset & Toolset". */
  level_actual_name: string | null;
  level_number: number;
  description: string | null;
  /** The level's medal artwork. */
  image_url: string | null;
  subject_name: string;
}

// ---- Wire shapes -----------------------------------------------------------

/**
 * The paginated block the API wraps every list in (live UAT since 2026-10-06):
 * the tracks and each track's courses. It also carries `count`, `page`,
 * `has_next`, `next`…; only `results` is read, because the page asks for every
 * row up front instead of paging.
 */
interface ApiPage<T> {
  results: T[];
}

/** A track as the API sends it, its courses still wrapped. */
type ApiTrack = Omit<MasterclassTrack, 'courses'> & { courses: ApiPage<MasterclassCourse> };

// ---- Trust boundary --------------------------------------------------------
//
// Hand-written, like the webinar model's: a renamed key would otherwise render
// as `undefined` with no signal. Every key the page reads is checked; EXTRA
// keys pass, because the contract adds keys without notice. A missing or
// retyped key fails the whole response, once, in the resource's `parse`, so it
// lands in `error()` rather than half-rendered on screen.

const LOGIN_TYPES: readonly unknown[] = ['pre_login', 'post_login'];
const isLoginType = (v: unknown): v is MasterclassLoginType => LOGIN_TYPES.includes(v);

/** A paginated block whose `results` all pass `guard`. A bare array is not one. */
const pageOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is ApiPage<T> =>
    isObject(v) && listOf(guard)(v['results']);

function isThumbnails(v: unknown): v is MasterclassThumbnails {
  return (
    isObject(v) &&
    isStrOrNull(v['horizontal']) &&
    isStrOrNull(v['vertical']) &&
    isStrOrNull(v['square'])
  );
}

function isAdditionalResources(v: unknown): v is MasterclassAdditionalResources {
  return (
    isObject(v) &&
    isBool(v['has_exercise_files']) &&
    isBool(v['has_ai_kit']) &&
    isBool(v['has_ai_labs']) &&
    isBool(v['has_tools'])
  );
}

function isFieldOfStudy(v: unknown): v is MasterclassFieldOfStudy {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['cpe_credit']);
}

/**
 * Exported for other `web-api/` reads that serve the same card (the course
 * library's `filter/`), so every page checks a card exactly the same way.
 */
export function isMasterclassCourse(v: unknown): v is MasterclassCourse {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['slug']) &&
    isStr(v['title']) &&
    isStrOrNull(v['short_description']) &&
    isThumbnails(v['thumbnails']) &&
    isStrOrNull(v['horizontal_trailer_url']) &&
    listOf(isFieldOfStudy)(v['fields_of_study']) &&
    isNumOrNull(v['total_cpe_credits']) &&
    isBool(v['has_individual_badge']) &&
    isBool(v['included_for_caira']) &&
    isAdditionalResources(v['has_additional_resources']) &&
    (v['is_bookmarked'] === undefined || isBool(v['is_bookmarked']))
  );
}

function isApiTrack(v: unknown): v is ApiTrack {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['slug']) &&
    isStr(v['name']) &&
    isStrOrNull(v['description']) &&
    isNum(v['priority']) &&
    pageOf(isMasterclassCourse)(v['courses'])
  );
}

function isLevel(v: unknown): v is MasterclassLevel {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStrOrNull(v['level_actual_name']) &&
    isNum(v['level_number']) &&
    isStrOrNull(v['description']) &&
    isStrOrNull(v['image_url']) &&
    isStr(v['subject_name'])
  );
}

/** `parse` for the bookmark toggle: where it landed, `data.bookmarked`. */
export function parseBookmarkToggle(raw: unknown): boolean {
  const data = isObject(raw) ? raw['data'] : undefined;
  const bookmarked = isObject(data) ? data['bookmarked'] : undefined;
  if (isBool(bookmarked)) return bookmarked;
  throw contractError('bookmark');
}

/** `parse` for `levels/`: `data` is a bare list (the ladder is not paginated). */
export function parseLevels(raw: unknown): MasterclassLevel[] {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (listOf(isLevel)(data)) return data;
  throw contractError('levels');
}

/** Rebuilt rather than spread, so the paging metadata stays at the boundary. */
function toTrack({ id, slug, name, description, priority, courses }: ApiTrack): MasterclassTrack {
  return { id, slug, name, description, priority, courses: courses.results };
}

/** Thrown from `parse`; the message names the route so the log says where. */
function contractError(route: string): Error {
  return new Error(`[masterclass] ${route} response does not match the contract.`);
}

/**
 * `parse` for `tracks-page/`: the `{ success, message, data }` envelope and the
 * paginated tracks and courses, unwrapped into plain lists.
 */
export function parseHomePage(raw: unknown): MasterclassHomePage {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('tracks-page');

  // Pulled into locals so each guard narrows its own value — no cast needed.
  const login_type = data['login_type'];
  const tracks = data['tracks'];

  if (isLoginType(login_type) && pageOf(isApiTrack)(tracks)) {
    return { login_type, tracks: tracks.results.map(toTrack) };
  }
  throw contractError('tracks-page');
}

/**
 * `parse` for a flat course list whose `data` IS the paginated block:
 * `highlight/` (the admin-pinned courses) and `ai-labs/` (every course with a
 * lab). Both serve the `tracks-page/` card, checked live on UAT 2026-10-11.
 */
export const parseCoursePage =
  (route: string) =>
  (raw: unknown): MasterclassCourse[] => {
    const data = isObject(raw) ? raw['data'] : undefined;
    if (pageOf(isMasterclassCourse)(data)) return data.results;
    throw contractError(route);
  };
