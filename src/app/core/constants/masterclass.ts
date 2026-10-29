import { environment } from '@env/environment';
import { RouteConfig } from '@core/models/http.model';
import {
  RailFilterCreditBucket,
  RailFilterGroupKey,
} from '@core/models/masterclass-rail-filter.model';

/**
 * `course_type` on the masterclass list routes: `highlight/`, `tracks-page/`
 * and `ai-labs/`.
 *
 * UAT made it required on 2026-10-13 with no contract update (Postman still
 * omits it): leaving it out is a 400 `invalid_query`, "Field required". It
 * takes `course`, `podcast`, `nano_learning` or `micro_learning`, and a
 * masterclass is a `course` (`course_type` on `course-detail/` says so too).
 */
export const MASTERCLASS_COURSE_TYPE = 'course';

/**
 * `IsAuthenticated`, no body: toggles the learner's bookmark on one course
 * (`:id` is its UUID) and answers where it landed, `data.bookmarked`. A toggle,
 * not a set, so a double tap corrects itself. 404 for an unknown course.
 * Postman `web-masterclass-bookmark-v1`.
 */
export const MASTERCLASS_BOOKMARK_ROUTE = {
  path: `${environment.API.baseUrl}web-api/v1/masterclass/bookmark/:id/`,
  method: 'POST',
} as RouteConfig<void, unknown>;

/** The toasts after a card's bookmark toggle; the message is the course title. */
export const MASTERCLASS_BOOKMARK_TOASTS = {
  added: 'Added to My List',
  removed: 'Removed from My List',
  failed: { title: 'Bookmark not saved', message: 'Please try again.' },
} as const;

/** Rows asked for per rail: every course in one read, as the track rails do (the API's ceiling). */
export const RAIL_PAGE_SIZE = 100;

/**
 * The rails' filter read: each masterclass's instructors and additional
 * categories, which the cards lack, and the CAIRA levels. Public; it answers
 * `login_type` with a 400.
 */
export const MASTERCLASS_FILTER_ROUTE = {
  path: `${environment.API.baseUrl}web-api/v1/masterclass/filter/`,
  method: 'GET',
} as RouteConfig<
  void,
  unknown,
  Record<string, string>,
  { content_type: string; page_size: number; level?: string }
>;

/** Every masterclass in one page (64 on UAT); add `level` for one level's. */
export const MASTERCLASS_FILTER_PARAMS = {
  content_type: 'masterclass_course',
  page_size: RAIL_PAGE_SIZE,
} as const;

/** The filter dialog's groups, in order. */
export const RAIL_FILTER_GROUPS: readonly RailFilterGroupKey[] = [
  'instructors',
  'fields_of_study',
  'additional_categories',
  'caira_levels',
  'cpe_credits',
];

/** The Credit group, on the server's `cpe_credit` boundaries: `2_to_5` holds 2. */
export const RAIL_FILTER_CREDIT_BUCKETS: readonly RailFilterCreditBucket[] = [
  { id: 'lt_2', name: 'Less than 2 credits', test: (credits) => credits < 2 },
  { id: '2_to_5', name: '2 to 5 credits', test: (credits) => credits >= 2 && credits <= 5 },
  { id: 'gt_5', name: 'Greater than 5 credits', test: (credits) => credits > 5 },
];

/** In a rail's place when its filter matches none of its courses. */
export const RAIL_FILTER_EMPTY = 'No courses match these filters.';
