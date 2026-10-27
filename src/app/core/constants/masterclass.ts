import { environment } from '@env/environment';
import { RouteConfig } from '@core/models/http.model';

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
