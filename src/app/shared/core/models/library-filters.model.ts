import { FeatureApiKey } from './feature.model';

export interface NamedOption {
  id: number;
  name: string;
}

export interface KeyedOption {
  key: string;
  label: string;
}

export interface LibraryFiltersData {
  instructors: NamedOption[];
  categories: NamedOption[];
  fields_of_study: NamedOption[];
  additional_categories: NamedOption[];
  caira_levels: NamedOption[];
  cpe_credits: KeyedOption[];
  /**
   * `tracks` is returned by the `/library-filters/` endpoint but **not** by the
   * carousel-scoped `/v2/filters/` endpoint (which already receives a track_id
   * input). Treat as optional so a single model serves both.
   */
  tracks?: NamedOption[];
}

/**
 * snake_case keys sent as the `section` query param to `GET /v2/filters/`.
 * These map to the carousel sections that have server-driven filter support.
 */
export type SectionApiKey =
  | 'track'
  | 'highlight'
  | 'popular'
  | 'latest'
  | 'newly_added'
  | 'coming_soon'
  | 'complimentary'
  | 'recommended';

/**
 * Map the internal camelCase FeatureApiKey to the snake_case section param.
 * Keys absent from this map have **no** server filter support — the carousel
 * falls back to client-side filter extraction from rendered cards.
 */
export const FEATURE_KEY_TO_SECTION: Partial<Record<FeatureApiKey, SectionApiKey>> = {
  track: 'track',
  popular: 'popular',
  comingSoon: 'coming_soon',
  recommended: 'recommended',
  complimentary: 'complimentary',
  highlight: 'highlight',
  latest: 'latest',
  newlyAdded: 'newly_added',
};

/**
 * Query-param keys sent to `v2/library/`. The keys are used as both the
 * accordion section id (in the UI) and the literal HTTP param name in the
 * request. Backend conventions:
 * - `*_ids` for id-based groups (instructor, category, etc.)
 * - `caira_levels` (plural, no `_ids` suffix)
 * - `cpe_range` for the cpe_credits buckets (`lt_2`, `2_5`, `gt_5`)
 * - `track_ids` for tracks (assumed; not explicitly in the param spec)
 *
 * Backend may rename — adjust here only.
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

/** Selected values, keyed by group. Numbers for id-based groups, strings for `cpe_range`. */
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

/** Subset of `LibraryFiltersData` keys that the carousel UI groups expose. */
export type SectionFilterGroupKey =
  | 'instructors'
  | 'categories'
  | 'fields_of_study'
  | 'additional_categories'
  | 'caira_levels'
  | 'cpe_credits';

/** Maps a `SectionFilterGroupKey` (response shape) to its `CourseFilterKey` (request param). */
export const GROUP_TO_FILTER_KEY: Record<SectionFilterGroupKey, CourseFilterKey> = {
  instructors: 'instructor_ids',
  categories: 'category_ids',
  fields_of_study: 'field_of_study_ids',
  additional_categories: 'additional_category_ids',
  caira_levels: 'caira_levels',
  cpe_credits: 'cpe_range',
};

/** Reverse of `GROUP_TO_FILTER_KEY` — derived once, reused at runtime. */
export const FILTER_KEY_TO_GROUP: Partial<Record<CourseFilterKey, SectionFilterGroupKey>> =
  Object.fromEntries(Object.entries(GROUP_TO_FILTER_KEY).map(([g, k]) => [k, g])) as Partial<
    Record<CourseFilterKey, SectionFilterGroupKey>
  >;

/** A single multi-select group rendered in the sidebar. */
export interface CourseFilterGroup {
  /** Stable key used as both the accordion section id and the query-param name. */
  key: CourseFilterKey;
  label: string;
  options: readonly { value: string | number; label: string }[];
}

/**
 * Course type tokens sent to backend APIs. Note both `micro_learning` (used by
 * `v2/library/`) and `nano_learning` (used by `v2/filters/` and other newer
 * endpoints) are valid — they refer to the same content type but back different
 * code paths. See AGENT.md §9.
 */
export type ApiCourseType = 'masterclass' | 'podcast' | 'micro_learning' | 'nano_learning';

