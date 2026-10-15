/**
 * `course_type` on the masterclass list routes: `highlight/`, `tracks-page/`
 * and `ai-labs/`.
 *
 * UAT made it required on 2026-10-13 with no contract update (Postman still
 * omits it): leaving it out is a 400 `invalid_query`, "Field required". It
 * takes `course`, `podcast`, `nano_learning` or `micro_learning`, and a
 * masterclass is a `course` (`course_type` on `course-detail/` says so too).
 */
export const MASTERCLASS_COURSE_TYPE = 'course';
