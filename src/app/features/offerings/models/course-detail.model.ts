/**
 * Types for one course on the offerings' web API (`web-api/v1/<offering>/`), as
 * `CourseDetailFacade` reads them. These are the keys the pages READ, not a
 * mirror of the payload, and they replace the legacy `ContentDetails` for the
 * pages on this API, which addresses courses by UUID.
 *
 * Only masterclass has the web route so far, so the payload types are the
 * masterclass contract, `masterclass_*` keys included. Another offering's
 * payload joins here when its route exists.
 *
 * `course-detail/` checked against live UAT on 2026-10-07, all 64 masterclass
 * courses, `pre_login`. The Postman export only has placeholders for it
 * (`<**detail>`); the live keys win. Two things the payload does NOT carry: a
 * course slug and a chapter slug — URLs take them from the route and from the
 * chapter name.
 */

import { HttpErrorResponse } from '@angular/common/http';
import { MasterclassFieldOfStudy } from '@core/models/masterclass-home.model';
import { RouteConfig } from '@core/models/http.model';
import { QuizAnswer } from '@features/offerings/models/chapter-quiz.model';
import { AssessmentSubmitBody } from '@features/offerings/models/final-assessment.model';
import {
  contractError,
  isBool,
  isNum,
  isNumOrNull,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@features/offerings/utils/contract-guards';

/**
 * The offerings `CourseDetailFacade` serves: those with a web `course-detail/`
 * route. Podcast (`v2/:course_type/details/`) and micro-learning
 * (`v2/nano-learning/`) join when the backend ships theirs.
 */
export type CourseOffering = 'masterclass';

/** What differs per offering: its routes, its URL segment and its analytics name. */
export interface CourseDetailApi {
  /** `GET <url><uuid>/?login_type=`: the course, both sides of login. */
  courseDetail: string;
  /** `GET ?slug=`: read only to turn an old numeric link's slug into a UUID. */
  aboutCourse: string;
  /** `POST`, `:id` is the course UUID: toggles the learner's bookmark. */
  bookmark: RouteConfig<void, unknown>;
  /** `POST`, `:id` is the chapter UUID: begins a chapter, creating the enrolment if needed. */
  chapterStart: RouteConfig<void, unknown>;
  /** `POST`, `:id` is the course UUID: saves a chapter's progress, answers the whole course's. */
  courseProgressUpdate: RouteConfig<CourseProgressUpdate, unknown>;
  /** `GET <url><chapter uuid>/`: the chapter's quiz for this learner. */
  quizQuestions: string;
  /** `POST`, `:id` is the chapter UUID: grades one answer. */
  quizSubmit: RouteConfig<QuizAnswer, unknown>;
  /** `POST`, `:id` is the course UUID: draws the final assessment's sitting, or resumes the open one. */
  assessmentStart: RouteConfig<void, unknown>;
  /** `GET <url><course uuid>/?session_id=`: a sitting's paper again. */
  assessmentQuestions: string;
  /** `POST`, `:id` is the course UUID: scores a sitting. */
  assessmentSubmit: RouteConfig<AssessmentSubmitBody, unknown>;
  /** The course page's URL segment: `/:country/:profession/<segment>/:id/:slug`. */
  urlSegment: string;
}

/** A course's id and slug, as the route (or a card) carries them. */
export interface CourseDetailParams {
  courseId: string | undefined;
  slug: string | undefined;
}

/** One side of login; `course-detail/` requires it and serves a different page for each. */
export type CourseLoginType = 'pre_login' | 'post_login';

/** A CAIRA level the course belongs to; the badge shows `level_number`. */
export interface MasterclassLevel {
  id: string;
  name: string;
  level_number: number;
}

export interface MasterclassInstructor {
  id: string;
  name: string;
  designation: string;
  horizontal_image_url: string | null;
}

export interface MasterclassLearningObjective {
  id: string;
  title: string;
}

export interface MasterclassTopic {
  id: string;
  name: string;
}

/**
 * The learner's progress on one chapter, as the chapter player reads it. Every
 * field is `null` until the learner starts the chapter, and always pre-login.
 */
export interface MasterclassChapterProgress {
  is_video_completed: boolean | null;
  /** CPE mode only lets the learner seek once this is true. */
  is_video_seekable: boolean | null;
  /** The chapter quiz. The server's ladder opens the next chapter only after it. */
  is_mcq_completed: boolean | null;
  /** The whole chapter is done, as the server decides it (the video, plus the quiz in CPE mode). */
  is_chapter_completed: boolean | null;
  last_watched_position_seconds: number | null;
  /** The furthest point the server has been told was played. */
  max_watched_duration_seconds: number | null;
}

/** One chapter of the course; the list shows them in the API's `order`. */
export interface MasterclassChapter {
  id: string;
  name: string;
  mini_description: string | null;
  order: number;
  duration_seconds: number;
  total_quiz_questions: number;
  horizontal_thumbnail_url: string | null;
  /** The stream. `null` whenever the course is locked to the caller, so always pre-login. */
  hls_video_url: string | null;
  /** HTML from the admin; empty on a chapter the ladder hasn't unlocked. */
  transcript_text: string | null;
  /** The server's chapter ladder: a locked chapter can't be started. */
  is_locked: boolean;
  /** The chapter's quiz is open to the learner (after its video, in CPE mode). */
  show_quiz: boolean;
  user_chapter_progress: MasterclassChapterProgress;
}

/**
 * How the learner takes the course, stored on their enrolment: `cpe` earns
 * credit and gates seeking, `preview` is video only. `null` until they choose.
 */
export type CourseMode = 'cpe' | 'preview';

/** A chapter with the URL slug the API doesn't send, made from its name. */
export type MasterclassChapterLink = MasterclassChapter & { slug: string };

/**
 * The chapter's video is done, which is what the course page's "Completed" badge
 * shows (as the old list did). In CPE mode the quiz can still be open after it.
 */
export function isChapterWatched(chapter: MasterclassChapter): boolean {
  const progress = chapter.user_chapter_progress;
  return !!progress.is_video_completed || !!progress.is_chapter_completed;
}

/**
 * Done as far as the chapter ladder goes: the server's `is_chapter_completed`
 * (the video, plus the quiz in CPE mode). Outside CPE mode there is no quiz, so
 * the video alone counts there too.
 */
export function isChapterDone(chapter: MasterclassChapter, cpeMode: boolean): boolean {
  const progress = chapter.user_chapter_progress;
  return !!progress.is_chapter_completed || (!cpeMode && !!progress.is_video_completed);
}

/** How much of the chapter's video the server has been told was watched, as a whole 0–100. */
export function watchedPercent(chapter: MasterclassChapter): number {
  const watched = chapter.user_chapter_progress.max_watched_duration_seconds ?? 0;
  if (chapter.duration_seconds <= 0 || watched <= 0) return 0;
  return Math.min(100, Math.round((watched / chapter.duration_seconds) * 100));
}

/** The chapter in the URL and its neighbours, in the API's `order`. */
export interface ChapterNavigation {
  /** Position of `current` in the list; `-1` when the URL names no chapter of this course. */
  index: number;
  previous: MasterclassChapterLink | null;
  current: MasterclassChapterLink | null;
  next: MasterclassChapterLink | null;
}

export interface MasterclassExerciseFile {
  name: string;
  order: number;
  url: string;
}

export interface MasterclassAiKit {
  id: string;
  name: string;
  url: string;
}

/** `miscellaneous_data`: the Resource section's content. */
export interface MasterclassResources {
  /** HTML, authored in the admin; shown in the glossary dialog. */
  glossary: string | null;
  course_navigation_video_url: string | null;
  exercise_files: MasterclassExerciseFile[] | null;
  ai_kit: MasterclassAiKit | null;
}

/** A course card in the Related and "More by" rails. */
export interface MasterclassRelatedCourse {
  id: string;
  name: string;
  mini_description: string;
  thumbnail_url: string | null;
  total_cpe_credits: number;
  field_of_study: MasterclassFieldOfStudy[];
}

export interface MasterclassInstructorCourses {
  instructor_id: string;
  instructor_name: string;
  courses: MasterclassRelatedCourse[];
}

/** One rail of the Related section, ready to render: a heading and linkable cards. */
export interface MasterclassRelatedRail {
  id: string;
  heading: string;
  courses: (MasterclassRelatedCourse & { slug: string })[];
}

/** The NASBA block's dates (ISO 8601). */
export interface MasterclassNasbaSection {
  created_on: string | null;
  reviewed_on: string | null;
  updated_on: string | null;
}

/** `course_details` of `course-detail/`, its chapters unwrapped from their paginated block. */
export interface MasterclassCourseDetail {
  id: string;
  name: string;
  mini_description: string;
  description: string;
  horizontal_thumbnail_url: string | null;
  /**
   * The hero's poster, before the trailer starts. Was `trailer_thumbnail_url`
   * until UAT renamed it on 2026-10-14 (Postman not updated yet).
   */
  trailer_horizontal_thumbnail_image_url: string | null;
  /**
   * An HLS (`.m3u8`) stream on every UAT course, so it needs the video.js
   * player. Was `trailer_video_url` until the same rename.
   */
  horizontal_trailer_url: string | null;
  sample_video_url: string | null;
  fields_of_study: MasterclassFieldOfStudy[];
  /** The course total, summed by the API. Render it as sent; never re-sum. */
  total_cpe_credits: number;
  level: MasterclassLevel[];
  show_credly_icon: boolean;
  instructors: MasterclassInstructor[];
  learning_objectives: MasterclassLearningObjective[];
  topics: MasterclassTopic[];
  /** The course duration, preformatted ("3 hours"). Not the video length. */
  masterclass_duration: string;
  /** The video length: the sum of the chapter videos, in seconds. */
  masterclass_duration_seconds: number;
  program_level: string | null;
  instructional_delivery_method: string;
  prerequisite_education: string;
  advance_preparation: string;
  /** Spelled `sponser` by the API. */
  sponser_identification_number: string;
  /** Preformatted text, e.g. "1 year from the start of the course/upon subscription expiry". */
  expiration_date: string;
  nasba_section: MasterclassNasbaSection;
  chapters: MasterclassChapter[];
  miscellaneous_data: MasterclassResources;
  related_courses: MasterclassRelatedCourse[];
  instructor_related_courses: MasterclassInstructorCourses[];
  /** The learner's own state: always `false` pre-login. */
  is_bookmarked: boolean;
  /** Set once the learner's certificate exists; `null` pre-login and until then. */
  masterclass_certificate_url: string | null;
  /** No entitlement (always pre-login): every `hls_video_url` is stripped. */
  course_is_locked: boolean;
  course_mode: CourseMode | null;
  /** The server's own words for why the course is locked, when it has some. */
  course_pop_up_remark: string | null;
  /** The final assessment's QAS rules, one per line, shown before a sitting starts. */
  exam_rules: string;
  /**
   * Whether the learner may sit the final assessment now. The server computes
   * it (CPE mode, every chapter and its quiz done, not yet passed), so no
   * client derives it; it is `false` pre-login and in Preview mode.
   */
  show_final_assessment: boolean;
}

/** `chapter-start/`'s `data`, as far as the chapter page reads it. */
export interface ChapterStartResult {
  /**
   * The 365-day enrolment window had expired: the server already reset the
   * learner's progress and started a new one. A state to show, not an error.
   */
  reset_required: boolean;
}

/**
 * `course-progress-update/`'s body, single-chapter form. Strict: any other key
 * is a 400. Whole seconds, because the server's fields are integers.
 */
export interface CourseProgressUpdate {
  chapter_id: string;
  /** Where the playhead is: the resume point. */
  last_watched_position_seconds: number;
  /** The edge of what has been watched straight through; skipping ahead doesn't move it. */
  max_watched_duration_seconds: number;
}

/** One chapter of `course-progress-update/`'s answer, as far as the page reads it. */
export interface CourseProgressChapter {
  chapter_id: string;
  is_locked: boolean;
  show_quiz: boolean;
  progress: MasterclassChapterProgress;
}

/** `course-progress-update/`'s `data`: the whole course's progress after the write. */
export interface CourseProgress {
  /** The enrolment window had expired and was reset, as on `chapter-start/`. */
  reset_required: boolean;
  chapters: CourseProgressChapter[];
}

/**
 * What the chapter page knows about the chapter on screen between saves. The
 * furthest point only grows while the video plays forward, so a seek ahead is
 * never reported as watched.
 */
export interface ChapterProgressTracker {
  chapterId: string;
  /** The playhead, in seconds. */
  position: number;
  /**
   * The edge of what has been watched straight through, in seconds: play moves
   * it only when it starts at or before it, so a skipped stretch never counts.
   */
  furthest: number;
  /** The previous `timeupdate`'s time, to tell playing from seeking. */
  lastTime: number | null;
  /** Seconds played since the last save. */
  sincePlayedSave: number;
}

/** A refused chapter step (`chapter-start/`, and the course-detail `mode=` switch). */
export interface CourseStepRefusal {
  status: number;
  /** `chapter_locked`, `caira_access_required`, `course_mode_locked`…; `null` when the body has none. */
  reason: string | null;
  /** The server's own message, when it sent one. */
  message: string | null;
}

// ---- Trust boundary --------------------------------------------------------

/** The paginated block `chapters` arrives in; only `results` is read. */
interface ApiPage<T> {
  results: T[];
}

type ApiCourseDetail = Omit<MasterclassCourseDetail, 'chapters'> & {
  chapters: ApiPage<MasterclassChapter>;
};

function isFieldOfStudy(v: unknown): v is MasterclassFieldOfStudy {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['cpe_credit']);
}

