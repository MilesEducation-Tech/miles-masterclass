import { CairaUuid } from './envelope.model';
import { CardFieldOfStudy, CardInstructor, CourseCard, CourseStatus } from './masterclass.model';
import { SEO_BRAND_DEFAULTS } from '../seo.constants';

/**
 * Wire shapes for course detail — endpoints #4, #14, #16 — and the view models
 * the preserved design system reads.
 *
 * Same contract as `masterclass.model.ts`: the mappers at the bottom are the
 * only place that knows CAIRA's field names, and the view models keep the field
 * names the templates already interpolate, so **no template changed**.
 *
 * #4 is the awkward one. It mixes snake_case aliases with raw Django model
 * field names in a single object (`Masterclass_Course_Name` beside
 * `trailer_video_url`), and assembles the body in three layers: a serializer
 * projection, view-level additions, and constant NASBA boilerplate. All three
 * are modelled below, in that order.
 */

// ---------------------------------------------------------------------------
// #4 · GET Masterclass_Course_Detail/<uuid>/ — auth required
// ---------------------------------------------------------------------------

/** The 6-field instructor object #4 repeats at course level and per chapter. */
export interface DetailInstructor {
  id: CairaUuid;
  CAIRA_Masterclass_Instructor_Name: string | null;
  CAIRA_Masterclass_Instructor_Designation: string | null;
  CAIRA_Masterclass_Instructor_Horizontal_Image_URL: string | null;
  CAIRA_Masterclass_Instructor_Vertical_Image_URL: string | null;
  CAIRA_Masterclass_Instructor_Square_Image_URL: string | null;
}

export interface DetailNamed {
  id: CairaUuid;
  name: string | null;
}

export interface DetailLevel extends DetailNamed {
  level_number: number | null;
}

export interface DetailTrack {
  id: CairaUuid;
  CAIRA_Masterclass_Track_Name: string | null;
  CAIRA_Masterclass_Track_Description: string | null;
  CAIRA_Masterclass_Track_Priority: number | null;
}

export interface DetailTopic {
  id: CairaUuid;
  CAIRA_Masterclass_Topic_Name: string | null;
}

/** ⚠️ Carries an `id`, unlike #2's `course_field_of_study` which has only `name`. */
export interface DetailFieldOfStudy {
  id: CairaUuid;
  CAIRA_Masterclass_Field_Of_Study_Name: string | null;
}

export interface DetailLearningObjective {
  id: CairaUuid;
  title: string | null;
  description: string | null;
  order: number | null;
}

export interface DetailExerciseFile {
  name: string | null;
  url: string | null;
  order: number | null;
}

export interface DetailAiKit {
  id: CairaUuid;
  name: string | null;
  description: string | null;
  icon_url: string | null;
  url: string | null;
}

/** `null` on every key when the chapter is locked or has no progress row. */
export interface DetailChapterProgress {
  is_video_completed: boolean | null;
  is_video_seekable: boolean | null;
  is_mcq_completed: boolean | null;
  is_chapter_completed: boolean | null;
  last_watched_position_seconds: number | null;
  current_watched_duration_seconds: number | null;
  max_watched_duration_seconds: number | null;
  completed_at: string | null;
  quiz_attempted: boolean | null;
}

export interface DetailChapter {
  id: CairaUuid;
  name: string | null;
  mini_description: string | null;
  order: number | null;
  duration_seconds: number | null;
  total_quiz_questions: number | null;
  horizontal_thumbnail_url: string | null;
  vertical_thumbnail_url: string | null;
  square_thumbnail_url: string | null;
  /** Forced `null` when `is_locked`. */
  hls_video_url: string | null;
  /** Forced `null` when `is_locked`. */
  transcript_text: string | null;
  is_locked: boolean;
  show_quiz: boolean;
  user_chapter_progress: DetailChapterProgress | null;
  instructors: DetailInstructor[] | null;
}

/** `null` when the learner is not enrolled. */
export interface DetailEnrollment {
  started_at: string | null;
  expires_at: string | null;
  days_remaining: number | null;
}

