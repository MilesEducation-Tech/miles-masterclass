import { describe, expect, it } from 'vitest';
import {
  CpeCreditWire,
  cpeRowActions,
  DELIVERY_METHOD,
  toCertificateTarget,
} from './cpe-credit.model';

const row = (overrides: Partial<CpeCreditWire> = {}): CpeCreditWire => ({
  id: 6264,
  course: {
    id: 159,
    course_type: 'masterclass',
    title: 'AI Enablement for Accounting Firms',
    thumbnail: null,
    is_free: false,
    is_subscription_excluded: false,
    has_plan: true,
    fields_of_study: [{ id: 34, name: 'Accounting', cpe_credits: 1.5 }],
  },
  credits: 1.5,
  allocated_on: '2026-04-06',
  was_caira_credit: true,
  badge: null,
  feedback_submitted: true,
  ...overrides,
});

const earnedBadge = {
  id: 6072,
  name: 'AI Systems Ethics',
  icon_url: null,
  status: 'earned' as const,
  accept_url: 'https://www.credly.com/go/AbCdEfGh',
};

describe('cpeRowActions', () => {
  it('offers Download once feedback is submitted, Feedback until then', () => {
    expect(cpeRowActions(row({ feedback_submitted: true }))).toEqual(['download']);
    expect(cpeRowActions(row({ feedback_submitted: false }))).toEqual(['feedback']);
  });

  it('adds View Badge on an earned badge', () => {
    expect(cpeRowActions(row({ badge: earnedBadge }))).toEqual(['download', 'view_badge']);
  });

  it('withholds View Badge until the badge is both earned and accepted', () => {
    expect(cpeRowActions(row({ badge: { ...earnedBadge, status: 'unlocked' } }))).toEqual([
      'download',
    ]);
    expect(cpeRowActions(row({ badge: { ...earnedBadge, accept_url: null } }))).toEqual([
      'download',
    ]);
  });
});

describe('toCertificateTarget', () => {
  it('keys the certificate on the course, not the credit record', () => {
    expect(toCertificateTarget(row())).toEqual({
      courseId: 159,
      courseType: 'masterclass',
      courseTitle: 'AI Enablement for Accounting Firms',
      badge: undefined,
    });
  });

  it('folds AI Lab into nano_learning for the certificate API', () => {
    const lab = { ...row().course, course_type: 'ai_lab' as const };
    expect(toCertificateTarget(row({ course: lab })).courseType).toBe('nano_learning');
  });
});

describe('DELIVERY_METHOD', () => {
  it('splits webinars from self-study, and groups AI Lab with the rest', () => {
    expect(DELIVERY_METHOD.webinar).toBe('Group Internet Based');
    expect(DELIVERY_METHOD.masterclass).toBe('QAS Self Study');
    expect(DELIVERY_METHOD.podcast).toBe('QAS Self Study');
    expect(DELIVERY_METHOD.ai_lab).toBe('QAS Self Study');
    expect(DELIVERY_METHOD.nano_learning).toBe('Nano Learning');
  });
});
