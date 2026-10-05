import { environment } from '@env/environment';

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
