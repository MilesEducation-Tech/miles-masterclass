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
  /** Every course inline — there is no per-track pagination. Can be empty. */
  courses: MasterclassCourse[];
}

/** `data` of `home-page/`, unwrapped. `coming_soon` is not read yet. */
export interface MasterclassHomePage {
  login_type: MasterclassLoginType;
  tracks: MasterclassTrack[];
}

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

function isTrack(v: unknown): v is MasterclassTrack {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['slug']) &&
    isStr(v['name']) &&
    isStrOrNull(v['description']) &&
    isNum(v['priority']) &&
    listOf(isCourse)(v['courses'])
  );
}

/** Thrown from `parse`; the message names the route so the log says where. */
function contractError(route: string): Error {
  return new Error(`[masterclass] ${route} response does not match the contract.`);
}

/** `parse` for `home-page/`: the `{ success, message, data }` envelope, unwrapped. */
export function parseHomePage(raw: unknown): MasterclassHomePage {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (!isObject(data)) throw contractError('home-page');

  // Pulled into locals so each guard narrows its own value — no cast needed.
  const login_type = data['login_type'];
  const tracks = data['tracks'];

  if (isLoginType(login_type) && listOf(isTrack)(tracks)) {
    return { login_type, tracks };
  }
  throw contractError('home-page');
}