export interface DetailRelatedCourse {
  id: CairaUuid;
  name: string | null;
  mini_description: string | null;
  thumbnail_url: string | null;
  /** Absent on `instructor_related_courses[].courses[]`. */
  priority?: number | null;
  duration: string | null;
  cpe_credit: number | null;
  field_of_study: DetailNamed[] | null;
}

export interface DetailInstructorRelatedCourses {
  instructor_id: CairaUuid;
  instructor_name: string | null;
  courses: DetailRelatedCourse[] | null;
}

/**
 * `course_details` — the serializer projection (a), the view-level additions
 * (b) and the constant NASBA boilerplate (c), flattened as the server sends it.
 */
export interface CourseDetailPayload {
  // (a) serializer projection
  id: CairaUuid;
  Masterclass_Course_Name: string | null;
  Masterclass_Course_Description: string | null;
  Masterclass_Course_Mini_Description: string | null;
  Masterclass_Course_Horizontal_Thumbnail_URL: string | null;
  Masterclass_Course_Vertical_Thumbnail_URL: string | null;
  Masterclass_Course_Square_Thumbnail_URL: string | null;
  subject: DetailNamed | null;
  level: DetailLevel[] | null;
  tracks: DetailTrack[] | null;
  topics: DetailTopic[] | null;
  fields_of_study: DetailFieldOfStudy[] | null;
  instructors: DetailInstructor[] | null;
  tags: { id: CairaUuid; CAIRA_Masterclass_Tag_Name: string | null }[] | null;
  skills: { id: CairaUuid; CAIRA_Masterclass_Skill_Name: string | null }[] | null;
  tools:
    | {
        id: CairaUuid;
        CAIRA_Masterclass_Tool_Name: string | null;
        CAIRA_Masterclass_Tool_Icon_URL: string | null;
      }[]
    | null;
  trailer_video_url: string | null;
  trailer_thumbnail_url: string | null;
  masterclass_duration: string | null;
  /** `Glossary_Text` → `Glossary_File.url` → `Glossary_PDF.url` → `null`. */
  glossary_file_url: string | null;
  /** `null` rather than `[]` when there are no files. */
  exercise_file_url: DetailExerciseFile[] | null;
  learning_objectives: DetailLearningObjective[] | null;
  exam_rules: string | null;
  prerequisite_education: string | null;
  advance_preparation: string | null;
  ai_kit: DetailAiKit | null;
  is_course_closed: boolean;
  show_final_assessment: boolean;
  show_feedback: boolean;
  show_credly_badge: boolean;
  show_credit: boolean;
  final_assessment_submitted: boolean;
  feedback_submitted: boolean;
  feedback_average: number | null;
  masterclass_certificate_generated: boolean;
  masterclass_certificate_url: string | null;
  credly_badge_accepted_url: string | null;
  credly_badge_image_url: string | null;
  credly_badge_allocated: boolean;
  credly_badge_status: string | null;
  credly_badge_claimed: boolean;
  credly_assertion_id: string | null;
  enrollment: DetailEnrollment | null;
  chapters: DetailChapter[] | null;
  is_bookmarked: boolean;
  masterclass_reviewed_at: string | null;
  masterclass_content_created_at: string | null;
  masterclass_content_updated_at: string | null;

  // (b) view-level additions
  related_courses: DetailRelatedCourse[] | null;
  instructor_related_courses: DetailInstructorRelatedCourses[] | null;
  /** Verbatim server copy, typos included. Rendered as-is or not at all. */
  course_pop_up_remark: string | null;
  active_in_challenge: boolean;
  Masterclass_Course_CPE_Credit: number | null;
  show_credly_icon: boolean;
  credly_badge_name: string | null;
  masterclass_course_last_user_activity: string | null;
  /** `true` unless the user's enrolled set contains `"CAIRA"`. */
  course_is_locked: boolean;

