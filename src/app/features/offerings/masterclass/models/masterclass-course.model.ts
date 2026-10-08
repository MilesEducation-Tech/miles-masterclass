/**
 * Masterclass-only view types around the course. The course itself (the
 * `course-detail/` contract) is offering-wide, in
 * `features/offerings/models/course-detail.model.ts`.
 */

import { MasterclassCourse } from '@core/models/masterclass-home.model';

/** What the course-info dialog opens with: the card the learner clicked "i" on. */
export interface MasterclassCourseInfoDialogData {
  course: MasterclassCourse;
}

/** `total_duration`-style text split for the About grid's Hours and Mins cells. */
export interface MasterclassDurationParts {
  hours: number;
  minutes: number;
}
