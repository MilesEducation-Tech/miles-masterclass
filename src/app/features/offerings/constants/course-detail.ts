import { environment } from '@env/environment';
import { CourseDetailApi, CourseOffering } from '@features/offerings/models/course-detail.model';

/**
 * Absolute URLs off `BASE_API_URL`, which is the ORIGIN ROOT (trailing slash,
 * no `api/` segment). Built whole, the same way as `WEBINAR_ENDPOINTS`, so
 * `apiUrl()` passes them through untouched and the `web-api/` surface is
 * spelled out where a reviewer can see it. These pages never call `app-api/`.
 */
const ROOT = environment.BASE_API_URL;

/**
 * `CourseDetailFacade`'s routes and names, per offering. An offering joins by
 * adding its entry, once the backend ships its web routes; none is guessed.
 */
export const COURSE_DETAIL_API: Record<CourseOffering, CourseDetailApi> = {
  masterclass: {
    /**
     * Web-only read, `AllowAny` since 2026-10-07: the course page, both sides of
     * login. Append `<uuid>/` (a slug is a 404). `?login_type=` is required:
     * `pre_login` is served anonymously, `post_login` is a 401 without a token,
     * and an undeclared parameter is a 400.
     */
    courseDetail: `${ROOT}web-api/v1/masterclass/course-detail/`,

    /**
     * Web-only read, `AllowAny`: one course's public content. Takes exactly one
     * of `?course_id=<uuid>` or `?slug=`; both, neither, or any other key is a
     * 400 `invalid_query`, and an unknown course is a 404.
     */
    aboutCourse: `${ROOT}web-api/v1/masterclass/about-course/`,

    /**
     * `IsAuthenticated`, no body. Its response shape is not captured anywhere
     * (Postman's template "could not be resolved"), so the facade re-reads
     * `course-detail/` after it rather than trusting the body.
     */
    bookmark: { path: `${ROOT}web-api/v1/masterclass/bookmark/:id/`, method: 'POST' },

    urlSegment: 'masterclass',
    analyticsType: 'masterclass',
  },
};

/**
 * Chapters asked for on `course-detail/`, sent as `chapters.page_size`. The API
 * pages them 6 at a time by default; the page lists every chapter, so it asks
 * for the server's cap. The longest UAT masterclass has 11.
 */
export const COURSE_DETAIL_CHAPTERS_PAGE_SIZE = 100;

/**
 * A course id on this API: a UUID, any version. The legacy numeric ids still
 * in old links and search results don't match, and those links are looked up
 * by their slug instead.
 */
export const COURSE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
