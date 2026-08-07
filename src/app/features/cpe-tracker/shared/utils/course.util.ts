
/** URL-facing segment used when navigating to a course. */
export type CourseUrlSegment = 'masterclass' | 'micro-learning' | 'podcast' | 'webinar';

const TRANSACTION_TO_URL: Record<any, CourseUrlSegment> = {
  masterclass: 'masterclass',
  nano_learning: 'micro-learning',
  podcast: 'podcast',
  webinar: 'webinar',
};

export function getCourseId(row: any): number | null {
  return (
    row.master_class ?? row.nano_learning ?? row.podcast ?? row.webinar_details?.webinar_id ?? null
  );
}

export function getCourseName(row: any): string {
  return row.course_name || row.webinar_details?.webinar_name || '—';
}

export function getUrlSegment(row: any): CourseUrlSegment {
  return TRANSACTION_TO_URL[row.transaction_type] ?? 'masterclass';
}

export function getFieldOfStudyNames(row: any): string[] {
  return row.field_of_study.map((f: any) => f.name);
}

export function getTotalCredits(row: any): number {
  if (typeof row.total_credits === 'number') return row.total_credits;
  return row.field_of_study.reduce((sum: any, f: any) => sum + (f.cpe_credits ?? 0), 0);
}

export function getDeliveryMethod(row: any): string {
  if (row.delivery_method) return row.delivery_method;
  return row.transaction_type === 'webinar' ? 'Group Internet Based' : 'QAS Self Study';
}