  // (c) NASBA boilerplate — always present, always constant
  instructional_delivery_method: string | null;
  program_level: string | null;
  /** The `sponser` misspelling is FE-locked upstream. Do not "fix" it. */
  sponser_identification_number: string | null;
  expiration_date: string | null;
}

/** ⚠️ Uses the **string** `"error"` discriminator on failure, not #1–#3's `false`. */
export interface CourseDetailResponse {
  status: true;
  course_details: CourseDetailPayload;
}

// ---------------------------------------------------------------------------
// #14 · GET <uuid>/enrollment/ — bare, no envelope, same 7 keys either way
// ---------------------------------------------------------------------------

/**
 * The **uncached** view of the enrollment window.
 *
 * #4 carries an `enrollment` block saying much the same thing, but #4 is cached
 * server-side per user over a global base key, so after a chapter start creates
 * the 365-day row #4 can keep reporting the stale window for the whole TTL.
 * This endpoint reads through. Where the two disagree, this one wins.
 */
export interface EnrollmentResponse {
  course_id: CairaUuid;
  is_enrolled: boolean;
  /** Hardcoded `false` when not enrolled, even if a completion row says otherwise. */
  is_course_closed: boolean;
  started_at: string | null;
  expires_at: string | null;
  /** `null` when the course is closed; otherwise `max(0, days to expiry)`. */
  days_remaining: number | null;
  is_expired: boolean;
}

// ---------------------------------------------------------------------------
// #15 · POST <uuid>/bookmark/ — a pure toggle; any body sent is ignored
// ---------------------------------------------------------------------------

export interface BookmarkToggleResponse {
  status: 'success';
  message?: string;
  bookmarked: boolean;
}

// ---------------------------------------------------------------------------
// #16 · GET instructor/<uuid>/ — un-enveloped, the serializer dict IS the body
// ---------------------------------------------------------------------------

/**
 * ponytail: #16's field list lives in a serializer outside the documented
 * module, so the names below are **inferred**, not captured. What the reference
 * does guarantee: a full profile with bio and video, and a prefetched
 * `social_media_links` collection rather than the four flat `*_link` fields the
 * old Django API returned. `toInstructorProfile` therefore reads both the
 * CAIRA-style long names (#4 uses them for its embedded instructors) and the
 * short ones, and flattens the collection by platform. Replace the guesswork
 * with a capture in `docs/caira-contracts/` (P0 item 3) — the mapper is the
 * only thing that has to change.
 */
export interface InstructorSocialLink {
  platform?: string | null;
  name?: string | null;
  url?: string | null;
  link?: string | null;
}

export interface InstructorDetailResponse {
  id: CairaUuid;
  name?: string | null;
  CAIRA_Masterclass_Instructor_Name?: string | null;
  designation?: string | null;
  CAIRA_Masterclass_Instructor_Designation?: string | null;
  about_me?: string | null;
  bio?: string | null;
  promo_video?: string | null;
  promo_video_url?: string | null;
  profile_image?: string | null;
  CAIRA_Masterclass_Instructor_Square_Image_URL?: string | null;
  horizontal_thumbnail?: string | null;
  CAIRA_Masterclass_Instructor_Horizontal_Image_URL?: string | null;
  social_media_links?: InstructorSocialLink[] | null;
}

// ---------------------------------------------------------------------------
// View models — the design system's contract, not CAIRA's
// ---------------------------------------------------------------------------

/** What `app-course-chapter-list` reads off each chapter. */
export interface ChapterView {
  id: CairaUuid;
  chapter_name: string;
  description: string;
  /** Never `''` and never `null` — `course-chapter-list.html` binds `ngSrc` unguarded. */
  chapter_thumbnail: string;
  /** Seconds. The template divides by it, so a missing duration must not be 0. */
  video_duration: number;
  /**
   * `is_seekable` is the **server's** seek verdict (`Is_Video_Seekable`), not a
   * rule the client re-derives: it flips at `Max_Watched >= duration * 0.95`
   * and is forced `true` once the course is closed.
   */
  play_history: { time_status: number; is_completed: boolean; is_seekable: boolean } | null;
  quiz_details: { overall_chapter_questions: number };
  /** Carried through for the chapter player (P4), unread by the list. */
  is_locked: boolean;
  show_quiz: boolean;
  hls_video_url: string | null;
  transcript_text: string | null;
}

