import { MasterclassCourse } from '@core/models/masterclass-home.model';
import {
  contractError,
  isBool,
  isNum,
  isObject,
  isStr,
  listOf,
} from '@features/offerings/utils/contract-guards';
import { MasterclassRail } from '@features/offerings/masterclass/models/masterclass-library.model';

/**
 * Types for the filter on the masterclass page's rails (checked on UAT
 * 2026-10-27).
 *
 * Field of Study and Credit come from the cards. The cards carry no
 * instructors, additional categories or level, so those come from
 * `GET web-api/v1/masterclass/filter/`: its rows list each course's
 * instructors and additional categories, and the same read narrowed by
 * `level=<id>` lists one level's courses.
 */

// ---- Dialog ----------------------------------------------------------------

/**
 * The dialog's groups, by the shared `FilterDialog`'s keys: its `labelMap`
 * names each one. There is no Category group: the backend confirmed it is
 * Field of Study under another name.
 */
export type RailFilterGroupKey =
  'instructors' | 'fields_of_study' | 'additional_categories' | 'caira_levels' | 'cpe_credits';

export interface RailFilterOption {
  id: string;
  name: string;
}

/** A Credit option and the credit totals it holds. */
export interface RailFilterCreditBucket extends RailFilterOption {
  test: (credits: number) => boolean;
}

/** One rail's ticked options, by group. A group with none ticked is absent. */
export type RailFilterSelection = Readonly<Partial<Record<RailFilterGroupKey, readonly string[]>>>;

/** What the shared `FilterDialog` opens with: each group's options, ticked or not. */
export type RailFilterDialogData = Partial<
  Record<RailFilterGroupKey, (RailFilterOption & { selected: boolean })[]>
>;

/** A rail with its filter applied, as the page renders it. */
export interface FilteredRail extends MasterclassRail {
  /** The courses that match; `courses` stays whole for the dialog's options. */
  shown: MasterclassCourse[];
  selectedCount: number;
}

// ---- Course data -----------------------------------------------------------

/** A `filter/` row: the keys the cards lack. */
export interface FilterCourse {
  id: string;
  instructors: RailFilterOption[];
  additional_categories: RailFilterOption[];
}

/** One `filter/` answer, unwrapped. */
export interface FilterPage {
  /** The CAIRA levels, by number. */
  levels: RailFilterOption[];
  courses: FilterCourse[];
  /** More rows than one page holds (100); the rest are unread. */
  hasNext: boolean;
}

/** One level's courses, from a `filter/` read narrowed by `level`. */
export interface LevelCourses {
  levelId: string;
  courseIds: string[];
}

/** What the rails' filter knows about each course beyond its card. */
export interface CourseFilterIndex {
  instructors: ReadonlyMap<string, readonly RailFilterOption[]>;
  additionalCategories: ReadonlyMap<string, readonly RailFilterOption[]>;
  /** The CAIRA levels, by number. */
  levels: readonly RailFilterOption[];
  /** Each course's level id. */
  levelOf: ReadonlyMap<string, string>;
}

// ---- Trust boundary --------------------------------------------------------
//
// Like `masterclass-library.model.ts`: the keys read are checked, extra keys
// pass, and a missing or retyped one fails the whole answer.

const isOption = (v: unknown): v is RailFilterOption =>
  isObject(v) && isStr(v['id']) && isStr(v['name']);

const isLevel = (v: unknown): v is RailFilterOption & { number: number } =>
  isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['number']);

// Empty on every UAT row, so its rows are unseen; assumed `{ id, name }` like
// the instructors. A different shape fails here, loudly.
const isFilterCourse = (v: unknown): v is FilterCourse =>
  isObject(v) &&
  isStr(v['id']) &&
  listOf(isOption)(v['instructors']) &&
  listOf(isOption)(v['additional_categories']);

const toOption = ({ id, name }: RailFilterOption): RailFilterOption => ({ id, name });

/** `filter/`'s envelope: the level list and the rows, trimmed to what the filter reads. */
export function parseFilterPage(raw: unknown): FilterPage {
  const data = isObject(raw) ? raw['data'] : undefined;
  const filters = isObject(data) ? data['filters'] : undefined;
  const courses = isObject(data) ? data['courses'] : undefined;
  const levels = isObject(filters) ? filters['levels'] : undefined;
  const results = isObject(courses) ? courses['results'] : undefined;
  const hasNext = isObject(courses) ? courses['has_next'] : undefined;
  if (!listOf(isLevel)(levels) || !listOf(isFilterCourse)(results) || !isBool(hasNext)) {
    throw contractError('filter');
  }
  return {
    levels: [...levels].sort((a, b) => a.number - b.number).map(toOption),
    courses: results.map(({ id, instructors, additional_categories }) => ({
      id,
      instructors: instructors.map(toOption),
      additional_categories: additional_categories.map(toOption),
    })),
    hasNext,
  };
}
