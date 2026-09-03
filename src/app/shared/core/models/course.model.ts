export interface InstructorDetails {
  id: number;
  first_name: string;
  last_name: string;
  designation?: string;
  about_me?: string;
  linkedin?: string;
  profile_image?: string;
  horizontal_thumbnail?: string;
  promo_video?: string;
  other_instructors: Omit<InstructorDetails, 'other_instructors' | 'about_me' | 'promo_video'>[];
}

export interface CourseCategoryDetails {
  id: number;
  course_name: string;
  course_category?: string;
  description?: string | null;
}

export interface FieldOfStudy {
  id: number;
  name: string;
  cpe_credits?: number;
}

export interface PriceDetails {
  price: number;
  currency_code: string;
  discount: number;
  currency_symbol: string;
  selling_price: number;
  pay_method: string;
}

export interface PlayHistory {
  id: number;
  time_status: number;
  app_type: string;
  updated_at: string;
  master_class: number | null;
  nano_learning: number;
  chapter: number;
  user: number;
  doc_page: number | null;
  updated_by: number | null;
  is_completed: boolean;
}

export interface QuizQuestion {
  id: number;
  updated_at: string;
  question: string;
  user_selected_option?: string;
  option_a: string;
  description_option_a: string;
  option_b: string;
  description_option_b: string;
  option_c: string;
  description_option_c: string;
  option_d: string;
  description_option_d: string;
  correct_option?: string;
  status: boolean;
  updated_by: number | null;
  chapter: number;
}

