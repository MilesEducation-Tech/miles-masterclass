import { Content } from './course.model';
import { CommonResponse, RouteConfig } from './http.model';

/**
 * Per-instructor courses endpoint returns content grouped by type. The
 * groups are optional because an instructor may only teach in one format.
 * Shapes match `Content` closely; `nano` items don't carry `square_thumbnail`
 * — consumers should treat that field as optional for nano cards.
 */
export interface InstructorCoursesData {
  masterclass?: Content[];
  podcast?: Content[];
  nano?: Content[];
  webinar?: Content[];
}

export interface InstructorCoursesResponse {
  status_code: number;
  message: string;
  data: InstructorCoursesData;
}

export type RelatedContentType = 'masterclass' | 'podcast';

export const RELATED_CONTENT_ROUTES = {
  /**
   * GET /v2/dashboard/related_content/?id=&type=
   * Returns up to ~5 similar courses for the given (id, type).
   * Backend currently rejects `type=instructor`; see `getInstructorCourses` for
   * the per-instructor variant.
   */
  getRelatedContent: {
    path: 'v2/dashboard/related_content/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<Content[]>, {}, { id: number; type: RelatedContentType }>,

  /**
   * GET /instructor/:id/courses/?page=&type=
   * NOTE: not under the `v2/dashboard/` prefix — full path includes `:id`.
   * Callers must `path.replace(':id', String(instructorId))` before fetch.
   * Backend honours `type` as a server-side filter; omit it to get all
   * buckets back (`masterclass + podcast + nano + webinar`).
   */
  getInstructorCourses: {
    path: 'instructor/:id/courses/',
    method: 'GET',
  } as RouteConfig<
    void,
    InstructorCoursesResponse,
    {},
    { page: number; type?: RelatedContentType }
  >,
} as const;
