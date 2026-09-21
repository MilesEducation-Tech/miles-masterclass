import {
  CpeCreditWire,
  CPE_TYPE_TO_TRANSACTION,
} from '../../../../shared/core/models/cpe-credit.model';
import { TRANSACTION_TO_URL } from './course.util';
import { toSlug } from './slug.util';

/**
 * Router commands for a credit row's course page. Built the same way
 * `caira-tracker`'s `badgeActionTarget` builds its links — `TRANSACTION_TO_URL`
 * + `toSlug` over an absolute `/{country}/{profession}` prefix.
 */
export function courseCommands(row: CpeCreditWire, localePrefix: string): unknown[] {
  const { id, course_type, title } = row.course;
  // ponytail: no AI Lab course page yet — `ai-labs/:id/:slug` is reserved for the one being built.
  const segment =
    course_type === 'ai_lab' ? 'ai-labs' : TRANSACTION_TO_URL[CPE_TYPE_TO_TRANSACTION[course_type]];
  return [localePrefix, segment, id, toSlug(title)];
}

/** The course's feedback page. Callers add `?redirect=` so the user comes back here. */
export function feedbackCommands(row: CpeCreditWire, localePrefix: string): unknown[] {
  return [...courseCommands(row, localePrefix), 'feedback'];
}