export interface LearningPathway {
  pathway_id: CairaUuid;
  pathway_name: string;
  topic_name: string;
}

/** One "More by <Instructor>" carousel on the course detail page. */
export interface InstructorCarousel {
  instructorId: CairaUuid;
  fullName: string;
  cards: CourseCard[];
}

/** What `app-instructor-hero` and the instructor detail page read. */
export interface InstructorProfile {
  id: CairaUuid;
  first_name: string;
  last_name: string;
  designation: string;
  about_me: string;
  promo_video: string | null;
  profile_image: string | null;
  horizontal_thumbnail: string | null;
  linkedin_link: string | null;
  youtube_link: string | null;
  instagram_link: string | null;
  facebook_link: string | null;
}

/**
 * The course-detail view model — the union of every key
 * `masterclass-course-hero`, `course-about`, `course-resources` and
 * `course-seo-config` read off `courseDetails()`.
 *
 * Keys with no CAIRA counterpart are typed and defaulted rather than omitted:
 * the templates read them unguarded inside `@if` branches, and a missing key on
 * a `null`-safe path still costs a runtime error the moment a branch flips.
 * They are grouped and marked below.
 */
/**
 * Where the learner stands on the final assessment. `null` means they have not
 * submitted one. Derived — #4 reports neither value directly, see
 * `assessmentStatus()`.
 */
export type AssessmentStatus = 'Exam_Passed' | 'Retake' | null;

export interface CourseDetailCard {
  id: CairaUuid;
  title: string;
  course_short_overview: string;
  course_overview: string;

  /**
   * The three still images are **always a real URL**. `course-about.html` and
   * the podcast hero bind them straight into `ngSrc` with no `@if`, and both
   * `''` and `null` are render failures there (NG02952) — so the mapper falls
   * back to the course's other artwork and finally to the brand image, exactly
   * as it does for a chapter poster.
   */
  thumbnail: string;
  horizontal_thumbnail: string;
  square_thumbnail: string;
  /** Motion asset, `null` when the course has no trailer — `VideoPoster` allows it. */
  thumbnail_gif: string | null;
  trailer_link: string | null;
  /** No CAIRA counterpart — #4 serves one trailer. `openVideoDialog` toasts. */
  sample_link: string | null;

  fields_of_study: CardFieldOfStudy[];
  class_credits: number;
  caira_level: number | null;
  included_for_caira: boolean;
  has_individual_badge: boolean;
  added_bookmark: boolean;
  course_status: CourseStatus;
  instructor_details: CardInstructor;

  topics: string[];
  learning_objective_list: string[];
  learning_pathway_info: LearningPathway[];
  no_of_chapters: number;
  /** Minutes — `course-about` splits it into hours + mins. */
  course_duration: number;
  /** Seconds — `course-about` runs it through `DurationPipe`. */
  total_duration: number;

  int_delivery_method: string;
  program_level: string;
  prerequisite_education: string;
  advance_preparation: string;
  exam_rules: string;
  course_created_date: string | null;
  course_updated_date: string | null;
  course_reviewed_date: string | null;

  /** No CAIRA counterpart — there is no course-navigation video. */
  navigation_link: string | null;
  glossary_doc: string | null;
  has_exercise_files: boolean;
  has_additional_resource: boolean;
  exercise_files: DetailExerciseFile[];
  ai_kit: DetailAiKit | null;

  /**
   * ponytail: `null` on purpose. CAIRA has **no preview/CPE mode** — access is
   * decided server-side per chapter (`is_locked`, `show_quiz`) rather than by a
   * client-held mode flag. The hero's mode pill and toggle are behind
   * `@if (courseDetails.cpe_mode_details)`, so `null` hides both instead of
   * rendering a switch that cannot switch anything.
   */
  cpe_mode_details: { cpe_mode: boolean } | null;

