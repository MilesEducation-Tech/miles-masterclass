import { isMasterclassCourse, MasterclassCourse } from '@core/models/masterclass-home.model';

/**
 * Types for the instructor library's read, `GET web-api/v1/masterclass/all-instructors-page/`
 * (Postman `web-masterclass-all-instructors-page-v1`, checked live on UAT 2026-10-15),
 * and the instructor page's two: `instructor-detail/<id>/` and `filter/?instructor=`.
 *
 * These are the keys the pages READ, not a mirror of the payload. A library row
 * also carries `bio`, `video_url`, `courses`, `course_count` and `created_at`,
 * and the answers carry paging metadata beyond `page` / `has_next`; none is read.
 */

// ---- Rows ------------------------------------------------------------------

/** One entry of a row's `social_media`. Only LinkedIn on UAT. */
export interface InstructorSocial {
  social_media_title: string;
  social_media_url: string;
  social_media_icon_url: string | null;
  social_media_order: number;
}

export interface InstructorRow {
  /** A UUID: the instructor page's route param. */
  id: string;
  name: string;
  designation: string | null;
  horizontal_image_url: string | null;
  vertical_image_url: string | null;
  square_image_url: string | null;
  social_media: InstructorSocial[];
}

/** A social link as the card shows it. */
export interface InstructorSocialLink {
  label: string;
  url: string;
  /** An `@ng-icons/svgl` icon for a known network, otherwise `null` and `iconUrl` is shown. */
  icon: string | null;
  iconUrl: string | null;
}

// ---- Page ------------------------------------------------------------------

/** One answer of `all-instructors-page/`, unwrapped. */
export interface InstructorLibraryPage {
  instructors: InstructorRow[];
  /** The page this answer is, 1-based. */
  page: number;
  hasNext: boolean;
}

// ---- Instructor page -------------------------------------------------------

/**
 * `instructor-detail/<id>/` (sign-in only): a library row without its courses,
 * plus the two fields only the instructor page shows. Checked against the
 * Postman export's live-captured 200 (2026-10-15).
 */
export interface InstructorProfile extends InstructorRow {
  bio: string | null;
  video_url: string | null;
}

/**
 * The `content_type` each tab sends to `filter/`. `masterclass_course` already
 * includes the AI Kit courses (`ai_kit` is a subset of it).
 */
export type InstructorContentType = 'masterclass_course' | 'podcast' | 'micro_learning';

export interface InstructorCourseTab {
  contentType: InstructorContentType;
  label: string;
}

// ---- Trust boundary --------------------------------------------------------
//
// Like `course-library.model.ts`: every key the page reads is checked, extra
// keys pass, and a missing or retyped one fails the whole answer in the
// resource's `parse`, so it lands in `error()` rather than half-rendered.

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const isInstructorSocial = (v: unknown): v is InstructorSocial =>
  isObject(v) &&
  isStr(v['social_media_title']) &&
  isStr(v['social_media_url']) &&
  isStrOrNull(v['social_media_icon_url']) &&
  isNum(v['social_media_order']);

const isInstructorRow = (v: unknown): v is InstructorRow =>
  isObject(v) &&
  isStr(v['id']) &&
  isStr(v['name']) &&
  isStrOrNull(v['designation']) &&
  isStrOrNull(v['horizontal_image_url']) &&
  isStrOrNull(v['vertical_image_url']) &&
  isStrOrNull(v['square_image_url']) &&
  Array.isArray(v['social_media']) &&
  v['social_media'].every(isInstructorSocial);

/** `parse` for `all-instructors-page/`: the envelope and one page of rows. */
export function parseInstructorLibrary(raw: unknown): InstructorLibraryPage {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (
    isObject(data) &&
    Array.isArray(data['results']) &&
    data['results'].every(isInstructorRow) &&
    isNum(data['page']) &&
    typeof data['has_next'] === 'boolean'
  ) {
    return { instructors: data['results'], page: data['page'], hasNext: data['has_next'] };
  }
  throw new Error('[library] all-instructors-page response does not match the contract.');
}

const isInstructorProfile = (v: unknown): v is InstructorProfile =>
  isObject(v) && isStrOrNull(v['bio']) && isStrOrNull(v['video_url']) && isInstructorRow(v);

/** `parse` for `instructor-detail/<id>/`: the envelope and the profile. */
export function parseInstructorProfile(raw: unknown): InstructorProfile {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isInstructorProfile(data)) return data;
  throw new Error('[library] instructor-detail response does not match the contract.');
}

/**
 * `parse` for the instructor page's `filter/` read: only the course cards, the
 * same `tracks-page/` cards the course library checks. Its filter options and
 * paging are not read: one page of 100 holds everything an instructor teaches.
 */
export function parseInstructorCourses(raw: unknown): MasterclassCourse[] {
  const data = isObject(raw) ? raw['data'] : undefined;
  const courses = isObject(data) ? data['courses'] : undefined;
  if (
    isObject(courses) &&
    Array.isArray(courses['results']) &&
    courses['results'].every(isMasterclassCourse)
  ) {
    return courses['results'];
  }
  throw new Error('[library] filter response for an instructor does not match the contract.');
}
