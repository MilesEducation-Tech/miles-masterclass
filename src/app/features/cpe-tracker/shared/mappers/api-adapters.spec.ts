import {
  RawReportRow,
  RawStatistics,
  RawUserBadge,
} from '../../../../shared/core/models/cpe-tracker.model';
import {
  DEFAULT_CPE_REQUIREMENT,
  deriveCredits,
  deriveDeliveryModes,
  deriveFieldsOfStudy,
  normalizeTransactionType,
  resolveCpeRequirement,
  toBadgeItem,
  toReportRow,
} from './api-adapters';

const rawReport: RawReportRow = {
  id: 5670,
  course_details: {
    course_category: 'Accounting',
    course_type: 'Accounting',
    master_class_name: 'Built to Digitize',
    horizontal_thumbnail: 'https://cdn/img.webp',
    instructor_name: 'Jeff Seibert',
    exam_rules: '…',
    type: 'masterclass',
    all_classes_completed: true,
    user_assessment: {
      status: 'Exam_Passed',
      session_id: 4670,
      exam_passes_date: '2026-04-09',
    },
    cpe_mode_details: null,
    is_subscription_excluded: false,
    is_free: false,
    is_certificate_eligible: false,
    caira_level: 1,
    fields_of_study: [
      { id: 34, name: 'Accounting', cpe_credits: 2.5 },
      { id: 45, name: 'Information Technology', cpe_credits: 5.0 },
    ],
  },
  user_feedback_details: { user_feedback_submitted: true },
  webinar_details: null,
  current_active_plan: null,
  user_badge: null,
  transcation_type: 'self_study',
  total_credits: 2.5,
  completed_date: null,
  status: true,
  created_at: '2026-04-09T12:16:45.177648+05:30',
  master_class: 160,
  nano_learning: null,
  chapter: null,
  course: 34,
  webinar_session: null,
  user_enrollment: null,
  user: 3705,
  updated_by: null,
};

const rawBadge: RawUserBadge = {
  id: 4123,
  badge: {
    id: 1,
    name: 'CAIRA',
    sub_text: 'Foundations of AI in Accounting',
    description: 'Gain a solid foundation…',
    level_name: 'Level 1',
    level_rank: 1,
    icon_url: 'https://cdn/level1.webp',
    required_credits: '30.00',
    is_coming_soon: false,
  },
  status: 'unlocked',
  awarded_at: null,
  current_progress: { earned: 2.5, required: 30.0 },
  progress_percentage: 8.33,
};

const rawStats: RawStatistics = {
  user_state_board: [],
  overall_credits_earned: 2.5,
  overall_upcoming_credits: 18.0,
  credits_earned: {
    total_credit_earned: 2.5,
    course_credits: { account_credits: 2.5, ethics: 0, others: 0 },
    study_credits: { webinar: 0, self_study: 2.5, nano_learning: 0 },
  },
  upcoming_credits: {
    total_credit_earned: 18.0,
    course_credits: { account_credits: 6.0, ethics: 0, others: 12.0 },
    study_credits: { webinar: 0, self_study: 7.5, nano_learning: 10.5 },
  },
};

describe('normalizeTransactionType', () => {
  it('maps the server typo-free synonyms', () => {
    expect(normalizeTransactionType('self_study')).toBe('masterclass');
    expect(normalizeTransactionType('nano_learning')).toBe('nano_learning');
    expect(normalizeTransactionType('webinar')).toBe('webinar');
    expect(normalizeTransactionType('podcast')).toBe('podcast');
  });

  it('collapses premiere → webinar', () => {
    expect(normalizeTransactionType('premiere')).toBe('webinar');
  });

  it('defaults to masterclass for unknowns and null', () => {
    expect(normalizeTransactionType('mystery')).toBe('masterclass');
    expect(normalizeTransactionType(null)).toBe('masterclass');
  });
});

