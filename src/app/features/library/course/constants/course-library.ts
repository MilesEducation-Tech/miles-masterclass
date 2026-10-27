import { environment } from '@env/environment';
import {
  CourseLibraryTab,
  LibraryCourseType,
  LibraryFilterKey,
  LibraryFilterSelection,
} from '@features/library/course/models/course-library.model';

/**
 * The sidebar's read: every filter option, plus an unfiltered page of cards.
 * Public (`AllowAny`). It takes the filters and `content_type`, but no
 * `course_type` or `login_type`: since the backend's 2026-10-15 change either
 * one is a 400. Built whole off `BASE_API_URL`, like `TRACKS_PAGE_URL`.
 */
export const COURSE_LIBRARY_FILTERS_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/filter/`;

/**
 * The cards' read: one `course_type`'s courses under the selected filters.
 * Public; `course_type` and `login_type` are required, and it rejects
 * `content_type`, which is why an AI Kit selection reads `filter/` instead.
 */
export const COURSE_LIBRARY_LIST_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/filter-based-masterclass-list/`;

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

/** The one tab that offers AI Kit: AI Kits are masterclasses. */
export const AI_KIT_COURSE_TYPE: LibraryCourseType = 'course';

export const EMPTY_LIBRARY_SELECTION: LibraryFilterSelection = {
  instructor: [],
  field_of_study: [],
  additional_category: [],
  level: [],
  cpe_credit: [],
  track: [],
  content_type: [],
};
