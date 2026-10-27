import { isMasterclassCourse, MasterclassCourse } from '@core/models/masterclass-home.model';

/**
 * Types for the course library's two reads (Postman, checked live on UAT
 * 2026-10-22):
 * - `GET web-api/v1/masterclass/filter/` (`web-masterclass-filter-v1`): the
 *   sidebar's options, from `data.filters`.
 * - `GET web-api/v1/masterclass/filter-based-masterclass-list/`
 *   (`web-masterclass-filter-based-masterclass-list-v1`): the cards, from
 *   `data.courses`. `filter/` carries the same block, which is what an AI Kit
 *   selection reads.
 *
 * These are the keys the page READS, not a mirror of the payload. Both also
 * carry `applied` (the selection, normalised) and paging metadata beyond
 * `page` / `has_next`; neither is read. Every course card is the `tracks-page/`
 * card (`MasterclassCourse`), checked with the same guard.
 */

// ---- Tabs ------------------------------------------------------------------

/**
 * The `course_type` values the tabs send to the list route. It also takes
 * `nano_learning` and `ai_lab`, which the library deliberately has no tab for.
 */
export type LibraryCourseType = 'course' | 'podcast' | 'micro_learning';

export interface CourseLibraryTab {
  courseType: LibraryCourseType;
  label: string;
}

// ---- Filters ---------------------------------------------------------------

/**
 * One filter group, keyed by the literal query param it sends. Values are
 * comma-joined: OR within a param, AND across params. Any other param is a 400.
 */
export type LibraryFilterKey =
  | 'instructor'
  | 'field_of_study'
  | 'additional_category'
  | 'level'
  | 'cpe_credit'
  | 'track'
  | 'content_type';

/** The selected values per group: the ids or values the API itself listed. */
export type LibraryFilterSelection = Readonly<Record<LibraryFilterKey, readonly string[]>>;

export interface LibraryFilterOption {
  value: string;
  label: string;
}

/** A multi-select group in the sidebar and the mobile drawer. */
export interface LibraryFilterGroup {
  key: LibraryFilterKey;
  label: string;
  options: readonly LibraryFilterOption[];
}

/**
 * `data.filters`, reduced to one option list per param. Every option the
 * catalogue offers: the API does not narrow it by the current selection.
 */
export type LibraryFilterOptions = Readonly<
  Record<LibraryFilterKey, readonly LibraryFilterOption[]>
>;

// ---- Page ------------------------------------------------------------------

/** One page of cards, from either route's `data.courses`, unwrapped. */
export interface CourseListPage {
  courses: MasterclassCourse[];
  /** The page this answer is, 1-based. */
  page: number;
  hasNext: boolean;
}

// ---- Trust boundary --------------------------------------------------------
//
// Like `masterclass-home.model.ts`: every key the page reads is checked, extra
// keys pass, and a missing or retyped one fails the whole answer in the
// resource's `parse`, so it lands in `error()` rather than half-rendered.

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** An `{ id, name }` row: instructors, fields of study, levels, tracks. */
const isNamed = (v: unknown): v is { id: string; name: string } =>
  isObject(v) && isStr(v['id']) && isStr(v['name']);

/** A `{ value, label }` row: CPE credit buckets and content types. */
const isValued = (v: unknown): v is LibraryFilterOption =>
  isObject(v) && isStr(v['value']) && isStr(v['label']);

/** The options of one group, or `null` when the list is missing or a row is off. */
function optionsOf(list: unknown, row: 'named' | 'valued'): LibraryFilterOption[] | null {
  if (!Array.isArray(list)) return null;
  if (row === 'valued')
    return list.every(isValued) ? list.map(({ value, label }) => ({ value, label })) : null;
  return list.every(isNamed) ? list.map(({ id, name }) => ({ value: id, label: name })) : null;
}

function parseFilters(v: unknown): LibraryFilterOptions | null {
  if (!isObject(v)) return null;
  const instructor = optionsOf(v['instructors'], 'named');
  const field_of_study = optionsOf(v['fields_of_study'], 'named');
  // Empty on UAT, so its rows are unseen; assumed `{ id, name }` like the
  // other id groups. A different shape fails here, loudly.
  const additional_category = optionsOf(v['additional_categories'], 'named');
  const level = optionsOf(v['levels'], 'named');
  const cpe_credit = optionsOf(v['cpe_credit'], 'valued');
  const track = optionsOf(v['tracks'], 'named');
  const content_type = optionsOf(v['content_types'], 'valued');
  if (
    !instructor ||
    !field_of_study ||
    !additional_category ||
    !level ||
    !cpe_credit ||
    !track ||
    !content_type
  ) {
    return null;
  }
  return {
    instructor,
    field_of_study,
    additional_category,
    level,
    cpe_credit,
    track,
    content_type,
  };
}

/** `parse` for the sidebar's `filter/` read: the envelope and the filter options. */
export function parseLibraryFilters(raw: unknown): LibraryFilterOptions {
  const data = isObject(raw) ? raw['data'] : undefined;
  const filters = isObject(data) ? parseFilters(data['filters']) : null;
  if (filters) return filters;
  throw new Error('[library] filter response does not match the contract.');
}

/** `parse` for the cards' read, on either route: the envelope and one page of cards. */
export function parseCourseList(raw: unknown): CourseListPage {
  const data = isObject(raw) ? raw['data'] : undefined;
  const courses = isObject(data) ? data['courses'] : undefined;
  if (
    isObject(courses) &&
    Array.isArray(courses['results']) &&
    courses['results'].every(isMasterclassCourse) &&
    isNum(courses['page']) &&
    typeof courses['has_next'] === 'boolean'
  ) {
    return {
      courses: courses['results'],
      page: courses['page'],
      hasNext: courses['has_next'],
    };
  }
  throw new Error('[library] course list response does not match the contract.');
}
