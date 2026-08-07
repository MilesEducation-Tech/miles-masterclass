/**
 * feature.model.ts
 * Type-safe models for feature-based API loading system.
 */

import { TrackListInterface } from './track.model';
import { FieldOfStudy, InstructorDetails } from './course.model';

// All possible API keys available in the app
export type FeatureApiKey =
  | 'track'
  | 'popular'
  | 'comingSoon'
  | 'instructor'
  | 'inprogress'
  | 'lastViewed'
  | 'completed'
  | 'bookmark'
  | 'upcoming'
  | 'premiere'
  | 'recommended'
  | 'becauseYouWatched'
  | 'complimentary'
  | 'highlight'
  | 'latest'
  | 'newlyAdded';

// Config structure for each feature
export interface FeatureConfigItem {
  public: FeatureApiKey[];
  userSpecific: FeatureApiKey[];
}

// The master config type (e.g. home, masterclass, etc.)
export type FeatureConfigMap = Record<string, FeatureConfigItem>;

// Pagination information for API calls
export interface PaginationInfo {
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  nextUrl?: string;
  previousUrl?: string;
  perPage?: number;
  [key: string]: any; // Allow for additional pagination fields
}

// Wrapper for API responses with pagination
export interface ApiResponseWithPagination<T> {
  data: T;
  pagination?: PaginationInfo;
}

// Store pagination info separately for each API key
export type FeaturePaginationMap = Partial<Record<FeatureApiKey, PaginationInfo>>;

// Typed response shape per FEATURE_ROUTES below. Types kept in sync with the
// `RouteConfig` declarations so a refactor of one surfaces in the other.
export interface FeatureResponseMap {
  track?: TrackListInterface[];
  comingSoon?: Content[];
  instructor?: BaseInstructorDetails[];
  inprogress?: Content[];
  lastViewed?: Content[];
  popular?: Content[];
  completed?: Content[];
  bookmark?: Content[];
  upcoming?: UpcomingPremiere[];
  premiere?: UpcomingPremiere[];
  recommended?: Content[];
  becauseYouWatched?: Content[];
  complimentary?: Content[];
  highlight?: Content[];
  latest?: Content[];
  newlyAdded?: Content[];
}

// Utility type for API function map
export type FeatureApiMap = Record<FeatureApiKey, (key?: any) => import('rxjs').Observable<any>>;

// Upcoming Premiere Types
export interface CourseCategoryDetails {
  id: number;
  course_name: string;
  icon: string;
  course_category: string;
  description: string | null;
  updated_by: number | null;
  profession: number | null;
}

export interface WebinarDate {
  id: number;
  session_title: string;
  start_date: string;
  end_date: string;
  ordering: number | null;
  is_active: boolean;
  /** Backend returns this as a number on some endpoints; widened for safety. */
  meeting_id: string | number | null;
  is_attendance_synced: boolean;
  is_poll_updated: boolean;
  video_recording: string | null;
  join_url: string | null;
  /** Some endpoints add an `email_sent` flag — preserved as optional. */
  email_sent?: boolean;
  created_at: string;
  updated_at: string;
  /** Only present on the enrollments endpoint payload. */
  webinar?: number;
  updated_by?: number | null;
  is_webinar_ended: boolean;
}

/** Possible attendance states for an enrolled webinar session. */
export type WebinarAttendanceStatus = 'Present' | 'Pending' | 'Absent' | 'Attended';

/** Webinar enrollment listing types served by `webinar/enrollments/?type=...`. */
export type WebinarEnrollmentType = 'registered' | 'absent' | 'completed';

/** Subset of Zoom meeting details surfaced once a user is registered. */
export interface ZoomClassDetails {
  id: number;
  topic: string;
  join_url: string;
  start_time: string;
  registrant_id: string;
}

/** Per-user enrollment state nested under `registered_webinar.user_enrollments`. */
export interface WebinarEnrollment {
  id: number;
  webinar_dates: WebinarDate;
  feedback_submitted: boolean;
  attendance_status: WebinarAttendanceStatus;
  active_plan: { free_access?: boolean } | null;
  zoom_class_details: ZoomClassDetails | null;
  has_attended_class: boolean;
  is_active: boolean;
  join_url: string | null;
  joined_time: string | null;
  leave_time: string | null;
  time_durations: number;
  created_at: string;
  webinar: number;
  webinar_date: number;
  user: number;
  updated_by: number | null;
}

