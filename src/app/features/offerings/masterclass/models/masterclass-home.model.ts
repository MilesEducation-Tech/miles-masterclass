/**
 * Types for the web masterclass API (`web-api/v1/masterclass/`).
 *
 * These are the keys the masterclass page READS, not a mirror of the payload.
 * The legacy shapes in `@core/models/course.model.ts` (`Content`, integer ids,
 * `course_short_overview`, `class_credits`) describe a different contract and
 * must not be mixed in here — this API addresses courses by UUID and slug.
 *
 * Checked against live UAT on 2026-10-05, which differs from the 2026-09-30
 * Postman export in two places: the envelope is `{ success, message, data }`
 * (Postman shows `status: "success"`), and a field of study carries
 * `cpe_credit` (Postman shows `cpe_credits`). The live keys win.
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
  trailer_url: string | null;
  fields_of_study: MasterclassFieldOfStudy[];
  /** The course total, summed by the API. Render it as sent; never re-sum. */
  total_cpe_credits: number | null;
  has_individual_badge: boolean;
  included_for_caira: boolean;
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
   * for all of them in one call (`HOME_PAGE_COURSES_PER_TRACK`). Can be empty.
   */
  courses: MasterclassCourse[];
}

/** `data` of `home-page/`, unwrapped. `coming_soon` is not read yet. */
export interface MasterclassHomePage {
  login_type: MasterclassLoginType;
  tracks: MasterclassTrack[];
}

// ---- Wire shapes -----------------------------------------------------------

/**
 * The paginated block the API wraps every list in (live UAT since 2026-10-06):
 * the tracks, each track's courses, and `coming_soon`. It also carries `count`,
 * `page`, `has_next`, `next`…; only `results` is read, because the page asks
 * for every course up front instead of paging.
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

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

const LOGIN_TYPES: readonly unknown[] = ['pre_login', 'post_login'];
const isLoginType = (v: unknown): v is MasterclassLoginType => LOGIN_TYPES.includes(v);

const listOf =
  <T>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T[] =>
    Array.isArray(v) && v.every(guard);

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

function isFieldOfStudy(v: unknown): v is MasterclassFieldOfStudy {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['cpe_credit']);
}

function isCourse(v: unknown): v is MasterclassCourse {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['slug']) &&
    isStr(v['title']) &&
    isStrOrNull(v['short_description']) &&
    isThumbnails(v['thumbnails']) &&
    isStrOrNull(v['trailer_url']) &&
    listOf(isFieldOfStudy)(v['fields_of_study']) &&
    isNumOrNull(v['total_cpe_credits']) &&
    isBool(v['has_individual_badge']) &&
    isBool(v['included_for_caira'])
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
    pageOf(isCourse)(v['courses'])
  );
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
 * `parse` for `home-page/`: the `{ success, message, data }` envelope and the
 * paginated tracks and courses, unwrapped into plain lists.
 */
export function parseHomePage(raw: unknown): MasterclassHomePage {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('home-page');

  // Pulled into locals so each guard narrows its own value — no cast needed.
  const login_type = data['login_type'];
  const tracks = data['tracks'];

  if (isLoginType(login_type) && pageOf(isApiTrack)(tracks)) {
    return { login_type, tracks: tracks.results.map(toTrack) };
  }
  throw contractError('home-page');
}
