/**
 * View types around the course page's shared sections (the About grid serves
 * masterclass and podcast). The course itself (the `course-detail/` contract)
 * is in `features/offerings/models/course-detail.model.ts`.
 */

/** `total_duration`-style text split for the About grid's Hours and Mins cells. */
export interface MasterclassDurationParts {
  hours: number;
  minutes: number;
}
