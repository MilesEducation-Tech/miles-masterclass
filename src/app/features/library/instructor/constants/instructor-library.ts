import { environment } from '@env/environment';

/**
 * The instructor library's one read. Public (`AllowAny`, the learner token adds
 * only bookmark state); `course_type` is required and anything undeclared is a
 * 400. Built whole off `BASE_API_URL`, like `COURSE_LIBRARY_URL`.
 */
export const INSTRUCTOR_LIBRARY_URL = `${environment.BASE_API_URL}web-api/v1/masterclass/all-instructors-page/`;

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