function isLevel(v: unknown): v is MasterclassLevel {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['level_number']);
}

function isInstructor(v: unknown): v is MasterclassInstructor {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStr(v['designation']) &&
    isStrOrNull(v['horizontal_image_url'])
  );
}

function isLearningObjective(v: unknown): v is MasterclassLearningObjective {
  return isObject(v) && isStr(v['id']) && isStr(v['title']);
}

function isTopic(v: unknown): v is MasterclassTopic {
  return isObject(v) && isStr(v['id']) && isStr(v['name']);
}

const isBoolOrNull = (v: unknown): v is boolean | null => v === null || isBool(v);

function isChapterProgress(v: unknown): v is MasterclassChapterProgress {
  return (
    isObject(v) &&
    isBoolOrNull(v['is_video_completed']) &&
    isBoolOrNull(v['is_video_seekable']) &&
    isBoolOrNull(v['is_mcq_completed']) &&
    isBoolOrNull(v['is_chapter_completed']) &&
    isNumOrNull(v['last_watched_position_seconds']) &&
    isNumOrNull(v['max_watched_duration_seconds'])
  );
}

function isProgressChapter(v: unknown): v is CourseProgressChapter {
  return (
    isObject(v) &&
    isStr(v['chapter_id']) &&
    isBool(v['is_locked']) &&
    isBool(v['show_quiz']) &&
    isChapterProgress(v['progress'])
  );
}

