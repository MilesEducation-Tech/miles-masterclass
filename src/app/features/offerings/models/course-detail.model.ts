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

import { MasterclassFieldOfStudy } from '@core/models/masterclass-home.model';
import { RouteConfig } from '@core/models/http.model';
import {
  contractError,
  isBool,
  isNum,
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
  /** The course page's URL segment: `/:country/:profession/<segment>/:id/:slug`. */
  urlSegment: string;
  /** `course_type` on the analytics events. */
  analyticsType: string;
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

/** One chapter of the course; the list shows them in the API's `order`. */
export interface MasterclassChapter {
  id: string;
  name: string;
  mini_description: string | null;
  order: number;
  duration_seconds: number;
  total_quiz_questions: number;
  horizontal_thumbnail_url: string | null;
}

/** A chapter with the URL slug the API doesn't send, made from its name. */
export type MasterclassChapterLink = MasterclassChapter & { slug: string };

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
  /** The hero's poster, before the trailer starts. */
  trailer_thumbnail_url: string | null;
  /** An HLS (`.m3u8`) stream on every UAT course, so it needs the video.js player. */
  trailer_video_url: string | null;
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

function isChapter(v: unknown): v is MasterclassChapter {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['name']) &&
    isStrOrNull(v['mini_description']) &&
    isNum(v['order']) &&
    isNum(v['duration_seconds']) &&
    isNum(v['total_quiz_questions']) &&
    isStrOrNull(v['horizontal_thumbnail_url'])
  );
}

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
    isStrOrNull(v['trailer_thumbnail_url']) &&
    isStrOrNull(v['trailer_video_url']) &&
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
    isStrOrNull(v['masterclass_certificate_url'])
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

/**
 * `parse` for `about-course/?slug=`, read only to turn an old numeric link's
 * slug into the UUID `course-detail/` needs.
 */
export function parseAboutCourseId(raw: unknown): string {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isObject(data) && isStr(data['id'])) return data['id'];
  throw contractError('about-course');
}
