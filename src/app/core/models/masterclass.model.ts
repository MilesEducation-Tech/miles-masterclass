import {
  ContentDetails,
  CourseChapter,
  FinalAssessmentExamResponse,
  QuizDetails,
  QuizReportItem,
} from './course.model';
import { CommonResponse, RouteConfig } from './http.model';

export interface ChapterQuizResponse {
  status_code: number;
  data: QuizDetails;
  message: string;
}

/**
 * One row from `user-assessment/download_certificate/`. Multiple rows are
 * returned for courses that issue per-field-of-study certificates; in that
 * case the dialog zips them. A single row downloads directly.
 *
 * Webinars can issue NASBA, Miles, or both depending on `certificate_type` on
 * the request body. Each URL field is therefore optional — the dialog filters
 * by whichever variant the user clicked.
 */
export interface DownloadCertificateItem {
  certificate_id: number;
  field_of_study_name: string | null;
  cpe_credits: number | null;
  nasba_certificate_url?: string;
  miles_certificate_url?: string;
}

/**
 * Payload of `user-badges/:id/claim/`. Server is idempotent — a repeat claim
 * returns the same badge with its `credly_accept_url` ("Badge already issued").
 */
export interface ClaimBadgeResult {
  badge_name?: string;
  badge_level?: string;
  badge_image?: string;
  /** Credly accept URL — open in a new tab so the user can accept the badge. */
  credly_accept_url?: string;
  /** Domain status, e.g. `'earned'`. Not the HTTP wrapper's boolean status. */
  status?: string;
  message?: string;
}

export interface CourseContentData {
  course_id: number;
  course_type: string;
  glossary_transcript_text: string;
  chapter: {
    chapter_id: number;
    chapter_name: string;
    transcript_text: string;
  } | null;
}

export interface CourseContentResponse {
  status_code: number;
  message: string;
  data: CourseContentData;
}

export const MASTERCLASS_ROUTES = {
  getCourseDetails: {
    path: 'v2/:course_type/details/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<ContentDetails>, {}, { id: number }>,

  getCourseChapter: {
    path: 'v2/chapters/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<CourseChapter[]>, {}, { id: number; course_type: string }>,

  setCpeMode: {
    path: 'user/customaction/set_cpe_mode/',
    method: 'POST',
  } as RouteConfig<
    {
      masterclass_id?: number;
      podcast_id?: number;
      nano_learning_id?: number;
      cpe_mode_status: boolean;
    },
    CommonResponse<void>,
    {},
    {}
  >,

  myClassActivity: {
    path: 'v2/user/myclassactivity/',
    method: 'POST',
  } as RouteConfig<
    { chapter_id: number; time_status: number; event: 'heartbeat' | 'completed' | 'exit' },
    CommonResponse<void>,
    {},
    {}
  >,

  submitQuizAnswer: {
    path: 'user-quiz-details/',
    method: 'POST',
  } as RouteConfig<{ answer: string; quiz_question: number }, CommonResponse<void>, {}, {}>,

  chapterQuizReport: {
    path: 'masterclass/report_summary/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<QuizReportItem[]>, {}, { chapter_id: number }>,

  getChapterQuiz: {
    path: 'chapter-quiz',
    method: 'GET',
  } as RouteConfig<void, ChapterQuizResponse, {}, { chapter_id: number }>,

  startFinalAssessment: {
    path: 'user-assessment/start_assessment/',
    method: 'POST',
  } as RouteConfig<
    void,
    FinalAssessmentExamResponse,
    {},
    {
      masterclass_id?: number;
      podcast_id?: number;
      nano_learning_id?: number;
      /** AI Lab courses share `nano_learning_id`; this tells the backend which flavour. */
      course_type?: 'ai_lab';
    }
  >,

  toggleBookmark: {
    path: 'v2/user/toggle-bookmark/',
    method: 'POST',
  } as RouteConfig<
    { course_id: number; course_type: 'masterclass' | 'podcast' | 'micro_learning' },
    { status: boolean; is_bookmarked: boolean; message: string }
  >,

  addToCart: {
    path: 'v2/user/cart/',
    method: 'POST',
  } as RouteConfig<
    { item_id: number; item_type: 'masterclass' | 'podcast' | 'micro_learning' },
    { status: boolean; in_cart: boolean; message: string }
  >,

  getCourseContent: {
    path: 'v2/course-content/',
    method: 'GET',
  } as RouteConfig<
    void,
    CourseContentResponse,
    {},
    { id: number; course_type: string; chapter_id?: number }
  >,

  downloadCertificate: {
    path: 'user-assessment/download_certificate/',
    method: 'POST',
  } as RouteConfig<
    {
      course_id: number;
      course_type: string;
      /**
       * Webinar-specific filter — backend issues NASBA-only / Miles-only / both
       * cert variants per webinar. Omit for masterclass / podcast (defaults to
       * the course's existing behaviour on the backend).
       */
      certificate_type?: 'nasba' | 'miles' | 'both';
    },
    CommonResponse<DownloadCertificateItem[]>,
    {},
    {}
  >,

  additionalResources: {
    path: 'v2/dashboard/:courseId/additional-resources/',
    method: 'GET',
  } as RouteConfig<void, CommonResponse<AdditionalResourceItem[]>, {}, {}>,

  downloadExerciseFile: {
    path: 'exercise-files/:id/download/',
    method: 'GET',
  } as RouteConfig<void, Blob, {}, { id: number; course_type: string }>,

  claimBadge: {
    path: 'user-badges/:id/claim/',
    method: 'GET',
  } as RouteConfig<void, ClaimBadgeResult, {}, { id: number }>,
} as const;

export interface AdditionalResourceItem {
  id: number;
  title: string;
  description: string;
  vertical_thumbnail: string | null;
  horizontal_thumbnail: string | null;
  /** Hosted file (e.g. a PDF). Either this or `resource_link` carries the URL. */
  resource_file: string | null;
  /** External link, when the resource isn't a hosted file. */
  resource_link: string | null;
}