function isChapter(v: unknown): v is MasterclassChapter {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStrOrNull(v['mini_description']) &&
    isNum(v['order']) &&
    isNum(v['duration_seconds']) &&
    isNum(v['total_quiz_questions']) &&
    isStrOrNull(v['horizontal_thumbnail_url']) &&
    isStrOrNull(v['hls_video_url']) &&
    isStrOrNull(v['transcript_text']) &&
    isBool(v['is_locked']) &&
    isBool(v['show_quiz']) &&
    isChapterProgress(v['user_chapter_progress'])
  );
}

const isCourseMode = (v: unknown): v is CourseMode | null =>
  v === null || v === 'cpe' || v === 'preview';

function isExerciseFile(v: unknown): v is MasterclassExerciseFile {
  return isObject(v) && isStr(v['name']) && isNum(v['order']) && isStr(v['url']);
}

function isAiKit(v: unknown): v is MasterclassAiKit {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isStr(v['url']);
}

function isResources(v: unknown): v is MasterclassResources {
  return (
    isObject(v) &&
    isStrOrNull(v['glossary']) &&
    isStrOrNull(v['course_navigation_video_url']) &&
    (v['exercise_files'] === null || listOf(isExerciseFile)(v['exercise_files'])) &&
    (v['ai_kit'] === null || isAiKit(v['ai_kit']))
  );
}

