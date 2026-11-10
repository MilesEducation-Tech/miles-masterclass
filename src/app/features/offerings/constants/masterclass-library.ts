import { environment } from '@env/environment';
import { MASTERCLASS_COURSE_TYPE, RAIL_PAGE_SIZE } from '@core/constants/masterclass';
import { RouteConfig } from '@core/models/http.model';
import { MasterclassHomePage } from '@core/models/masterclass-home.model';
import {
  LibraryOffering,
  LibraryOfferingConfig,
  LibraryRailConfig,
} from '@features/offerings/models/masterclass-library.model';

/**
 * `MasterclassLibraryFacade`'s settings, per offering. The routes are the same
 * for every course type; `course_type` narrows them.
 */
export const LIBRARY_OFFERINGS: Readonly<Record<LibraryOffering, LibraryOfferingConfig>> = {
  masterclass: { courseType: MASTERCLASS_COURSE_TYPE, ownTracks: false },
  // A podcast is a course with `course_type: "podcast"` (UAT, 2026-11-10).
  podcast: { courseType: 'podcast', ownTracks: true },
};

/**
 * `tracks-page/`'s list sizes for an offering that reads its own tracks: every
 * track and every course in one read, the API's ceiling (it pages both lists
 * 6 rows at a time by default). `login_type` and `course_type` are added per
 * request. Postman `web-masterclass-tracks-page-v1`.
 */
export const OFFERING_TRACKS_PAGE_SIZES = {
  'tracks.page_size': RAIL_PAGE_SIZE,
  'tracks.courses.page_size': RAIL_PAGE_SIZE,
} as const;

/** The tracks before `tracks-page/` answers, so the page reads one fixed shape. */
export const EMPTY_TRACKS_PAGE: MasterclassHomePage = { login_type: 'pre_login', tracks: [] };

/**
 * The signed-in rails' read: every learner rail in one call. `post_login`
 * needs a token (a 401 otherwise). Built whole off `BASE_API_URL`, like
 * `HIGHLIGHT_URL`. Postman `web-masterclass-library-v1`.
 */
export const MASTERCLASS_LIBRARY_URL = `${environment.API.baseUrl}web-api/v1/masterclass/library/`;

/** The completed courses, per learner (a 401 without a token). Postman `web-masterclass-completed-course-section-v1`. */
export const MASTERCLASS_COMPLETED_URL = `${environment.API.baseUrl}web-api/v1/masterclass/completed-course-section/`;

/**
 * `library/`'s params, less `course_type`, which the facade adds from the
 * connected offering. Each rail pages on its own key; a bare `page_size` is a
 * 400 because the answer carries more than one list. `popular` and `latest`
 * always come back but are not shown (the hero reads `highlight/`), so they
 * ask for one row each.
 */
export const MASTERCLASS_LIBRARY_PARAMS = {
  login_type: 'post_login',
  'in_progress.page_size': RAIL_PAGE_SIZE,
  'recommended.page_size': RAIL_PAGE_SIZE,
  'complimentary.page_size': RAIL_PAGE_SIZE,
  'because_you_watched.page_size': RAIL_PAGE_SIZE,
  'bookmarked.page_size': RAIL_PAGE_SIZE,
  'popular.page_size': 1,
  'latest.page_size': 1,
} as const;

/** `completed-course-section/`'s params, less `course_type`; the one list is `all_courses`. */
export const MASTERCLASS_COMPLETED_PARAMS = {
  'all_courses.page_size': RAIL_PAGE_SIZE,
} as const;

/**
 * The Coming Soon teasers. Public; each row's `notify_me` is the caller's own
 * reminder (`false` signed out). The page asks only signed in, as the rail
 * shows only then. Postman `web-masterclass-coming-soon-v1`.
 */
export const MASTERCLASS_COMING_SOON_URL = `${environment.API.baseUrl}web-api/v1/masterclass/coming-soon/`;

/**
 * Its one list pages on the bare `page_size`. Without `course_type` it also
 * sends the podcast and micro-learning teasers (since 2026-10-28), so the
 * facade always adds the offering's; any other key is a 400.
 */
export const MASTERCLASS_COMING_SOON_PARAMS = {
  page_size: RAIL_PAGE_SIZE,
} as const;

/**
 * `IsAuthenticated`: a learner's reminder for one teaser (`:id` is its UUID).
 * `{ notify_me: true }` turns it on, `false` off, and the answer says where it
 * landed (`data.notify_me`). One POST for both: a DELETE was refused by the
 * browser's preflight. 404 for a teaser no longer listed, 409 for one that has
 * launched. On `api/v1/`, shared with the app; there is no `web-api` twin.
 * Postman `masterclass-coming-soon-notify-me-v1`.
 */
export const MASTERCLASS_COMING_SOON_NOTIFY_ROUTE = {
  path: `${environment.API.baseUrl}api/v1/masterclass/coming-soon/:id/notify-me/`,
  method: 'POST',
} as RouteConfig<{ notify_me: boolean }, unknown>;

/** The toasts after a Remind Me click; the message is the course name. */
export const MASTERCLASS_REMINDER_TOASTS = {
  on: "We'll remind you",
  off: 'Reminder removed',
  launched: 'This course is now available',
  gone: 'This course is no longer listed',
  failed: { title: 'Reminder not saved', message: 'Please try again.' },
} as const;

/** Section ids of the signed-in rails the sidenav lists. */
export const MASTERCLASS_RAIL_SECTION_IDS = {
  continueWatching: 'continue-watching',
  myList: 'my-list',
  completed: 'completed-courses',
  comingSoon: 'masterclass-coming-soon',
} as const;

/** The signed-in rails above the tracks, in order. */
export const MASTERCLASS_RAILS_ABOVE_TRACKS: readonly LibraryRailConfig[] = [
  {
    key: 'in_progress',
    id: MASTERCLASS_RAIL_SECTION_IDS.continueWatching,
    heading: 'Continue Watching',
  },
  { key: 'recommended', id: 'recommended-for-you', heading: 'Recommended For You' },
  // The heading names the firm when `library/` sends one: `complimentaryHeading`.
  { key: 'complimentary', id: 'complimentary-courses', heading: 'Complimentary Courses' },
  // The route merges the related courses of every course passed, so there is no
  // single course to name.
  { key: 'because_you_watched', id: 'because-you-watched', heading: 'Because You Watched' },
];

/** "Complimentary Courses for Miles Education Employees". */
export const complimentaryHeading = (companyName: string): string =>
  `Complimentary Courses for ${companyName} Employees`;

/** The signed-in rails below the tracks. */
export const MASTERCLASS_RAIL_HEADINGS = {
  myList: 'My List',
  completed: "Courses you've mastered",
} as const;
