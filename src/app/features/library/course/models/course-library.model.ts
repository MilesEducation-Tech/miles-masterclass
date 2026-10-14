import { isMasterclassCourse, MasterclassCourse } from '@core/models/masterclass-home.model';

/**
 * Types for the course library's one read, `GET web-api/v1/masterclass/filter/`
 * (Postman `web-masterclass-filter-v1`, checked live on UAT 2026-10-14).
 *
 * These are the keys the page READS, not a mirror of the payload. The response
 * also carries `applied` (the selection, normalised) and paging metadata beyond
 * `page` / `has_next`; neither is read. Every course card is the `tracks-page/`
 * card (`MasterclassCourse`), checked with the same guard.
 */

// ---- Tabs ------------------------------------------------------------------

/**
 * The `course_type` values the tabs send. The API also takes `nano_learning`,
 * which the library deliberately has no tab for.
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

/** One answer of `filter/`, unwrapped. */
export interface CourseLibraryPage {
  filters: LibraryFilterOptions;
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

/** `parse` for `filter/`: the envelope, the filter options and one page of cards. */
export function parseCourseLibrary(raw: unknown): CourseLibraryPage {
  const data = isObject(raw) ? raw['data'] : undefined;
  const filters = isObject(data) ? parseFilters(data['filters']) : null;
  const courses = isObject(data) ? data['courses'] : undefined;
  if (
    filters &&
    isObject(courses) &&
    Array.isArray(courses['results']) &&
    courses['results'].every(isMasterclassCourse) &&
    isNum(courses['page']) &&
    typeof courses['has_next'] === 'boolean'
  ) {
    return {
      filters,
      courses: courses['results'],
      page: courses['page'],
      hasNext: courses['has_next'],
    };
  }
  throw new Error('[library] filter response does not match the contract.');
}

// ---- AI Kit ----------------------------------------------------------------

/** An openable extra from `course-detail/`: the AI Kit PDF or an exercise file. */
export interface CourseResource {
  name: string;
  url: string;
  description: string | null;
}

/** What the AI Kit button opens: the kit first, then the exercise files in their order. */
export interface CourseResources {
  aiKit: CourseResource | null;
  exerciseFiles: CourseResource[];
}

const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);

/** `ai_kit {id, name, description, icon_url, url}`; a kit with no url has nothing to open. */
function toKit(v: unknown): CourseResource | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isStr(v['name']) || !isStrOrNull(v['url'])) return undefined;
  const description = v['description'];
  if (!isStrOrNull(description)) return undefined;
  return v['url'] ? { name: v['name'], url: v['url'], description } : null;
}

const isExerciseFile = (v: unknown): v is { name: string; url: string; order: number } =>
  isObject(v) && isStr(v['name']) && isStr(v['url']) && isNum(v['order']);

/**
 * `parse` for the AI Kit button's read, `course-detail/{id}/`: only
 * `data.course_details.miscellaneous_data`. `tools` has no link and is not read.
 */
export function parseCourseResources(raw: unknown): CourseResources {
  const data = isObject(raw) ? raw['data'] : undefined;
  const details = isObject(data) ? data['course_details'] : undefined;
  const misc = isObject(details) ? details['miscellaneous_data'] : undefined;
  const aiKit = isObject(misc) ? toKit(misc['ai_kit']) : undefined;
  const files = isObject(misc) ? misc['exercise_files'] : undefined;
  if (
    aiKit !== undefined &&
    (files === null || (Array.isArray(files) && files.every(isExerciseFile)))
  ) {
    const exerciseFiles = [...(files ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(({ name, url }) => ({ name, url, description: null }));
    return { aiKit, exerciseFiles };
  }
  throw new Error('[library] course-detail resources do not match the contract.');
}