function isRelatedCourse(v: unknown): v is MasterclassRelatedCourse {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStr(v['mini_description']) &&
    isStrOrNull(v['thumbnail_url']) &&
    isNum(v['total_cpe_credits']) &&
    listOf(isFieldOfStudy)(v['field_of_study'])
  );
}

function isInstructorCourses(v: unknown): v is MasterclassInstructorCourses {
  return (
    isObject(v) &&
    isStr(v['instructor_id']) &&
    isStr(v['instructor_name']) &&
    listOf(isRelatedCourse)(v['courses'])
  );
}

function isNasbaSection(v: unknown): v is MasterclassNasbaSection {
  return (
    isObject(v) &&
    isStrOrNull(v['created_on']) &&
    isStrOrNull(v['reviewed_on']) &&
    isStrOrNull(v['updated_on'])
  );
}

function isApiCourseDetail(v: unknown): v is ApiCourseDetail {
  if (!isObject(v)) return false;
  const chapters = v['chapters'];
  return (
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStr(v['mini_description']) &&
    isStr(v['description']) &&
    isStrOrNull(v['horizontal_thumbnail_url']) &&
    isStrOrNull(v['trailer_horizontal_thumbnail_image_url']) &&
    isStrOrNull(v['horizontal_trailer_url']) &&
    isStrOrNull(v['sample_video_url']) &&
    listOf(isFieldOfStudy)(v['fields_of_study']) &&
    isNum(v['total_cpe_credits']) &&
    listOf(isLevel)(v['level']) &&
    isBool(v['show_credly_icon']) &&
    listOf(isInstructor)(v['instructors']) &&
    listOf(isLearningObjective)(v['learning_objectives']) &&
    listOf(isTopic)(v['topics']) &&
    isStr(v['masterclass_duration']) &&
    isNum(v['masterclass_duration_seconds']) &&
    isStrOrNull(v['program_level']) &&
    isStr(v['instructional_delivery_method']) &&
    isStr(v['prerequisite_education']) &&
    isStr(v['advance_preparation']) &&
    isStr(v['sponser_identification_number']) &&
    isStr(v['expiration_date']) &&
    isNasbaSection(v['nasba_section']) &&
    isObject(chapters) &&
    listOf(isChapter)(chapters['results']) &&
    isResources(v['miscellaneous_data']) &&
    listOf(isRelatedCourse)(v['related_courses']) &&
    listOf(isInstructorCourses)(v['instructor_related_courses']) &&
    isBool(v['is_bookmarked']) &&
    isStrOrNull(v['masterclass_certificate_url']) &&
    isBool(v['course_is_locked']) &&
    isCourseMode(v['course_mode']) &&
    isStrOrNull(v['course_pop_up_remark']) &&
    isStr(v['exam_rules']) &&
    isBool(v['show_final_assessment'])
  );
}

