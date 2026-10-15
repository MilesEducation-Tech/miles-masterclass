/**
 * Types for the instructor library's read, `GET web-api/v1/masterclass/all-instructors-page/`
 * (Postman `web-masterclass-all-instructors-page-v1`, checked live on UAT 2026-10-15).
 *
 * These are the keys the library READS, not a mirror of the payload. A row also
 * carries `bio`, `video_url`, `courses`, `course_count` and `created_at`, and the
 * answer carries paging metadata beyond `page` / `has_next`; none is read here.
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