describe('toReportRow', () => {
  it('maps nested master_class_name to course_name', () => {
    expect(toReportRow(rawReport).course_name).toBe('Built to Digitize');
  });

  it('normalizes self_study → masterclass and sets the delivery method', () => {
    const row = toReportRow(rawReport);
    expect(row.transaction_type).toBe('masterclass');
    expect(row.delivery_method).toBe('QAS Self Study');
  });

  it('carries assessment status + falls back to exam_passes_date for completed_at', () => {
    const row = toReportRow(rawReport);
    expect(row.assessment?.status).toBe('Exam_Passed');
    expect(row.completed_at).toBe('2026-04-09');
  });

  it('exposes course_image + instructor_name from course_details', () => {
    const row = toReportRow(rawReport);
    expect(row.course_image).toBe('https://cdn/img.webp');
    expect(row.instructor_name).toBe('Jeff Seibert');
  });

  it('falls back to webinar_name when no masterclass/podcast title is present', () => {
    const row = toReportRow({
      ...rawReport,
      course_details: {
        ...rawReport.course_details,
        master_class_name: null,
        type: 'webinar',
      },
      transcation_type: 'webinar',
      webinar_details: { webinar_id: 99, webinar_name: 'Live Tax Update' },
    });
    expect(row.course_name).toBe('Live Tax Update');
    expect(row.delivery_method).toBe('Group Internet Based');
  });

  it('falls back to nano_learning_name for nano rows', () => {
    const row = toReportRow({
      ...rawReport,
      course_details: {
        ...rawReport.course_details,
        master_class_name: null,
        podcast_format: null,
        nano_learning_name: 'AI is just ML',
        type: 'nano_learning',
      },
      transcation_type: 'nano_learning',
    });
    expect(row.course_name).toBe('AI is just ML');
    expect(row.transaction_type).toBe('nano_learning');
  });

  it('collapses course_details.type === premiere to webinar', () => {
    const row = toReportRow({
      ...rawReport,
      course_details: {
        ...rawReport.course_details,
        master_class_name: 'The AI-Ready CPA',
        type: 'premiere',
        attendance_details: 'Present',
        registered_webinar: { added: false },
      },
      transcation_type: 'webinar',
      webinar_details: { webinar_id: 140, webinar_session_id: 159 },
    });
    expect(row.transaction_type).toBe('webinar');
    expect(row.delivery_method).toBe('Group Internet Based');
    expect(row.attendance_status).toBe('Present');
  });

  it('passes Retake assessment status through unchanged', () => {
    const row = toReportRow({
      ...rawReport,
      course_details: {
        ...rawReport.course_details,
        user_assessment: { status: 'Retake', session_id: null, exam_passes_date: null },
      },
    });
    expect(row.assessment?.status).toBe('Retake');
  });

  it('forwards the inline user_badge with accept_url', () => {
    const row = toReportRow({
      ...rawReport,
      user_badge: {
        id: 5084,
        badge_name: 'AI Prompting Essentials',
        badge_image: 'https://cdn/badge.png',
        awarded_at: '2026-04-06T04:57:14.100754Z',
        accept_url: 'https://www.credly.com/badges/abc/accept',
      },
    });
    expect(row.user_badge?.accept_url).toBe('https://www.credly.com/badges/abc/accept');
    expect(row.user_badge?.id).toBe(5084);
  });

  it('lifts is_certificate_eligible and is_subscription_excluded to row level', () => {
    const row = toReportRow({
      ...rawReport,
      course_details: {
        ...rawReport.course_details,
        is_certificate_eligible: true,
        is_subscription_excluded: false,
      },
    });
    expect(row.is_certificate_eligible).toBe(true);
    expect(row.is_subscription_excluded).toBe(false);
  });
});

describe('toBadgeItem', () => {
  it('joins name + level_name and parses required_credits', () => {
    const badge = toBadgeItem(rawBadge);
    expect(badge.name).toBe('CAIRA — Level 1');
    expect(badge.required_credits).toBe(30);
    expect(badge.earned_credits).toBe(2.5);
  });

  it('flags claimable when progress is 100 and no awarded_at yet', () => {
    const badge = toBadgeItem({ ...rawBadge, progress_percentage: 100 });
    expect(badge.is_claimable).toBe(true);
    expect(badge.is_claimed).toBe(false);
  });

  it('flags claimed when awarded_at is set', () => {
    const badge = toBadgeItem({ ...rawBadge, awarded_at: '2026-04-09T08:59:49Z' });
    expect(badge.is_claimed).toBe(true);
    expect(badge.is_claimable).toBe(false);
  });
});

describe('statistics derivations', () => {
  it('deriveCredits picks earned vs upcoming off the mode flag', () => {
    expect(deriveCredits(rawStats, true)?.earned).toBe(2.5);
    expect(deriveCredits(rawStats, false)?.earned).toBe(18);
  });

  it('deriveCredits returns null when no data is present', () => {
    expect(deriveCredits(null, true)).toBeNull();
  });

  it('deriveFieldsOfStudy maps course_credits into Accounting / Ethics / Others', () => {
    expect(deriveFieldsOfStudy(rawStats, true)).toEqual([
      { id: 1, name: 'Accounting', credits: 2.5 },
      { id: 2, name: 'Ethics', credits: 0 },
      { id: 3, name: 'Others', credits: 0 },
    ]);
    expect(deriveFieldsOfStudy(rawStats, false)).toEqual([
      { id: 1, name: 'Accounting', credits: 6 },
      { id: 2, name: 'Ethics', credits: 0 },
      { id: 3, name: 'Others', credits: 12 },
    ]);
  });

  it('deriveDeliveryModes maps study_credits into Self-Study / Nano / Webinar', () => {
    const modes = deriveDeliveryModes(rawStats, true).map((m) => [m.name, m.credits]);
    expect(modes).toEqual([
      ['Self-Study', 2.5],
      ['Nano Learning', 0],
      ['Webinar', 0],
    ]);
  });

  it('resolveCpeRequirement falls back to the default when no state board is set', () => {
    expect(resolveCpeRequirement(rawStats)).toBe(DEFAULT_CPE_REQUIREMENT);
  });

  it('resolveCpeRequirement uses the first state-board requirement when present', () => {
    const stats: RawStatistics = {
      ...rawStats,
      user_state_board: [{ id: 1, name: 'CA', required_credits: 80 }],
    };
    expect(resolveCpeRequirement(stats)).toBe(80);
  });
});
