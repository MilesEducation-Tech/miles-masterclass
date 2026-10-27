import { environment } from '@env/environment';
import { VideoConfig } from '@core/models/video-player.model';
import { InstructorCourseTab } from '@features/library/instructor/models/instructor-library.model';

/**
 * The instructor library's one read. Public (`AllowAny`, the learner token adds
 * only bookmark state); `course_type` is required and anything undeclared is a
 * 400. Built whole off `environment.API.baseUrl`, like `COURSE_LIBRARY_LIST_URL`.
 */
export const INSTRUCTOR_LIBRARY_URL = `${environment.API.baseUrl}web-api/v1/masterclass/all-instructors-page/`;

/**
 * Every type the course library has a tab for, so a row's courses count all an
 * instructor teaches. The list itself is the same for any value.
 */
export const INSTRUCTOR_LIBRARY_COURSE_TYPES = 'course,podcast,micro_learning';

/** Rows per page: fills the 2-, 4- and 5-column grids evenly. The API caps it at 100. */
export const INSTRUCTOR_LIBRARY_PAGE_SIZE = 20;

/**
 * Known networks, by lower-cased `social_media_title`, to their `@ng-icons/svgl`
 * icon. The card provides exactly these icons; any other title shows the icon
 * the API sends.
 */
export const INSTRUCTOR_SOCIAL_ICONS: Readonly<Partial<Record<string, string>>> = {
  linkedin: 'svglLinkedin',
  youtube: 'svglYoutube',
  instagram: 'svglInstagram',
  facebook: 'svglFacebook',
};

// ---- Instructor page -------------------------------------------------------

/**
 * The profile read; the instructor's UUID and a slash follow. `AllowAny` since
 * 2026-10-15, and `?login_type=` is required: `pre_login` is served anonymously,
 * `post_login` is a 401 without a token, and leaving it out (or sending any
 * undeclared parameter) is a 400.
 */
export const INSTRUCTOR_DETAIL_URL = `${environment.API.baseUrl}web-api/v1/masterclass/instructor-detail/`;

/**
 * The course read: the course library's `filter/`, narrowed by `instructor` and
 * `content_type`. Public; anything undeclared, such as the retired
 * `course_type`, is a 400. Declared here rather than imported from the sibling
 * `course` sub-feature.
 */
export const INSTRUCTOR_COURSES_URL = `${environment.API.baseUrl}web-api/v1/masterclass/filter/`;

/** One page holds everything an instructor teaches. The API caps it at 100. */
export const INSTRUCTOR_COURSES_PAGE_SIZE = 100;

/** The tabs under "Courses by …", with production's labels. One `filter/` read per tab. */
export const INSTRUCTOR_COURSE_TABS: readonly InstructorCourseTab[] = [
  { contentType: 'masterclass_course', label: 'Masterclass' },
  { contentType: 'podcast', label: 'Podcast' },
  { contentType: 'micro_learning', label: 'Micro Learning' },
];

/**
 * The only instructor id the API knows. An old numeric link (`/instructor/<number>/…`)
 * is refused before any request.
 */
export const INSTRUCTOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Promo video types the player can play, by file extension. Any other
 * `video_url` (UAT has a Google Drive viewer page) shows no Promo section rather
 * than a player that cannot load it.
 */
export const INSTRUCTOR_PROMO_TYPES: Readonly<Partial<Record<string, string>>> = {
  m3u8: 'application/x-mpegURL',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
};

/** The promo player; the page adds the instructor's wide photo as the poster. */
export const INSTRUCTOR_PROMO_PLAYER: VideoConfig = {
  controls: true,
  autoplay: false,
  fluid: true,
  responsive: true,
  preload: 'metadata',
};
