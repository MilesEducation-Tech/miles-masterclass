import { isNum, isObject, isStr, isStrOrNull } from '@core/utils/contract-guards';

/**
 * The card AI Kit button's read, `GET web-api/v1/masterclass/course-detail/{id}/`:
 * only `data.course_details.miscellaneous_data`. In core because two features
 * open it (the course library and the masterclass page) through the shared
 * `CourseAiKit`.
 */

/** An openable extra from `course-detail/`: the AI Kit PDF or an exercise file. */
export interface CourseResource {
  name: string;
  url: string;
  description: string | null;
}

/** What the AI Kit button opens: the kit first, then the exercise files in their order. */
export interface CourseResources {
  aiKit: CourseResource | null;
  exerciseFiles: CourseResource[];
}

// ---- Trust boundary --------------------------------------------------------

/** `ai_kit {id, name, description, icon_url, url}`; a kit with no url has nothing to open. */
function toKit(v: unknown): CourseResource | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isStr(v['name']) || !isStrOrNull(v['url'])) return undefined;
  const description = v['description'];
  if (!isStrOrNull(description)) return undefined;
  return v['url'] ? { name: v['name'], url: v['url'], description } : null;
}

const isExerciseFile = (v: unknown): v is { name: string; url: string; order: number } =>
  isObject(v) && isStr(v['name']) && isStr(v['url']) && isNum(v['order']);

/**
 * `parse` for the AI Kit button's read, `course-detail/{id}/`: only
 * `data.course_details.miscellaneous_data`. `tools` has no link and is not read.
 */
export function parseCourseResources(raw: unknown): CourseResources {
  const data = isObject(raw) ? raw['data'] : undefined;
  const details = isObject(data) ? data['course_details'] : undefined;
  const misc = isObject(details) ? details['miscellaneous_data'] : undefined;
  const aiKit = isObject(misc) ? toKit(misc['ai_kit']) : undefined;
  const files = isObject(misc) ? misc['exercise_files'] : undefined;
  if (
    aiKit !== undefined &&
    (files === null || (Array.isArray(files) && files.every(isExerciseFile)))
  ) {
    const exerciseFiles = [...(files ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(({ name, url }) => ({ name, url, description: null }));
    return { aiKit, exerciseFiles };
  }
  throw new Error('[course-resources] course-detail resources do not match the contract.');
}