export interface RegisteredWebinar {
  added: boolean;
  /** Populated by the enrollments endpoint; absent on the public filter endpoint. */
  user_enrollments?: WebinarEnrollment;
}

/** Optional individual badge awarded for a webinar (when `has_individual_badge`). */
export interface UserBadge {
  id: number;
  badge_name: string;
  badge_image: string;
  sub_text: string | null;
  description: string;
  awarded_at: string;
  accept_url: string;
}

/** Certificate links surfaced for completed webinars. */
export interface WebinarFeedbackDetails {
  user_feedback_submitted: boolean;
  [key: string]: unknown;
}

// Base instructor interface
export interface BaseInstructorDetails {
  id: number;
  first_name: string;
  last_name: string;
  about_me: string;
  profile_image: string;
  promo_video: string | null;
  horizontal_thumbnail: string | null;
}

// Premiere-specific instructor details
// export interface InstructorDetails extends BaseInstructorDetails {
//   designation: string;
//   facebook_link: string | null;
//   linkedin_link: string | null;
//   youtube_link: string | null;
//   instagram_link: string | null;
//   horizontal_thumbnail: string; // Non-nullable for premiere
//   /**
//    * Co-instructors surfaced by the webinar endpoint. Trimmed shape (no
//    * `about_me` / `promo_video`) — only what the hero + details views need.
//    */
//   other_instructors?: CoInstructorDetails[];
// }

/** Trimmed instructor shape returned under `instructor_details.other_instructors`. */
export interface CoInstructorDetails {
  id: number;
  first_name: string;
  last_name: string;
  designation: string;
  profile_image: string;
  horizontal_thumbnail: string | null;
  linkedin_link: string | null;
}

export type UserFeedbackDetails = Record<string, any>;

export interface UpcomingPremiere {
  id: number;
  /** CPE fields of study; source for the `2 Credits` badge on cards. */
  fields_of_study: FieldOfStudy[];
  /** Optional on the enrollments endpoint (older shape) — keep optional. */
  course_category_details?: CourseCategoryDetails;
  webinar_dates: WebinarDate[];
  registered_webinar: RegisteredWebinar;
  instructor_details: InstructorDetails;
  is_added_to_cart: boolean;
  /** Shape varies per listing type — narrowed via WebinarFeedbackDetails when present. */
  user_feedback_details: WebinarFeedbackDetails | UserFeedbackDetails | null;
  is_certificate_eligible: boolean;
  // `unknown | null` (not `any`) so consumers must narrow before access.
  // Matches the convention in course.model.ts and cpe-tracker.model.ts.
  active_plan: unknown | null;
  additional_resource: unknown[];
  /** Individual webinar badge presence + assets (Credly). */
  has_individual_badge: boolean;
  badge_icon_url: string | null;
  user_badge: UserBadge | null;
  created_at: string;
  webinar_title: string;
  banner: string | null;
  video_recording: string | null;
  course_overview: string;
  short_course_overview: string;
  learning_objectives: string;
  topics: string[];
  int_delivery_method: string;
  program_level: string;
  prerequisite_education: string;
  advance_preparation: string;
  webinar_credits: number;
  webinar_duration: number;
  no_question_answered: number;
  /** Whether the webinar awards CPE credits via NASBA. */
  awards_cpe?: boolean;
  /** Type of certificate offered — e.g. `'both'`, `'miles'`, `'nasba'`, etc. */
  certificate_type?: string;
  /** Minimum attendance percentage required for credit. */
  attendance_threshold?: number;
  mark_duration: number;
  Course_material: string | null;
  priority_order: number;
  is_complimentary_access?: boolean;
  is_free: boolean;
  is_subscription_excluded: boolean;
  status: boolean;
  horizontal_thumbnail: string;
  vertical_thumbnail: string;
  mobile_thumbnail: string | null;
  thumbnail_gif: string | null;
  square_thumbnail: string;
  home_front_thumbnail: string | null;
  home_back_thumbnail: string | null;
  /** CAiRA / Caira-level metadata (optional, present on the filter endpoint). */
  included_for_caira?: boolean;
  caira_level: number | null;
  caira_priority?: number;
  /** Legacy fields preserved as optional so older consumers keep compiling. */
  updated_by?: number;
  course_category?: number;
  host_instructor?: number;
  professions?: number[];
}

