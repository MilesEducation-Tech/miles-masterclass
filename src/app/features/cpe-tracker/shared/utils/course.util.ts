import { ReportRow, TransactionType } from '../../../../shared/core/models/cpe-tracker.model';

/** URL-facing segment used when navigating to a course. */
export type CourseUrlSegment = 'masterclass' | 'micro-learning' | 'podcast' | 'webinar';

const TRANSACTION_TO_URL: Record<TransactionType, CourseUrlSegment> = {
  masterclass: 'masterclass',
  nano_learning: 'micro-learning',
  podcast: 'podcast',
  webinar: 'webinar',
};

export function getCourseId(row: ReportRow): number | null {
  return (
    row.master_class ?? row.nano_learning ?? row.podcast ?? row.webinar_details?.webinar_id ?? null
  );
}

export function getCourseName(row: ReportRow): string {
  return row.course_name || row.webinar_details?.webinar_name || '—';
}

export function getUrlSegment(row: ReportRow): CourseUrlSegment {
  return TRANSACTION_TO_URL[row.transaction_type] ?? 'masterclass';
}

export function getFieldOfStudyNames(row: ReportRow): string[] {
  return row.field_of_study.map((f) => f.name);
}

export function getTotalCredits(row: ReportRow): number {
  if (typeof row.total_credits === 'number') return row.total_credits;
  return row.field_of_study.reduce((sum, f) => sum + (f.cpe_credits ?? 0), 0);
}

export function getDeliveryMethod(row: ReportRow): string {
  if (row.delivery_method) return row.delivery_method;
  return row.transaction_type === 'webinar' ? 'Group Internet Based' : 'QAS Self Study';
}
