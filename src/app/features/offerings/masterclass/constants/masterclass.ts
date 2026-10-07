import { environment } from '@env/environment';
import { MasterclassHomePage } from '@features/offerings/masterclass/models/masterclass-home.model';

/**
 * Absolute URLs off `BASE_API_URL`, which is the ORIGIN ROOT (trailing slash,
 * no `api/` segment). Built whole, the same way as `WEBINAR_ENDPOINTS`, so
 * `apiUrl()` passes them through untouched and the `web-api/` surface is
 * spelled out where a reviewer can see it. This page never calls `app-api/`.
 */
const ROOT = environment.BASE_API_URL;

export const MASTERCLASS_ENDPOINTS = {
  /**
   * Web-only read, `AllowAny`: the tracks with their courses inline. Replaced
   * `home-page/` on 2026-10-07 (Postman `web-masterclass-tracks-page-v1`); the
   * old route is a 404 on every host.
   *
   * `login_type` is required and strict — leaving it out, or sending any other
   * key, is a 400 `invalid_query`. An anonymous `post_login` is a 401, and so
   * is a bad or expired token on either branch (the backend rechecked this on
   * 2026-10-07; it used to be a 403).
   */
  tracksPage: `${ROOT}web-api/v1/masterclass/tracks-page/`,
} as const;

/**
 * Rows asked for per list on `tracks-page/`: `tracks.page_size` for the tracks
 * and `tracks.courses.page_size` for each track's courses.
 *
 * The API pages both lists, 6 rows each by default, with a ceiling of 100. A
 * later page needs its own request (`?tracks.page=2`, or `?track=<slug>` plus
 * `tracks.courses.page=N` for one track's courses). The page shows every track
 * and every course in each carousel, so it asks for the ceiling once instead
 * of paging. UAT holds 4 tracks of up to 34 courses; a list past 100 rows
 * would be cut off at 100.
 */
export const HOME_PAGE_LIST_PAGE_SIZE = 100;

/** The page before `tracks-page/` answers, so the template reads one fixed shape. */
export const EMPTY_HOME_PAGE: MasterclassHomePage = { login_type: 'pre_login', tracks: [] };
