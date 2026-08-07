/**
 * Filter-dialog selection logic for the carousel — interaction design, not
 * transport. Lifted out of the deleted `library-filters.model.ts` during the
 * Django strip: the `/v2/filters/` response types went, the dialog↔selection
 * mapping stayed, because it is what makes the filter chips and the apply/clear
 * behaviour work.
 *
 * The group keys below are the UI's own filter vocabulary. Remap them if the
 * new backend names its filter groups differently.
 */

export type CourseFilterKey =
  | 'instructor_ids'
  | 'category_ids'
  | 'field_of_study_ids'
  | 'additional_category_ids'
  | 'caira_levels'
  | 'cpe_range'
  | 'track_ids'
  | 'included_for_caira'
  | 'ai_library';

export type CourseFilterSelection = Record<CourseFilterKey, readonly (string | number)[]>;

export const EMPTY_COURSE_FILTERS: CourseFilterSelection = {
  instructor_ids: [],
  category_ids: [],
  field_of_study_ids: [],
  additional_category_ids: [],
  caira_levels: [],
  cpe_range: [],
  track_ids: [],
  included_for_caira: [],
  ai_library: [],
};

/** Subset of filter groups the carousel UI exposes. */
export type SectionFilterGroupKey =
  | 'instructors'
  | 'categories'
  | 'fields_of_study'
  | 'additional_categories'
  | 'caira_levels'
  | 'cpe_credits';

/** Maps a display group to the filter key sent as a query param. */
export const GROUP_TO_FILTER_KEY: Record<SectionFilterGroupKey, CourseFilterKey> = {
  instructors: 'instructor_ids',
  categories: 'category_ids',
  fields_of_study: 'field_of_study_ids',
  additional_categories: 'additional_category_ids',
  caira_levels: 'caira_levels',
  cpe_credits: 'cpe_range',
};

/** True when every group in a selection is empty. */
export function isEmptySelection(s: CourseFilterSelection | null | undefined): boolean {
  if (!s) return true;
  return Object.values(s).every((v) => !Array.isArray(v) || v.length === 0);
}

/**
 * Walk a group-keyed dialog result (e.g. `instructors`) and produce a
 * `CourseFilterSelection` (filter-key keyed, e.g. `instructor_ids`).
 */
export function dialogShapeToSelection(result: Record<string, any[]>): CourseFilterSelection {
  const selection: Record<CourseFilterKey, readonly (string | number)[]> = {
    ...EMPTY_COURSE_FILTERS,
  };
  const groupToFilter = GROUP_TO_FILTER_KEY as Record<string, CourseFilterKey | undefined>;
  for (const [group, items] of Object.entries(result)) {
    const filterKey = groupToFilter[group];
    if (!filterKey || !Array.isArray(items)) continue;
    selection[filterKey] = items
      .filter((it: any) => it && it.selected)
      .map((it: any) => (typeof it.id === 'number' ? it.id : String(it.id)));
  }
  return selection;
}

/**
 * ponytail: the inverse adapter — it turned a `/v2/filters/` response into the
 * dialog's `{id, name, selected}[]` shape, pre-checking whatever was already
 * applied. It encoded that endpoint's response layout, so it went with the
 * backend. Rebuild it against the new filters endpoint; `dialogShapeToSelection`
 * above consumes whatever it produces.
 */
export function apiDataToDialogShape(
  _data: unknown,
  _prior: CourseFilterSelection | null,
): Record<string, { id: string | number; name: string; selected: boolean }[]> {
  return {};
}
