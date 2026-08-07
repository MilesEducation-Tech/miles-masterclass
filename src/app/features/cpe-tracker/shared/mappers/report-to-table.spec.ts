import { reportToTable } from './report-to-table';
import { CreditMode, ReportRow } from '../../../../shared/core/models/cpe-tracker.model';

function row(overrides: Partial<ReportRow>): ReportRow {
  return {
    id: overrides.id ?? 1,
    master_class: 1,
    nano_learning: null,
    podcast: null,
    webinar_details: null,
    course_name: 'Test Course',
    transaction_type: 'masterclass',
    course_type: 'masterclass',
    field_of_study: [{ id: 1, name: 'Accounting', cpe_credits: 2 }],
    delivery_method: 'QAS Self Study',
    all_classes_completed: true,
    completed_at: null,
    registered_at: null,
    assessment: null,
    user_feedback_details: { user_feedback_submitted: false, user_rating: 0 },
    total_credits: 2,
    ...overrides,
  };
}

function pick(r: ReportRow, mode: CreditMode) {
  return reportToTable([r], [], 'All', mode)[0];
}

describe('reportToTable (upcoming mode)', () => {
  it('selects "registered" for un-attended webinars', () => {
    const r = pick(
      row({
        transaction_type: 'webinar',
        all_classes_completed: false,
        attendance_status: null,
        webinar_details: { webinar_id: 99 },
      }),
      'upcoming',
    );
    expect(r.actionKind).toBe('registered');
  });

  it('selects "view-details" for webinars marked Present', () => {
    const r = pick(
      row({
        transaction_type: 'webinar',
        attendance_status: 'Present',
        webinar_details: { webinar_id: 99 },
      }),
      'upcoming',
    );
    expect(r.actionKind).toBe('view-details');
  });

  it('selects "resume" for un-completed non-webinar courses', () => {
    const r = pick(row({ all_classes_completed: false }), 'upcoming');
    expect(r.actionKind).toBe('resume');
  });

  it('selects "exam" when classes are done and assessment is Not_Appeared', () => {
    const r = pick(
      row({ all_classes_completed: true, assessment: { status: 'Not_Appeared' } }),
      'upcoming',
    );
    expect(r.actionKind).toBe('exam');
  });

  it('selects "retake" when classes are done and assessment is Retake', () => {
    const r = pick(
      row({ all_classes_completed: true, assessment: { status: 'Retake' } }),
      'upcoming',
    );
    expect(r.actionKind).toBe('retake');
  });

  it('falls back to "view-details" for Exam_Failed (no retake offered)', () => {
    const r = pick(
      row({ all_classes_completed: true, assessment: { status: 'Exam_Failed' } }),
      'upcoming',
    );
    expect(r.actionKind).toBe('view-details');
  });

  it('falls back to "view-details" when assessment status is missing', () => {
    const r = pick(row({ all_classes_completed: true, assessment: null }), 'upcoming');
    expect(r.actionKind).toBe('view-details');
  });
});

describe('reportToTable (completed mode)', () => {
  it('selects "feedback" when user_feedback_submitted is false', () => {
    const r = pick(
      row({
        user_feedback_details: { user_feedback_submitted: false, user_rating: 0 },
      }),
      'completed',
    );
    expect(r.actionKind).toBe('feedback');
  });

  it('selects "download" once feedback has been submitted', () => {
    const r = pick(
      row({
        user_feedback_details: { user_feedback_submitted: true, user_rating: 5 },
      }),
      'completed',
    );
    expect(r.actionKind).toBe('download');
  });

  it('falls back to "view-details" when no feedback object is present', () => {
    const r = pick(row({ user_feedback_details: undefined }), 'completed');
    expect(r.actionKind).toBe('view-details');
  });

  it('still selects "download" for webinar rows once feedback is submitted', () => {
    const r = pick(
      row({
        transaction_type: 'webinar',
        attendance_status: 'Present',
        user_feedback_details: { user_feedback_submitted: true, user_rating: 4 },
      }),
      'completed',
    );
    expect(r.actionKind).toBe('download');
  });
});

describe('reportToTable (study-mode filter)', () => {
  it('Ethics keeps only ethics-tagged rows', () => {
    const rows = reportToTable(
      [
        row({ master_class: 1, field_of_study: [{ id: 1, name: 'Accounting', cpe_credits: 2 }] }),
        row({ master_class: 2, field_of_study: [{ id: 2, name: 'Ethics', cpe_credits: 1 }] }),
        row({ master_class: 3, field_of_study: [{ id: 3, name: 'Taxes', cpe_credits: 1.5 }] }),
      ],
      [],
      'Ethics',
      'completed',
    );
    expect(rows.map((r) => r.id)).toEqual([2]);
  });

  it('"Others" excludes accounting + ethics rows', () => {
    const rows = reportToTable(
      [
        row({ master_class: 1, field_of_study: [{ id: 1, name: 'Accounting', cpe_credits: 2 }] }),
        row({ master_class: 2, field_of_study: [{ id: 2, name: 'Ethics', cpe_credits: 1 }] }),
        row({ master_class: 3, field_of_study: [{ id: 3, name: 'Taxes', cpe_credits: 1.5 }] }),
      ],
      [],
      'Others',
      'completed',
    );
    expect(rows.map((r) => r.id)).toEqual([3]);
  });
});
