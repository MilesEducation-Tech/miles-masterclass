/**
 * Masterclass-only view types around the course. The course itself (the
 * `course-detail/` contract) is offering-wide, in
 * `features/offerings/models/course-detail.model.ts`.
 */

/** `total_duration`-style text split for the About grid's Hours and Mins cells. */
export interface MasterclassDurationParts {
  hours: number;
  minutes: number;
}