// Import RouteConfig and utility types from auth.model for consistency
import { RouteConfig } from './http.model';
import { Content } from './course.model';

// Feature API Response wrappers
export interface PaginationData {
  current_page: number;
  // API returns either a numeric page index or a full URL string for next/prev.
  next_page: number | string | null;
  prev_page: number | string | null;
  total_pages: number;
  total_count: number;
}

export interface FeatureApiResponse<T> {
  data: T;
  pagination_data?: PaginationData;
  status?: boolean;
  message?: string;
  count?: number;
  next?: string | null;
  previous?: string | null;
}

/**
 * Feature API route configuration.
 * Similar to AUTH_ROUTES, provides centralized API path management.
 */
export const FEATURE_ROUTES = {
  comingSoon: {
    path: 'v2/dashboard/',
    method: 'GET',
    params: {
      filter: 'coming_soon',
    },
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      filter: 'highlight' | 'coming_soon' | 'latest' | 'popular' | 'newly_added';
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  instructor: {
    path: 'instructor/',
    method: 'GET',
  } as RouteConfig<void, FeatureApiResponse<BaseInstructorDetails[]>>,

  inprogress: {
    path: 'v2/user/recently_viewed/',
    method: 'GET',
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  // Footer "continue learning" resume card — single most-recently-viewed course
  // (global, no query params). Response `data` is one `Content` object; the
  // facade wraps it to an array so the card reads items()[0].
  lastViewed: {
    path: 'v2/user/last_viewed/',
    method: 'GET',
  } as RouteConfig<void, FeatureApiResponse<Content>>,

  completed: {
    path: 'v2/user/completed_classes/',
    method: 'GET',
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  bookmark: {
    path: 'v2/user/bookmarks/',
    method: 'GET',
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  upcoming: {
    path: 'webinar/filter/',
    method: 'GET',
  } as RouteConfig<void, FeatureApiResponse<UpcomingPremiere[]>>,

  premiere: {
    path: 'webinar/filter/',
    method: 'GET',
    params: {
      type: 'futured',
    },
  } as RouteConfig<void, FeatureApiResponse<UpcomingPremiere[]>>,

  about: {
    path: 'v2/library/:id/about/',
    method: 'GET',
  } as RouteConfig<
    { id: number },
    FeatureApiResponse<Content>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  popular: {
    path: 'v2/dashboard/',
    method: 'GET',
    params: {
      filter: 'popular',
    },
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      filter: 'highlight' | 'coming_soon' | 'latest' | 'popular' | 'newly_added';
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  recommended: {
    path: 'recommendation/',
    method: 'GET',
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  becauseYouWatched: {
    path: 'user/because_you_watched/',
    method: 'GET',
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  complimentary: {
    path: 'complimentary-course/',
    method: 'GET',
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  highlight: {
    path: 'v2/dashboard/',
    method: 'GET',
    params: {
      filter: 'highlight',
    },
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      filter: 'highlight' | 'coming_soon' | 'latest' | 'popular' | 'newly_added';
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  latest: {
    path: 'v2/dashboard/',
    method: 'GET',
    params: {
      filter: 'latest',
    },
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      filter: 'highlight' | 'coming_soon' | 'latest' | 'popular' | 'newly_added';
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,

  newlyAdded: {
    path: 'v2/dashboard/',
    method: 'GET',
    params: {
      filter: 'newly_added',
    },
  } as RouteConfig<
    void,
    FeatureApiResponse<Content[]>,
    {},
    {
      filter: 'highlight' | 'coming_soon' | 'latest' | 'popular' | 'newly_added';
      course_type: 'masterclass' | 'podcast' | 'micro_learning';
      page: number;
    }
  >,
} as const;
