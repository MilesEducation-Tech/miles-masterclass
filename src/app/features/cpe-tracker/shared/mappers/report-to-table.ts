import {
  CreditMode,
  FieldOfStudyCredit,
  ReportRow,
  StudyModeBreakdown,
  StudyModeFilter,
} from '../../../../shared/core/models/cpe-tracker.model';
import {
  getCourseId,
  getCourseName,
  getDeliveryMethod,
  getTotalCredits,
} from '../utils/course.util';

export type ButtonKind =
  | 'registered'
  | 'resume'
  | 'exam'
  | 'retake'
  | 'feedback'
  | 'download'
  | 'view-details'
  | 'none';

export interface TrackerTableRow {
  key: string;
  id: number | null;
  courseName: string;
  fieldsOfStudy: FieldOfStudyCredit[];
  deliveryMethod: string;
  totalCredits: number;
  completedAt: string | null;
  registeredAt: string | null;
  cairaLevel: number | null;
  actionKind: ButtonKind;
  raw: ReportRow;
}

/**
 * Upcoming-mode CTA tree (see CPE tracker spec):
 *   webinar + not Present → Registered
 *   non-webinar + classes done + Not_Appeared → Take Exam
 *   non-webinar + classes done + Retake → Retake Exam
 *   non-webinar + classes not done → Resume
 *   anything else → View Details (fallback)
 *
 * `Exam_Failed` deliberately falls through to View Details — the server flips
 * the row to `Retake` once a retake is allowed, so a lingering `Exam_Failed`
 * means no retake path is available from here.
 */
function pickUpcomingAction(row: ReportRow): ButtonKind {
  if (row.transaction_type === 'webinar') {
    return row.attendance_status === 'Present' ? 'view-details' : 'registered';
  }

  if (!row.all_classes_completed) return 'resume';

  const status = row.assessment?.status ?? null;
  if (status === 'Not_Appeared') return 'exam';
  if (status === 'Retake') return 'retake';
  return 'view-details';
}

/**
 * Completed-mode CTA tree (see CPE tracker spec):
 *   feedback not submitted → Feedback
 *   feedback submitted → Download (per-row certificate)
 *   anything else (no feedback object on the row) → View Details
 */
function pickCompletedAction(row: ReportRow): ButtonKind {
  const feedback = row.user_feedback_details;
  if (!feedback) return 'view-details';
  return feedback.user_feedback_submitted ? 'download' : 'feedback';
}

function pickAction(row: ReportRow, mode: CreditMode): ButtonKind {
  return mode === 'upcoming' ? pickUpcomingAction(row) : pickCompletedAction(row);
}

function matchesStudyFilter(fields: FieldOfStudyCredit[], filter: StudyModeFilter): boolean {
  if (filter === 'All') return true;
  const lower = fields.map((f) => f.name.toLowerCase());
  if (filter === 'Accounting') return lower.some((n) => n.includes('account'));
  if (filter === 'Ethics') return lower.some((n) => n.includes('ethic'));
  return lower.every((n) => !n.includes('account') && !n.includes('ethic'));
}

/** Pure transform: report rows + active filter + credit mode → table rows. */
export function reportToTable(
  rows: ReportRow[],
  _studyModes: StudyModeBreakdown[],
  filter: StudyModeFilter,
  mode: CreditMode,
): TrackerTableRow[] {
  return rows
    .filter((row) => matchesStudyFilter(row.field_of_study, filter))
    .map<TrackerTableRow>((row) => {
      const id = getCourseId(row);
      return {
        key: `${row.transaction_type}-${id ?? row.id}`,
        id,
        courseName: getCourseName(row),
        fieldsOfStudy: row.field_of_study,
        deliveryMethod: getDeliveryMethod(row),
        totalCredits: getTotalCredits(row),
        completedAt: row.completed_at ?? null,
        registeredAt: row.registered_at ?? null,
        cairaLevel: row.caira_level ?? null,
        actionKind: pickAction(row, mode),
        raw: row,
      };
    });
}