/**
 * `parse` for `course-detail/`: the `{ success, message, data: { course_details } }`
 * envelope, with the chapters unwrapped from their paginated block.
 */
export function parseCourseDetail(raw: unknown): MasterclassCourseDetail {
  const data = isObject(raw) ? raw['data'] : undefined;
  const course = isObject(data) ? data['course_details'] : undefined;
  if (isApiCourseDetail(course)) return { ...course, chapters: course.chapters.results };
  throw contractError('course-detail');
}

/** `chapter-start/`'s `{ success, message, data }` envelope. */
export function parseChapterStart(raw: unknown): ChapterStartResult {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && isBool(data['reset_required'])) {
    return { reset_required: data['reset_required'] };
  }
  throw contractError('chapter-start');
}

/**
 * `course-progress-update/`'s `{ success, message, data }` envelope. An expired
 * window (`reset_required`) may come without the chapter list, so that case
 * alone accepts its absence.
 */
export function parseCourseProgress(raw: unknown): CourseProgress {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && isBool(data['reset_required'])) {
    const chapters = data['chapters'];
    if (listOf(isProgressChapter)(chapters)) {
      return { reset_required: data['reset_required'], chapters };
    }
    if (data['reset_required'] && chapters === undefined) {
      return { reset_required: true, chapters: [] };
    }
  }
  throw contractError('course-progress-update');
}

/**
 * A refused step's body: `{ success: false, message, data: { reason } }`.
 * Anything else (a network error, an HTML 500) still yields the status, with
 * no reason or message, so the caller falls back to its own copy.
 */
export function readCourseStepRefusal(error: unknown): CourseStepRefusal {
  if (!(error instanceof HttpErrorResponse)) return { status: 0, reason: null, message: null };
  const body: unknown = error.error;
  const data = isObject(body) ? body['data'] : undefined;
  const reason = isObject(data) && isStr(data['reason']) ? data['reason'] : null;
  const message = isObject(body) && isStr(body['message']) ? body['message'] : null;
  return { status: error.status, reason, message };
}

/**
 * `parse` for `about-course/?slug=`, read only to turn an old numeric link's
 * slug into the UUID `course-detail/` needs.
 */
export function parseAboutCourseId(raw: unknown): string {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && isStr(data['id'])) return data['id'];
  throw contractError('about-course');
}