export interface CourseTypeTab {
  /** Sent to `v2/library/?type=`. */
  apiType: ApiCourseType;
  /** Slug used by `Utils.navigateToCourse` and `app-vertical`'s `type` input. */
  routeType: 'masterclass' | 'podcast' | 'micro-learning';
  label: string;
}

/**
 * `COURSE_TYPE_TABS` predates the `nano_learning` token and intentionally lists
 * only `micro_learning` for the micro-learning slot — the `v2/library/`
 * endpoint that consumes this list expects `micro_learning`. The newer
 * `nano_learning` token is used by other endpoints (e.g. `v2/filters/`) and is
 * not a separate tab. If you iterate `COURSE_TYPE_TABS` to populate UI,
 * remember it's deliberately a strict subset of `ApiCourseType`.
 */
export const COURSE_TYPE_TABS: readonly CourseTypeTab[] = [
  { apiType: 'masterclass', routeType: 'masterclass', label: 'Master Class' },
  { apiType: 'podcast', routeType: 'podcast', label: 'Podcast' },
  { apiType: 'micro_learning', routeType: 'micro-learning', label: 'Micro Learning' },
] as const;

// ---------------------------------------------------------------------------
// Filter <-> dialog <-> query-param helpers.
// Kept in this file alongside the contract types so any future consumer
// (carousel, library sidebar, drawer, …) hits one source of truth.
// ---------------------------------------------------------------------------

/**
 * Convert a `/v2/filters/` response into the `Record<string, any[]>` shape the
 * shared `FilterDialog` consumes. Each item carries `{id, name, selected}`.
 * Options whose ids appear in `prior` are pre-checked so re-opening the dialog
 * preserves the user's last selection.
 */
export function apiDataToDialogShape(
  data: LibraryFiltersData,
  prior: CourseFilterSelection | null,
): Record<string, { id: string | number; name: string; selected: boolean }[]> {
  const result: Record<string, { id: string | number; name: string; selected: boolean }[]> = {};
  for (const [group, filterKey] of Object.entries(GROUP_TO_FILTER_KEY) as [
    SectionFilterGroupKey,
    CourseFilterKey,
  ][]) {
    const items = data[group];
    if (!items || items.length === 0) continue;
    const selectedIds = new Set((prior?.[filterKey] ?? []).map(String));
    if (group === 'cpe_credits') {
      result[group] = (items as KeyedOption[]).map((o) => ({
        id: o.key,
        name: o.label,
        selected: selectedIds.has(String(o.key)),
      }));
    } else {
      result[group] = (items as NamedOption[]).map((o) => ({
        id: o.id,
        name: o.name,
        selected: selectedIds.has(String(o.id)),
      }));
    }
  }
  return result;
}

/**
 * Reverse of {@link apiDataToDialogShape}. Walks a group-keyed dialog result
 * (e.g. `instructors`) and produces a `CourseFilterSelection` (filter-key
 * keyed, e.g. `instructor_ids`) ready to send as query params.
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

/** True when every group in a `CourseFilterSelection` is empty. */
export function isEmptySelection(s: CourseFilterSelection): boolean {
  return Object.values(s).every((v) => !Array.isArray(v) || v.length === 0);
}

/**
 * Compare two `CourseFilterSelection` values for set-equality (order-insensitive).
 * Used to short-circuit no-op apply-clicks before they hit the network.
 */
export function selectionsEqual(
  a: CourseFilterSelection | undefined,
  b: CourseFilterSelection | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  for (const key of Object.keys(EMPTY_COURSE_FILTERS) as CourseFilterKey[]) {
    const av = a[key] ?? [];
    const bv = b[key] ?? [];
    if (av.length !== bv.length) return false;
    if (av.length === 0) continue;
    const set = new Set(av.map(String));
    for (const v of bv) if (!set.has(String(v))) return false;
  }
  return true;
}

/**
 * Serialize a `CourseFilterSelection` into query-string-friendly comma-joined
 * values, mutating `params` in place. Empty groups are skipped, so the URL
 * stays clean when no filter is active.
 */
export function appendFilterParams(
  params: Record<string, any>,
  filters: CourseFilterSelection | undefined,
): void {
  if (!filters) return;
  for (const [k, vals] of Object.entries(filters)) {
    if (Array.isArray(vals) && vals.length) {
      params[k] = vals.join(',');
    }
  }
}
