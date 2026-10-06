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
   * Web-only read, `AllowAny`: the tracks with their courses inline.
   *
   * `login_type` is required and strict — leaving it out, or sending any other
   * key, is a 400 `invalid_query`. An anonymous `post_login` is a 401, and a
   * bad or expired token is a 403 (this backend authenticates before it checks
   * the permission).
   */
  homePage: `${ROOT}web-api/v1/masterclass/home-page/`,
} as const;

/**
 * Courses asked for per track on `home-page/`, sent as `tracks.courses.page_size`.
 *
 * Since 2026-10-06 the API pages each track's courses, 6 at a time by default,
 * and a later page needs `?track=<slug>` on its own request (the `next` link it
 * sends leaves that out and is a 400). The page shows every course in each
 * carousel, so it asks for the server's cap in one call instead. The largest
 * track on UAT holds 34; a track past 100 would be cut off at 100.
 */
export const HOME_PAGE_COURSES_PER_TRACK = 100;

/** The page before `home-page/` answers, so the template reads one fixed shape. */
export const EMPTY_HOME_PAGE: MasterclassHomePage = { login_type: 'pre_login', tracks: [] };
