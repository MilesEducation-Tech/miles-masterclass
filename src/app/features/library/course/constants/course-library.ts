import { environment } from '@env/environment';
import { RouteConfig } from '@core/models/http.model';
import {
  CourseLibraryTab,
  LibraryFilterKey,
  LibraryFilterSelection,
} from '../models/course-library.model';

/**
 * The course library's one read: filter options and a page of cards. Public
 * (`AllowAny`); `course_type` is required and every other param is optional.
 * Built whole off `BASE_API_URL`, like `TRACKS_PAGE_URL`.
 */
export const COURSE_LIBRARY_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/filter/`;

/** Rows per page: fills the 2-, 3- and 4-column grids evenly. The API caps it at 100. */
export const COURSE_LIBRARY_PAGE_SIZE = 12;

/** Production's tabs and labels. No Nano Learning tab, by decision. */
export const COURSE_LIBRARY_TABS: readonly CourseLibraryTab[] = [
  { courseType: 'course', label: 'Masterclasses' },
  { courseType: 'podcast', label: 'Podcast' },
  { courseType: 'micro_learning', label: 'Micro Learning' },
];

/** The sidebar groups, in production's order. Category has no API counterpart. */
export const LIBRARY_FILTER_GROUPS: readonly { key: LibraryFilterKey; label: string }[] = [
  { key: 'instructor', label: 'Instructor' },
  { key: 'field_of_study', label: 'Field of Study' },
  { key: 'additional_category', label: 'Additional Category' },
  { key: 'level', label: 'CAIRA Level' },
  { key: 'cpe_credit', label: 'CPE Credits' },
  { key: 'track', label: 'Track' },
  { key: 'content_type', label: 'AI Kit' },
];

/**
 * The one content type the sidebar offers, as production's "AI Kit" group. The
 * others duplicate the tabs, and `masterclass_course` matches AI Kits too.
 */
export const AI_KIT_CONTENT_TYPE = 'ai_kit';

export const EMPTY_LIBRARY_SELECTION: LibraryFilterSelection = {
  instructor: [],
  field_of_study: [],
  additional_category: [],
  level: [],
  cpe_credit: [],
  track: [],
  content_type: [],
};

/**
 * The AI Kit button's read: the kit and exercise files sit in the course
 * detail's `miscellaneous_data`. `pre_login` for everyone: the extras are
 * public, and the signed-in variant adds nothing they need.
 */
export const COURSE_RESOURCES_ROUTE = {
  path: `${environment.BASE_API_URL}web-api/v1/masterclass/course-detail/:id/`,
  method: 'GET',
} as RouteConfig<void, unknown, Record<string, string>, { login_type: 'pre_login' }>;

/** The "Additional Resources" dialog and its toasts, worded as the legacy button's. */
export const COURSE_RESOURCES_COPY = {
  title: 'Additional Resources',
  aiKit: 'AI Kit',
  exerciseFile: 'Exercise file',
  emptyTitle: 'No Resources',
  emptyMessage: 'No additional resources are available for this course.',
  errorTitle: 'Error',
  errorMessage: 'Failed to fetch additional resources. Please try again later.',
} as const;
