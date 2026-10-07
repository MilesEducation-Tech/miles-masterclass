import { environment } from '@env/environment';
import { RouteConfig } from '@core/models/http.model';
import { VideoConfig } from '@core/models/video-player.model';

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
   * 400 `invalid_query`, and an unknown course is a 404. The course page reads
   * it only to turn an old numeric link's slug into a UUID.
   */
  aboutCourse: `${ROOT}web-api/v1/masterclass/about-course/`,

  /**
   * Web-only read, `AllowAny` since 2026-10-07: the course page, both sides of
   * login. Append `<uuid>/` (a slug is a 404). `?login_type=` is required:
   * `pre_login` is served anonymously, `post_login` is a 401 without a token,
   * and an undeclared parameter is a 400.
   */
  courseDetail: `${ROOT}web-api/v1/masterclass/course-detail/`,
} as const;

/**
 * The course page's mutations, for `ApiClient.call()`.
 *
 * `bookmark` toggles the learner's bookmark: `IsAuthenticated`, `:id` is the
 * course UUID, no body. Its response shape is not captured anywhere (Postman's
 * template "could not be resolved"), so the page re-reads `course-detail/`
 * after it rather than trusting the body.
 */
export const MASTERCLASS_COURSE_ROUTES = {
  bookmark: {
    path: `${ROOT}web-api/v1/masterclass/bookmark/:id/`,
    method: 'POST',
  } as RouteConfig<void, unknown>,
};

/**
 * Chapters asked for on `course-detail/`, sent as `chapters.page_size`. The API
 * pages them 6 at a time by default; the page lists every chapter, so it asks
 * for the server's cap. The longest UAT course has 11.
 */
export const COURSE_DETAIL_CHAPTERS_PAGE_SIZE = 100;

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
 * A course id on this API: a UUID, any version. The legacy numeric ids still
 * in old links and search results don't match, and those links are looked up
 * by their slug instead.
 */
export const MASTERCLASS_COURSE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