  /**
   * `status` is the only key. CAIRA identifies an attempt by
   * `(user, course, attempt_number)` — there is no session id to carry, and the
   * Django-era `session_id` that used to sit here was pinned `null`.
   */
  user_assessment_details: { status: AssessmentStatus };
  user_feedback_details: { user_feedback_submitted: boolean; user_rating: number | null };
  all_classes_completed: boolean;
  show_feedback: boolean;
  show_credit: boolean;
  certificate_url: string | null;
  credly_badge_image_url: string | null;
  credly_badge_accepted_url: string | null;
  credly_assertion_id: string | null;

  /** Fresh from #14 where it has landed, else #4's cached block. */
  enrollment: DetailEnrollment | null;
  is_course_closed: boolean;
  is_expired: boolean;
  /** `true` unless the learner's enrolled set contains `"CAIRA"`. */
  course_is_locked: boolean;
  course_pop_up_remark: string | null;
  active_in_challenge: boolean;

  /**
   * ponytail: CAIRA has no payment, cart or subscription model at all — access
   * is `User.enrolled` tag membership, surfaced as `course_is_locked`. These
   * six keys stay so the pricing branch in the hero and the purchase gates in
   * `Utils.openCertificateDownloadDialog` keep compiling and stay dormant:
   * every one of them is falsy, so no price block renders. Tracked as a gap.
   */
  is_free: boolean;
  /** Zeroed, not `null`: the hero reads its three keys inside the pricing branch. */
  price_detail: { currency_symbol: string; price: number; selling_price: number };
  can_purchase_individually: boolean;
  is_subscription_excluded: boolean;
  active_plan: boolean;
  is_added_to_cart: boolean;
  /** Read by `Utils.openCertificateDownloadDialog`; Credly data lives in P6. */
  user_badge: unknown;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/** `''` counts as missing — binding `ngSrc=""` throws NG02952. */
function img(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v || null;
}

function text(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function splitName(full: string | null | undefined): { first_name: string; last_name: string } {
  const parts = text(full).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

/**
 * #4's instructors → the card instructor object.
 *
 * `slider.html` and `course-about.html` read `instructor_details.first_name`
 * **unguarded**, so this always returns an object. `designation` and
 * `horizontal_thumbnail` ride along because `course-about` renders both.
 */
function toDetailInstructor(list: DetailInstructor[] | null | undefined): CardInstructor {
  const people = (list ?? []).map((i) => ({
    id: i.id,
    ...splitName(i.CAIRA_Masterclass_Instructor_Name),
    designation: text(i.CAIRA_Masterclass_Instructor_Designation),
    horizontal_thumbnail: img(i.CAIRA_Masterclass_Instructor_Horizontal_Image_URL),
  }));
  if (people.length === 0) {
    return { id: null, first_name: '', last_name: '', other_instructors: [] };
  }
  const [lead, ...rest] = people;
  return { ...lead, other_instructors: rest };
}

/**
 * CAIRA reports one credit figure for the whole course, so the entire
 * allocation goes on the first field of study and zero on the rest — otherwise
 * `TotalCpeCreditsPipe`, which sums the array, reads **0 CPE**. Same rule as
 * `toCardFields` in `masterclass.model.ts`.
 */
function toDetailFields(list: { name: string | null }[], totalCredits: number): CardFieldOfStudy[] {
  const names = list.map((f) => text(f.name)).filter(Boolean);
  return names.map((name, i) => ({ name, cpe_credits: i === 0 ? totalCredits : 0 }));
}

/**
 * A chapter's poster.
 *
 * `course-chapter-list.html` binds `[ngSrc]` with no `@if`, so an empty or
 * missing URL is a hard render failure (NG02952), not a blank tile. Falls back
 * to the course artwork and finally to the brand image — every step is a real
 * URL.
 */
function chapterThumbnail(chapter: DetailChapter, courseThumbnail: string | null): string {
  return (
    img(chapter.horizontal_thumbnail_url) ??
    img(chapter.square_thumbnail_url) ??
    img(chapter.vertical_thumbnail_url) ??
    courseThumbnail ??
    SEO_BRAND_DEFAULTS.fallbackImage
  );
}

export function toChapterViews(payload: CourseDetailPayload): ChapterView[] {
  const courseThumbnail =
    img(payload.Masterclass_Course_Horizontal_Thumbnail_URL) ??
    img(payload.Masterclass_Course_Square_Thumbnail_URL);

  return [...(payload.chapters ?? [])]
    .sort((a, b) => num(a.order) - num(b.order))
    .map((chapter) => {
      const progress = chapter.user_chapter_progress;
      return {
        id: chapter.id,
        chapter_name: text(chapter.name),
        description: text(chapter.mini_description),
        chapter_thumbnail: chapterThumbnail(chapter, courseThumbnail),
        video_duration: num(chapter.duration_seconds),
        // Every key of `user_chapter_progress` is null on a locked chapter, so
        // "has a progress row" means "has a watched position", not "is present".
        play_history:
          progress && progress.last_watched_position_seconds !== null
            ? {
                time_status: num(progress.last_watched_position_seconds),
                is_completed: progress.is_chapter_completed === true,
                is_seekable: progress.is_video_seekable === true,
              }
            : null,
        quiz_details: { overall_chapter_questions: num(chapter.total_quiz_questions) },
        is_locked: chapter.is_locked === true,
        show_quiz: chapter.show_quiz === true,
        hls_video_url: chapter.hls_video_url,
        transcript_text: chapter.transcript_text,
      };
    });
}

/** #4's related-course rows → the card the rails already render. */
export function relatedToCard(item: DetailRelatedCourse): CourseCard {
  const thumb = img(item.thumbnail_url);
  const credits = num(item.cpe_credit);
  return {
    id: item.id,
    title: text(item.name),
    course_short_overview: text(item.mini_description),
    thumbnail: thumb,
    horizontal_thumbnail: thumb,
    square_thumbnail: thumb,
    thumbnail_gif: null,
    mobile_thumbnail_gif: null,
    trailer_link: null,
    class_credits: credits,
    fields_of_study: toDetailFields(item.field_of_study ?? [], credits),
    instructor_details: { id: null, first_name: '', last_name: '', other_instructors: [] },
    caira_level: null,
    included_for_caira: true,
    has_individual_badge: false,
    // No list endpoint reports bookmark state, so a rail card always renders
    // unbookmarked until the learner opens the course. See `CourseDetail`.
    added_bookmark: false,
    has_additional_resources: false,
    course_status: CourseStatus.NOT_STARTED,
  };
}

/** One carousel per instructor, dropping the current course and empty groups. */
export function toInstructorCarousels(
  payload: CourseDetailPayload,
  currentCourseId: CairaUuid,
): InstructorCarousel[] {
  const out: InstructorCarousel[] = [];
  for (const group of payload.instructor_related_courses ?? []) {
    const cards = (group.courses ?? []).filter((c) => c.id !== currentCourseId).map(relatedToCard);
    if (!cards.length) continue;
    out.push({
      instructorId: group.instructor_id,
      fullName: text(group.instructor_name) || 'Instructor',
      cards,
    });
  }
  return out;
}

/**
 * `masterclass_duration` is a free-text string on the wire (`"4h 20m"`,
 * `"260"`, sometimes empty), so the chapter durations are the reliable source.
 * Returns seconds; `course-about` derives its hours/minutes split from this.
 */
function totalDurationSeconds(payload: CourseDetailPayload): number {
  return (payload.chapters ?? []).reduce((sum, c) => sum + num(c.duration_seconds), 0);
}

/**
 * Assessment status in the hero's vocabulary.
 *
 * The hero branches on `'Exam_Passed'` (show the rating / feedback CTA) and
 * `'Retake'` (relabel the assessment button). #4 exposes neither directly, but
 * the certificate is only generated on a pass, and `show_feedback` only opens
 * after one — so a submitted assessment without either means a failed attempt.
 */
function assessmentStatus(payload: CourseDetailPayload): AssessmentStatus {
  if (!payload.final_assessment_submitted) return null;
  if (payload.masterclass_certificate_generated || payload.show_feedback) return 'Exam_Passed';
  return 'Retake';
}

/**
 * #4 (+ #14 where it has answered) → the view model every course-detail
 * component reads.
 *
 * `enrollment` prefers #14: #4 is cached server-side per user over a global
 * base key, so its copy can lag a chapter start by the whole TTL.
 */
export function toCourseDetailCard(
  payload: CourseDetailPayload,
  enrollment?: EnrollmentResponse,
): CourseDetailCard {
  const horizontal = img(payload.Masterclass_Course_Horizontal_Thumbnail_URL);
  const square = img(payload.Masterclass_Course_Square_Thumbnail_URL);
  const credits = num(payload.Masterclass_Course_CPE_Credit);
  const chapters = payload.chapters ?? [];
  const seconds = totalDurationSeconds(payload);
  const isClosed = enrollment?.is_course_closed ?? payload.is_course_closed === true;
  const isEnrolled = enrollment ? enrollment.is_enrolled : !!payload.enrollment;

  return {
    id: payload.id,
    title: text(payload.Masterclass_Course_Name),
    course_short_overview: text(payload.Masterclass_Course_Mini_Description),
    course_overview: text(payload.Masterclass_Course_Description),

    thumbnail: horizontal ?? square ?? SEO_BRAND_DEFAULTS.fallbackImage,
    horizontal_thumbnail: horizontal ?? square ?? SEO_BRAND_DEFAULTS.fallbackImage,
    square_thumbnail: square ?? horizontal ?? SEO_BRAND_DEFAULTS.fallbackImage,
    // The hero's `app-video-poster` plays this over the still. CAIRA has no
    // separate looping GIF, so the trailer is the motion source.
    thumbnail_gif: img(payload.trailer_video_url),
    trailer_link: img(payload.trailer_video_url),
    sample_link: null,

    fields_of_study: toDetailFields(
      (payload.fields_of_study ?? []).map((f) => ({
        name: f.CAIRA_Masterclass_Field_Of_Study_Name,
      })),
      credits,
    ),
    class_credits: credits,
    caira_level: payload.level?.[0]?.level_number ?? null,
    included_for_caira: true,
    has_individual_badge: payload.show_credly_icon === true || payload.show_credly_badge === true,
    added_bookmark: payload.is_bookmarked === true,
    course_status: isClosed
      ? CourseStatus.CLOSED
      : isEnrolled
        ? CourseStatus.IN_PROGRESS
        : CourseStatus.NOT_STARTED,
    instructor_details: toDetailInstructor(payload.instructors),

    topics: (payload.topics ?? []).map((t) => text(t.CAIRA_Masterclass_Topic_Name)).filter(Boolean),
    learning_objective_list: [...(payload.learning_objectives ?? [])]
      .sort((a, b) => num(a.order) - num(b.order))
      .map((o) => text(o.title) || text(o.description))
      .filter(Boolean),
    // Tracks are CAIRA's learning-pathway analogue: a named grouping a course
    // belongs to, with the subject as its topic line.
    learning_pathway_info: [...(payload.tracks ?? [])]
      .sort(
        (a, b) => num(a.CAIRA_Masterclass_Track_Priority) - num(b.CAIRA_Masterclass_Track_Priority),
      )
      .map((t) => ({
        pathway_id: t.id,
        pathway_name: text(t.CAIRA_Masterclass_Track_Name),
        topic_name: text(t.CAIRA_Masterclass_Track_Description) || text(payload.subject?.name),
      })),
    no_of_chapters: chapters.length,
    course_duration: Math.floor(seconds / 60),
    total_duration: seconds,

    int_delivery_method: text(payload.instructional_delivery_method),
    program_level: text(payload.program_level),
    prerequisite_education: text(payload.prerequisite_education),
    advance_preparation: text(payload.advance_preparation),
    exam_rules: text(payload.exam_rules),
    course_created_date: payload.masterclass_content_created_at,
    course_updated_date: payload.masterclass_content_updated_at,
    course_reviewed_date: payload.masterclass_reviewed_at,

    navigation_link: null,
    glossary_doc: img(payload.glossary_file_url),
    has_exercise_files: (payload.exercise_file_url ?? []).length > 0,
    has_additional_resource: !!payload.ai_kit,
    exercise_files: [...(payload.exercise_file_url ?? [])].sort(
      (a, b) => num(a.order) - num(b.order),
    ),
    ai_kit: payload.ai_kit,

    cpe_mode_details: null,

    user_assessment_details: { status: assessmentStatus(payload) },
    user_feedback_details: {
      user_feedback_submitted: payload.feedback_submitted === true,
      user_rating: payload.feedback_average,
    },
    all_classes_completed: payload.show_final_assessment === true,
    show_feedback: payload.show_feedback === true,
    show_credit: payload.show_credit === true,
    certificate_url: payload.masterclass_certificate_url,
    credly_badge_image_url: payload.credly_badge_image_url,
    credly_badge_accepted_url: payload.credly_badge_accepted_url,
    credly_assertion_id: payload.credly_assertion_id,

    enrollment: enrollment
      ? {
          started_at: enrollment.started_at,
          expires_at: enrollment.expires_at,
          days_remaining: enrollment.days_remaining,
        }
      : payload.enrollment,
    is_course_closed: isClosed,
    is_expired: enrollment?.is_expired === true,
    course_is_locked: payload.course_is_locked === true,
    course_pop_up_remark: payload.course_pop_up_remark,
    active_in_challenge: payload.active_in_challenge === true,

    is_free: false,
    price_detail: { currency_symbol: '', price: 0, selling_price: 0 },
    can_purchase_individually: false,
    is_subscription_excluded: false,
    active_plan: false,
    is_added_to_cart: false,
    user_badge: null,
  };
}

/** Percentage of chapters completed, for the hero's progress bar. */
export function courseProgressPercent(chapters: ChapterView[]): number {
  if (!chapters.length) return 0;
  const done = chapters.filter((c) => c.play_history?.is_completed).length;
  return Math.round((done / chapters.length) * 100);
}

/**
 * #16 → the instructor profile the hero renders.
 *
 * Reads long and short field names for every value, and flattens
 * `social_media_links` into the four `*_link` fields the hero binds. Matching is
 * a substring test on the platform label because the collection's own
 * vocabulary is not documented — see `InstructorDetailResponse`.
 */
export function toInstructorProfile(body: InstructorDetailResponse): InstructorProfile {
  const name = body.name ?? body.CAIRA_Masterclass_Instructor_Name;
  const socials = body.social_media_links ?? [];
  const linkFor = (platform: string): string | null => {
    const hit = socials.find((s) =>
      `${s.platform ?? ''} ${s.name ?? ''}`.toLowerCase().includes(platform),
    );
    return img(hit?.url ?? hit?.link);
  };

  return {
    id: body.id,
    ...splitName(name),
    designation: text(body.designation ?? body.CAIRA_Masterclass_Instructor_Designation),
    about_me: text(body.about_me ?? body.bio),
    promo_video: img(body.promo_video ?? body.promo_video_url),
    profile_image: img(body.profile_image ?? body.CAIRA_Masterclass_Instructor_Square_Image_URL),
    horizontal_thumbnail: img(
      body.horizontal_thumbnail ?? body.CAIRA_Masterclass_Instructor_Horizontal_Image_URL,
    ),
    linkedin_link: linkFor('linkedin'),
    youtube_link: linkFor('youtube'),
    instagram_link: linkFor('instagram'),
    facebook_link: linkFor('facebook'),
  };
}