export interface QuizReportItem {
  user_selected_option: string;
  correct_option: string;
  chapter_id: number;
  question: string;
  option_description_a: string;
  option_description_b: string;
  option_description_c: string;
  option_description_d: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

export interface QuizDetails {
  questions: QuizQuestion[];
  already_attended: number;
  total_questions: number;
  overall_chapter_questions: number;
}

export interface ChapterWiseDetails {
  chapter_id: number;
  status: boolean;
}
export interface CourseChapter {
  id: number;
  play_history: PlayHistory | null;
  quiz_details: QuizDetails;
  isChapterCompleted?: boolean;
  updated_at: string;
  chapter_name: string;
  chapter_thumbnail: string;
  square_thumbnail: string | null;
  description: string;
  transcript_source: string | null;
  transcript: string | null;
  transcript_text: string | null;
  video_source: string | null;
  video_url: string;
  audio_url: string | null;
  mobile_video_url: string;
  no_of_questions: number;
  video_duration: number;
  start_page: number;
  end_page: number;
  course_created_date: string | null;
  course_reviewed_date: string | null;
  course_updated_date: string | null;
  updated_by: number | null;
  master_class: number | null;
  nano_learning: number;
}

export interface Content {
  id: number;
  title: string;
  thumbnail: string;
  horizontal_thumbnail: string;
  square_thumbnail: string | null;
  course_type: string;
  podcast_format?: string | null;
  course_category_details: CourseCategoryDetails;
  fields_of_study?: FieldOfStudy[];
  has_additional_resources?: boolean;
  course_short_overview: string;
  class_credits: number;
  caira_level: number | null;
  included_for_caira: boolean;
  mobile_thumbnail_gif: string;
  thumbnail_gif: string;
  trailer_link?: string | null;
  instructor_details: InstructorDetails;
  has_individual_badge: boolean;
  /** Bookmark state for listing-level cards. Reflects the most recent toggle response. */
  added_bookmark?: boolean;
  /**
   * Alternate bookmark field — some list endpoints ship this name instead of
   * `added_bookmark`. UI conditionals fall back to it via `?? is_bookmarked`
   * so a card from either shape renders the correct icon.
   */
  is_bookmarked?: boolean;
  allDataFetched?: boolean;
  /**
   * When this Content was adapted from an `UpcomingPremiere` (webinar feature),
   * the original record is stashed here so the info-click can open the
   * webinar-specific details dialog with the full webinar payload. `unknown`
   * keeps this model free of a cyclic import on `feature.model.ts`; callers
   * (e.g. `Utils.openCourseInfoDialog`) narrow it at the use site.
   */
  _webinar?: unknown;
}

export interface UserFeedbackDetails {
  user_feedback_submitted: boolean;
  user_rating: number;
}

export interface UserAssessmentDetails {
  exam_passes_date: string;
  session_id: number;
  status: string;
}

export interface LearningPathwayInfo {
  pathway_id: number;
  pathway_name: string;
  topic_id: number;
  topic_name: string;
  topic_short_description: string;
}

export interface ContentAbout {
  id: number;
  title: string;
  thumbnail: string;
  horizontal_thumbnail: string;
  square_thumbnail: string | null;
  course_type: string;
  podcast_format: string | null;
  course_category_details: Pick<CourseCategoryDetails, 'id' | 'course_name' | 'course_category'>;
  fields_of_study?: FieldOfStudy[];
  course_short_overview: string;
  class_credits: number;
  mobile_thumbnail_gif: string;
  thumbnail_gif: string;
  trailer_link: string;
  instructor_details: InstructorDetails;
  has_individual_badge: boolean;
  added_bookmark?: boolean;
  /** Alternate API field — see `Content.is_bookmarked`. */
  is_bookmarked?: boolean;
  allDataFetched: boolean;
  total_duration: number;
  no_of_chapters: number;
  learning_pathway_info: LearningPathwayInfo[];
  enable_coming_soon: boolean;
  course_overview: string;
  learning_objectives: string;
  learning_objective_list: string[];
  exam_rules: string;
  document_file: string | null;
  total_assessment_questions: number;
  course_created_date: string;
  course_reviewed_date: string;
  course_updated_date: string;
  topics: string[];
  int_delivery_method: string;
  program_level: string;
  course_expiry: string;
  course_duration: number;
  certification_organisation: string;
  prerequisite_education: string;
  advance_preparation: string;
  pass_percentage: number;
  glossary_doc: string;
  glossary_transcript_text: string;
  trailer_thumbnail: string | null;
  sample_link: string;
  sample_thumbnail: string | null;
  navigation_link: string;
  priority_order: number;
  is_free: boolean;
  free_access_start_date: string;
  free_access_end_date: string | null;
  is_subscription_excluded: boolean;
  is_individually_purchasable: boolean;
  mobile_horizontal_thumbnail: string | null;
  horizontal_trailer_thumbnail: string | null;
  vertical_trailer_thumbnail: string | null;
  status: boolean;
  start_date: string;
  lms_link: string;
  is_test_course: boolean;
  included_for_caira: boolean;
  caira_priority: number;
  course_category: number;
  host_instructor: number;
  allowed_email_domains: string[];
  /**
   * Webinar-only CPE requirements — populated by `upcomingToContentAbout`,
   * `undefined` for masterclass / podcast / nano. Drive the webinar variant of
   * the "To earn CPE credits…" list in `<app-course-about>`.
   */
  webinar_duration?: number;
  no_question_answered?: number;
  attendance_threshold?: number;
}

export interface CPEModeDetails {
  cpe_mode: boolean;
  class_started: string;
  class_ends_on: string;
}

export interface ContentDetails extends Content {
  // Optional to mirror `Content` — the details endpoint sometimes ships
  // `is_bookmarked` in place of `added_bookmark`, and bookmark UIs fall back
  // via `?? is_bookmarked`.
  added_bookmark?: boolean;
  user_feedback_details: UserFeedbackDetails;
  total_duration: number;
  /**
   * BACKEND CONTRACT (pending) — single-chapter courses (micro-learning,
   * AI Lab) should carry the chapter's `video_url` + `chapter_id` and a real
   * `total_duration` here, so a course page can run off this one payload
   * instead of also fetching the `v2/nano-learning/:id/` feed. The
   * micro-learning serializer doesn't send them yet (`total_duration` is 0).
   */
  video_url?: string;
  chapter_id?: number;
  cpe_mode_details: CPEModeDetails | null;
  user_assessment_details: UserAssessmentDetails;
  credit_details: unknown | null;
  is_added_to_cart: boolean;
  price_detail: PriceDetails;
  active_plan: unknown | null;
  last_activity: string | null;
  total_duration_watched: number | null;
  no_of_chapters: number;
  learning_pathway_info: LearningPathwayInfo[];
  is_certificate_eligible: boolean;
  has_additional_resource: boolean;
  has_exercise_files: boolean;
  can_purchase_individually: boolean;
  user_badge: unknown | null;
  enable_coming_soon: boolean;
  course_overview: string;
  learning_objectives: string;
  learning_objective_list: string[];
  exam_rules: string;
  total_assessment_questions: number;
  course_created_date: string;
  course_reviewed_date: string;
  course_updated_date: string;
  topics: string[];
  int_delivery_method: string;
  program_level: string;
  course_expiry: string;
  course_duration: number;
  certification_organisation: string;
  prerequisite_education: string;
  advance_preparation: string;
  pass_percentage: number;
  glossary_doc: string;
  trailer_thumbnail: string | null;
  sample_link: string;
  sample_thumbnail: string | null;
  navigation_link: string;
  is_free: boolean;
  free_access_start_date: string;
  free_access_end_date: string | null;
  is_subscription_excluded: boolean;
  is_individually_purchasable: boolean;
  mobile_horizontal_thumbnail: string | null;
  horizontal_trailer_thumbnail: string | null;
  vertical_trailer_thumbnail: string | null;
  start_date: string;
  lms_link: string;
  is_test_course: boolean;
  included_for_caira: boolean;
  caira_priority: number;
  course_category: number;
  host_instructor: number;
  allowed_email_domains: string[];
  all_classes_completed: boolean;
  chapter_wise_details: ChapterWiseDetails[];
  /** Webinar-only CPE requirements — `undefined` for other course types. */
  webinar_duration?: number;
  no_question_answered?: number;
  attendance_threshold?: number;
}

export interface FinalAssessmentExamResponse {
  status_code: boolean;
  session_id: number;
  questions: QuizQuestion[];
}

/**
 * Normalize the bookmark field on an API payload so the rest of the app can
 * read just `added_bookmark`. List endpoints inconsistently ship either
 * `added_bookmark` OR `is_bookmarked`; this collapses them into
 * `added_bookmark` (preferring the local field when both are set).
 *
 * Safe to call on:
 *   - flat `Content` items
 *   - track items wrapping `{ content: Content[] }` (recurses into `content`)
 *   - `null` / `undefined` (returned as-is)
 *
 * No-op when neither bookmark field is present, so it's cheap to apply
 * defensively at any ingest boundary.
 */
export function normalizeBookmarkField<T>(item: T): T {
  if (item == null || typeof item !== 'object') return item;
  const anyItem = item as Record<string, unknown> & {
    added_bookmark?: boolean;
    is_bookmarked?: boolean;
    content?: unknown[];
  };

  let next: typeof anyItem = anyItem;
  const hasAdded = 'added_bookmark' in anyItem;
  const hasAlt = 'is_bookmarked' in anyItem;
  if (hasAdded || hasAlt) {
    const resolved = anyItem.added_bookmark ?? anyItem.is_bookmarked;
    if (resolved !== undefined && anyItem.added_bookmark !== resolved) {
      next = { ...anyItem, added_bookmark: resolved };
    }
  }

  if (Array.isArray(next.content)) {
    const mapped = next.content.map((c) => normalizeBookmarkField(c));
    if (mapped.some((m, i) => m !== next.content![i])) {
      next = { ...next, content: mapped };
    }
  }

  return next as T;
}
