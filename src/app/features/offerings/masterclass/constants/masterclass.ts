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
   * Web-only read, `AllowAny`: one course's public content. Takes exactly one
   * of `?course_id=<uuid>` or `?slug=`; both, neither, or any other key is a
   * 400 `invalid_query`, and an unknown course is a 404.
   */
  aboutCourse: `${ROOT}web-api/v1/masterclass/about-course/`,
} as const;

/**
 * A course id on this API: a UUID, any version. The legacy numeric ids still
 * in old links and search results don't match, and those links are looked up
 * by their slug instead.
 */
export const MASTERCLASS_COURSE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
