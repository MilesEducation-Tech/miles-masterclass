import { Injectable } from '@angular/core';
import { ButtonKind, TrackerTableRow } from '../../mappers/report-to-table';

export interface ButtonAction {
  kind: ButtonKind;
  label: string;
  variant: 'default' | 'outline' | 'secondary' | 'ghost';
}

const ACTION_MAP: Record<ButtonKind, ButtonAction> = {
  registered: { kind: 'registered', label: 'Registered', variant: 'outline' },
  resume: { kind: 'resume', label: 'Resume', variant: 'default' },
  exam: { kind: 'exam', label: 'Take Exam', variant: 'default' },
  retake: { kind: 'retake', label: 'Retake Exam', variant: 'default' },
  feedback: { kind: 'feedback', label: 'Feedback', variant: 'secondary' },
  download: { kind: 'download', label: 'Download', variant: 'outline' },
  'view-details': { kind: 'view-details', label: 'View Details', variant: 'outline' },
  none: { kind: 'none', label: '—', variant: 'ghost' },
};

/**
 * Strategy resolver. Given a table row (already derived from a report), return the
 * button action to render. Keeps the OCP-friendly button mapping in one place — new
 * states are added by extending the `ButtonKind` union and the map.
 */
@Injectable({
  providedIn: 'root',
})
export class CourseActionResolver {
  resolve(row: TrackerTableRow): ButtonAction {
    return ACTION_MAP[row.actionKind] ?? ACTION_MAP.none;
  }

  resolveFromReport(report: any, actionKind: ButtonKind): ButtonAction {
    void report;
    return ACTION_MAP[actionKind] ?? ACTION_MAP.none;
  }
}
