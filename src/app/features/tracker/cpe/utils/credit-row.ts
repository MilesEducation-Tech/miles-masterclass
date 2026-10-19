import { CpeCreditWire } from '@features/tracker/cpe/models/cpe-credit.model';
import { CourseUrlSegment } from '@features/tracker/utils/course.util';

/**
 * `course_type` → the URL segment that renders it.
 *
 * Not `TRANSACTION_TO_URL`: that map is keyed on `TransactionType`, the legacy vocabulary where a
 * course was `masterclass`. The web API re-spelled it `course` and added `micro_learning` beside
 * `nano_learning`, so this is its own map rather than a translation layer on top of the old one.
 *
 * `ai_lab` is absent on purpose — `AI_LABS_ROUTES` is a single landing page with no `:id` route, so
 * an AI Lab row has nowhere to link to. The old code built `ai-labs/<id>/<slug>`, which matched
 * nothing.
 */
const COURSE_TYPE_TO_URL: Record<string, CourseUrlSegment> = {
  course: 'masterclass',
  podcast: 'podcast',
  webinar: 'webinar',
  nano_learning: 'micro-learning',
  micro_learning: 'micro-learning',
};

/**
 * Router commands for a credit row's course page, or `null` when the row has no page.
 *
 * Three kinds of row are unlinkable, and all three are normal: archived legacy content
 * (`is_archived`), an archived reel (`course_type` is `null`), and an AI Lab. The caller renders
 * plain text for those rather than a link that 404s.
 *
 * The slug comes off the row — the API sends the real one, so there is no need to re-derive it from
 * the title and risk a mismatch with the course page's own URL.
 */
export function courseCommands(row: CpeCreditWire, localePrefix: string): unknown[] | null {
  const target = courseTarget(row);
  return target && [localePrefix, target.segment, target.id, target.slug];
}

/**
 * Whether `courseCommands` would produce a target, for the table deciding between a link and plain
 * text. One rule, asked twice — the table used to re-derive it and would have drifted the first
 * time a content type gained or lost a page.
 */
export const canOpenCourse = (row: CpeCreditWire): boolean => courseTarget(row) !== null;

function courseTarget(
  row: CpeCreditWire,
): { segment: CourseUrlSegment; id: string; slug: string } | null {
  const { id, course_type, slug, is_archived } = row.course;
  if (is_archived || !id || !course_type || !slug) return null;

  const segment = COURSE_TYPE_TO_URL[course_type];
  return segment ? { segment, id, slug } : null;
}

/** The course's feedback page. Callers add `?redirect=` so the user comes back here. */
export function feedbackCommands(row: CpeCreditWire, localePrefix: string): unknown[] | null {
  const commands = courseCommands(row, localePrefix);
  return commands && [...commands, 'feedback'];
}
