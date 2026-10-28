import { environment } from '@env/environment';
import { MASTERCLASS_COURSE_TYPE } from '@core/constants/masterclass';
import { RouteConfig } from '@core/models/http.model';
import { VideoConfig } from '@core/models/video-player.model';
import { PartnerContentItem } from '@shared/components/partner-content-list/partner-content-list';
import { LibraryRailConfig } from '@features/offerings/masterclass/models/masterclass-library.model';
import {
  RailFilterCreditBucket,
  RailFilterGroupKey,
} from '@features/offerings/masterclass/models/masterclass-rail-filter.model';

/**
 * How long the course hero shows its poster before the trailer starts, as on
 * production and in the shared `VideoPoster`.
 */
export const HERO_TRAILER_DELAY_MS = 3000;

/**
 * The course hero's background trailer: an HLS stream, so it plays through the
 * shared video.js player rather than a plain `<video>`. Muted and looping with
 * no chrome; the hero draws its own play/pause and mute buttons.
 */
export const HERO_TRAILER_CONFIG: VideoConfig = {
  controls: false,
  autoplay: true,
  muted: true,
  loop: true,
  preload: 'auto',
  fluid: false,
  responsive: false,
};

/**
 * The signed-in rails' read: every learner rail in one call. `post_login`
 * needs a token (a 401 otherwise). Built whole off `BASE_API_URL`, like
 * `HIGHLIGHT_URL`. Postman `web-masterclass-library-v1`.
 */
export const MASTERCLASS_LIBRARY_URL = `${environment.API.baseUrl}web-api/v1/masterclass/library/`;

/** The completed courses, per learner (a 401 without a token). Postman `web-masterclass-completed-course-section-v1`. */
export const MASTERCLASS_COMPLETED_URL = `${environment.API.baseUrl}web-api/v1/masterclass/completed-course-section/`;

/** Rows asked for per rail: every course in one read, as the track rails do (the API's ceiling). */
const RAIL_PAGE_SIZE = 100;

/**
 * `library/`'s params. Each rail pages on its own key; a bare `page_size` is a
 * 400 because the answer carries more than one list. `popular` and `latest`
 * always come back but are not shown (the hero reads `highlight/`), so they
 * ask for one row each.
 */
export const MASTERCLASS_LIBRARY_PARAMS = {
  login_type: 'post_login',
  course_type: MASTERCLASS_COURSE_TYPE,
  'in_progress.page_size': RAIL_PAGE_SIZE,
  'recommended.page_size': RAIL_PAGE_SIZE,
  'complimentary.page_size': RAIL_PAGE_SIZE,
  'because_you_watched.page_size': RAIL_PAGE_SIZE,
  'bookmarked.page_size': RAIL_PAGE_SIZE,
  'popular.page_size': 1,
  'latest.page_size': 1,
} as const;

/** `completed-course-section/`'s params; the one list is `all_courses`. */
export const MASTERCLASS_COMPLETED_PARAMS = {
  course_type: MASTERCLASS_COURSE_TYPE,
  'all_courses.page_size': RAIL_PAGE_SIZE,
} as const;

/**
 * The Coming Soon teasers. Public, and the same answer for every caller; the
 * page asks only signed in, as the rail shows only then. Postman
 * `web-masterclass-coming-soon-v1`.
 */
export const MASTERCLASS_COMING_SOON_URL = `${environment.API.baseUrl}web-api/v1/masterclass/coming-soon/`;

/** Its one list pages on the bare `page_size`; any other key is a 400. */
export const MASTERCLASS_COMING_SOON_PARAMS = { page_size: RAIL_PAGE_SIZE } as const;

/** The heading over the Coming Soon rail, styled as the micro-learning page's. */
export const MASTERCLASS_COMING_SOON_HEADING: PartnerContentItem[] = [
  {
    subHeading: 'Coming Soon on Masterclasses',
    paragraph: 'Hit the bell icon for updates and never miss a new CPE course drop!',
    subHeadingClass: 'text-white md:text-5xl text-3xl font-bold',
    itemClass: 'text-center py-4 md:w-2/3 w-full mx-auto leading-relaxed',
    paragraphClass: 'text-white md:text-lg text-base font-normal mt-2',
  },
];

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
