import { RAIL_FILTER_CREDIT_BUCKETS, RAIL_FILTER_GROUPS } from '@core/constants/masterclass';
import { MasterclassCourse } from '@core/models/masterclass-home.model';
import {
  CourseFilterIndex,
  FilterPage,
  LevelCourses,
  RailFilterDialogData,
  RailFilterGroupKey,
  RailFilterOption,
  RailFilterSelection,
} from '@core/models/masterclass-rail-filter.model';
import { isObject, isStr } from '@core/utils/contract-guards';

/**
 * The rails' filter, as plain functions over a rail's courses: the dialog's
 * options, and whether a course matches a selection. `index` is null until the
 * `filter/` reads succeed; the groups only they supply are then empty.
 */

/** One course's options in one group. */
function courseOptions(
  course: MasterclassCourse,
  group: RailFilterGroupKey,
  index: CourseFilterIndex | null,
): readonly RailFilterOption[] {
  switch (group) {
    case 'instructors':
      return index?.instructors.get(course.id) ?? [];
    case 'fields_of_study':
      return course.fields_of_study;
    case 'additional_categories':
      return index?.additionalCategories.get(course.id) ?? [];
    case 'caira_levels': {
      const levelId = index?.levelOf.get(course.id);
      return index?.levels.filter((level) => level.id === levelId) ?? [];
    }
    case 'cpe_credits': {
      const credits = course.total_cpe_credits;
      return credits === null ? [] : RAIL_FILTER_CREDIT_BUCKETS.filter((b) => b.test(credits));
    }
  }
}

/** A group's options across the rail: levels by number, credits low to high, the rest A–Z. */
function groupOptions(
  courses: readonly MasterclassCourse[],
  group: RailFilterGroupKey,
  index: CourseFilterIndex | null,
): RailFilterOption[] {
  const found = new Map<string, RailFilterOption>();
  for (const course of courses) {
    for (const { id, name } of courseOptions(course, group, index)) found.set(id, { id, name });
  }
  switch (group) {
    case 'caira_levels':
      return (index?.levels ?? []).filter((level) => found.has(level.id));
    case 'cpe_credits':
      return RAIL_FILTER_CREDIT_BUCKETS.filter((b) => found.has(b.id)).map(({ id, name }) => ({
        id,
        name,
      }));
    default:
      return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** The dialog's data for one rail: only its courses' options; an empty group is left out. */
export function railFilterOptions(
  courses: readonly MasterclassCourse[],
  index: CourseFilterIndex | null,
  selection: RailFilterSelection,
): RailFilterDialogData {
  const data: RailFilterDialogData = {};
  for (const group of RAIL_FILTER_GROUPS) {
    const options = groupOptions(courses, group, index);
    const ticked = selection[group] ?? [];
    if (options.length) {
      data[group] = options.map((option) => ({ ...option, selected: ticked.includes(option.id) }));
    }
  }
  return data;
}

/** Any ticked option within a group, and every group with a tick. */
export function matchesSelection(
  course: MasterclassCourse,
  selection: RailFilterSelection,
  index: CourseFilterIndex | null,
): boolean {
  return RAIL_FILTER_GROUPS.every((group) => {
    const ticked = selection[group];
    if (!ticked?.length) return true;
    return courseOptions(course, group, index).some((option) => ticked.includes(option.id));
  });
}

export const selectedCount = (selection: RailFilterSelection): number =>
  RAIL_FILTER_GROUPS.reduce((count, group) => count + (selection[group]?.length ?? 0), 0);

const isTicked = (v: unknown): v is { id: string } =>
  isObject(v) && v['selected'] === true && isStr(v['id']);

/**
 * The shared dialog's result, read back into a selection: it closes with its
 * untyped data, every option flagged, or with nothing when dismissed (null).
 */
export function selectionFromDialog(result: unknown): RailFilterSelection | null {
  if (!isObject(result)) return null;
  const selection: Partial<Record<RailFilterGroupKey, string[]>> = {};
  for (const group of RAIL_FILTER_GROUPS) {
    const options = result[group];
    const ticked = Array.isArray(options) ? options.filter(isTicked).map((o) => o.id) : [];
    if (ticked.length) selection[group] = ticked;
  }
  return selection;
}

/** Each course's instructors, additional categories and level, from the `filter/` reads. */
export function buildFilterIndex(
  page: FilterPage,
  levelCourses: readonly LevelCourses[],
): CourseFilterIndex {
  return {
    instructors: new Map(
      page.courses.map((c): [string, RailFilterOption[]] => [c.id, c.instructors]),
    ),
    additionalCategories: new Map(
      page.courses.map((c): [string, RailFilterOption[]] => [c.id, c.additional_categories]),
    ),
    levels: page.levels,
    levelOf: new Map(
      levelCourses.flatMap(({ levelId, courseIds }) =>
        courseIds.map((id): [string, string] => [id, levelId]),
      ),
    ),
  };
}
