/**
 * Types for one masterclass course on the web API (`web-api/v1/masterclass/`),
 * as the course page reads them. These are the keys the page READS, not a
 * mirror of the payload, and they replace the legacy `ContentDetails` for this
 * page: this API addresses courses by UUID and slug.
 *
 * `about-course/` checked against live UAT on 2026-10-06, all 64 courses on the
 * landing page. Live differs from the Postman export: the envelope is
 * `{ success, message, data }` (Postman: `status: "success"`), and the unset
 * fields arrive as `null` (Postman: `""`). The live keys win.
 */

import {
  contractError,
  isBool,
  isNum,
  isObject,
  isStr,
  isStrOrNull,
  listOf,
} from '@features/offerings/masterclass/utils/contract-guards';
import {
  MasterclassCourse,
  MasterclassFieldOfStudy,
  MasterclassThumbnails,
} from '@core/models/masterclass-home.model';

/** What the course-info dialog opens with: the card the learner clicked "i" on. */
export interface MasterclassCourseInfoDialogData {
  course: MasterclassCourse;
}

/** The course route's two params, as the page's inputs carry them. */
export interface MasterclassCourseRouteParams {
  courseId: string | undefined;
  slug: string | undefined;
}

/** How `about-course/` is asked for: exactly one of the two keys, or it answers 400. */
export type MasterclassCourseLookup = { course_id: string } | { slug: string };

/** The chapter "Watch Now" opens. */
export interface MasterclassChapterRef {
  id: string;
  slug: string;
  name: string;
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

/** `total_duration` split for the About grid's Hours and Mins cells. */
export interface MasterclassDurationParts {
  hours: number;
  minutes: number;
}

/** `data` of `about-course/`: public, so it is the page's server-rendered content. */
export interface MasterclassAboutCourse {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  description: string;
  thumbnails: MasterclassThumbnails;
  trailer_url: string | null;
  /** The hero's looping background; `null` on every UAT course so far. */
  web_background_video_url: string | null;
  sample_video_url: string | null;
  /** Preformatted by the API, e.g. "1 hour 34 minutes" or "3 hours". */
  total_duration: string;
  delivery_method: string;
  program_level: string | null;
  prerequisite_education: string;
  advance_preparation: string;
  fields_of_study: MasterclassFieldOfStudy[];
  /** The course total, summed by the API. Render it as sent; never re-sum. */
  total_cpe_credits: number;
  has_individual_badge: boolean;
  included_for_caira: boolean;
  /** `null` is accepted so a course with no chapter yet still renders, without "Watch Now". */
  first_chapter: MasterclassChapterRef | null;
  chapter_count: number;
  learning_objectives: MasterclassLearningObjective[];
  instructors: MasterclassInstructor[];
  topics: MasterclassTopic[];
}

// ---- Trust boundary --------------------------------------------------------

function isThumbnails(v: unknown): v is MasterclassThumbnails {
  return (
    isObject(v) &&
    isStrOrNull(v['horizontal']) &&
    isStrOrNull(v['vertical']) &&
    isStrOrNull(v['square'])
  );
}

function isFieldOfStudy(v: unknown): v is MasterclassFieldOfStudy {
  return isObject(v) && isStr(v['id']) && isStr(v['name']) && isNum(v['cpe_credit']);
}

function isChapterRef(v: unknown): v is MasterclassChapterRef {
  return isObject(v) && isStr(v['id']) && isStr(v['slug']) && isStr(v['name']);
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

function isAboutCourse(v: unknown): v is MasterclassAboutCourse {
  return (
    isObject(v) &&
    isStr(v['id']) &&
    isStr(v['slug']) &&
    isStr(v['title']) &&
    isStr(v['short_description']) &&
    isStr(v['description']) &&
    isThumbnails(v['thumbnails']) &&
    isStrOrNull(v['trailer_url']) &&
    isStrOrNull(v['web_background_video_url']) &&
    isStrOrNull(v['sample_video_url']) &&
    isStr(v['total_duration']) &&
    isStr(v['delivery_method']) &&
    isStrOrNull(v['program_level']) &&
    isStr(v['prerequisite_education']) &&
    isStr(v['advance_preparation']) &&
    listOf(isFieldOfStudy)(v['fields_of_study']) &&
    isNum(v['total_cpe_credits']) &&
    isBool(v['has_individual_badge']) &&
    isBool(v['included_for_caira']) &&
    (v['first_chapter'] === null || isChapterRef(v['first_chapter'])) &&
    isNum(v['chapter_count']) &&
    listOf(isLearningObjective)(v['learning_objectives']) &&
    listOf(isInstructor)(v['instructors']) &&
    listOf(isTopic)(v['topics'])
  );
}

/** `parse` for `about-course/`: the `{ success, message, data }` envelope, unwrapped. */
export function parseAboutCourse(raw: unknown): MasterclassAboutCourse {
  const data = isObject(raw) ? raw['data'] : undefined;
  if (isAboutCourse(data)) return data;
  throw contractError('about-course');
}
