/**
 * Course-id bucket helpers — drill-down logic for the user report, not
 * transport. Lifted out of the deleted `user-report.model.ts` during the Django
 * strip; the endpoint constants that lived beside them went, these didn't.
 */

/** Course ids grouped by offering type, as carried by a report row. */
export interface CourseIds {
  masterclass_id?: number[];
  podcast_id?: number[];
  nano_learning_id?: number[];
}

/** True when at least one bucket carries an id worth drilling into. */
export function hasCourseIds(ids: CourseIds | undefined | null): boolean {
  if (!ids) return false;
  return (
    (ids.masterclass_id?.length ?? 0) > 0 ||
    (ids.nano_learning_id?.length ?? 0) > 0 ||
    (ids.podcast_id?.length ?? 0) > 0
  );
}

/** Merge several buckets into one (used by the "All courses" action). */
export function mergeCourseIds(buckets: (CourseIds | undefined | null)[]): CourseIds {
  return {
    masterclass_id: buckets.flatMap((b) => b?.masterclass_id ?? []),
    podcast_id: buckets.flatMap((b) => b?.podcast_id ?? []),
    nano_learning_id: buckets.flatMap((b) => b?.nano_learning_id ?? []),
  };
}
