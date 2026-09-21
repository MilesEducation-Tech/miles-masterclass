import { describe, expect, it } from 'vitest';
import { badgeActionTarget, BadgeActionSource } from './badge-action';

const base: BadgeActionSource = {
  state: 'in_progress',
  courseType: 'masterclass',
  courseId: 44,
  courseTitle: 'Introduction to Data Analytics',
  userBadge: null,
};

const claimed = { id: 6088, status: 'earned' as const, awarded_at: null, accept_url: null };

describe('badgeActionTarget', () => {
  it('routes an in-progress course to its detail page under the locale prefix', () => {
    expect(badgeActionTarget(base, '/us/cpa', '/us/cpa/caira-tracker')).toEqual({
      kind: 'navigate',
      commands: ['/us/cpa', 'masterclass', 44, 'introduction-to-data-analytics'],
    });
  });

  it('maps nano_learning to the micro-learning URL segment', () => {
    const t = badgeActionTarget({ ...base, courseType: 'nano_learning' }, '/us/cpa', '/x');
    expect(t).toMatchObject({ commands: ['/us/cpa', 'micro-learning', 44, expect.any(String)] });
  });

  it('sends feedback to the feedback page and carries a redirect back', () => {
    const t = badgeActionTarget(
      { ...base, state: 'submit_feedback' },
      '/us/cpa',
      '/us/cpa/caira-tracker/course-badges',
    );
    expect(t).toEqual({
      kind: 'navigate',
      commands: ['/us/cpa', 'masterclass', 44, 'introduction-to-data-analytics', 'feedback'],
      queryParams: { redirect: '/us/cpa/caira-tracker/course-badges' },
    });
  });

  it('claims when unlocked, and opens Credly once an accept_url exists', () => {
    expect(
      badgeActionTarget({ ...base, state: 'claim_badge', userBadge: claimed }, '/us/cpa', '/x'),
    ).toEqual({ kind: 'claim', userBadgeId: 6088 });

    expect(
      badgeActionTarget(
        { ...base, state: 'view_badge', userBadge: { ...claimed, accept_url: 'https://credly/x' } },
        '/us/cpa',
        '/x',
      ),
    ).toEqual({ kind: 'external', url: 'https://credly/x' });
  });

  it('re-claims a view_badge that has no accept_url yet (claim is idempotent)', () => {
    expect(
      badgeActionTarget({ ...base, state: 'view_badge', userBadge: claimed }, '/us/cpa', '/x'),
    ).toEqual({ kind: 'claim', userBadgeId: 6088 });
  });

  it('does nothing for coming_soon or a session-less badge', () => {
    expect(badgeActionTarget({ ...base, state: 'coming_soon' }, '/us/cpa', '/x')).toEqual({
      kind: 'none',
    });
    expect(badgeActionTarget({ ...base, courseId: null }, '/us/cpa', '/x')).toEqual({
      kind: 'none',
    });
  });
});
