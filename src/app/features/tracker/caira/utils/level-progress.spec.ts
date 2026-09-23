import { describe, expect, it } from 'vitest';
import { CairaLadderItem } from '@core/models/caira-badge.model';
import { levelProgressHint, seedLevelRank } from './level-progress';

const level = (
  rank: number,
  status: CairaLadderItem['status'],
  earned = 0,
  required = 30,
): CairaLadderItem =>
  ({
    id: 500 + rank,
    badge: { level_rank: rank } as CairaLadderItem['badge'],
    status,
    progress: { earned, required, percentage: (earned / required) * 100 },
    awarded_at: null,
    image_url: null,
    accept_url: null,
  }) as CairaLadderItem;

describe('seedLevelRank', () => {
  const ladder = [level(1, 'earned'), level(2, 'unlocked'), level(3, 'locked')];

  it('parks on the first level still in play', () => {
    expect(seedLevelRank(ladder, undefined, undefined)).toBe(2);
  });

  it('re-seeds when the previous ladder was empty (the placeholder must not stick)', () => {
    // First pass runs against an empty ladder and yields 1; when rows finally
    // arrive the seed has to run again rather than keep that 1.
    expect(seedLevelRank([], undefined, undefined)).toBe(1);
    expect(seedLevelRank(ladder, [], 1)).toBe(2);
  });

  it("keeps the user's pick across a refetch", () => {
    expect(seedLevelRank(ladder, ladder, 3)).toBe(3);
  });

  it('re-seeds when the picked level is gone from the new ladder', () => {
    expect(seedLevelRank([level(1, 'unlocked')], ladder, 3)).toBe(1);
  });

  it('parks on the top rung when every level is earned', () => {
    expect(seedLevelRank([level(1, 'earned'), level(2, 'earned')], undefined, undefined)).toBe(2);
  });
});

describe('levelProgressHint', () => {
  it('counts down against the current level, and names the next one', () => {
    expect(levelProgressHint(level(1, 'unlocked', 23, 38), level(2, 'locked'))).toBe(
      'Earn 15 credits to unlock Level 2 status.',
    );
  });

  it('reports the unlock once the current level is met', () => {
    expect(levelProgressHint(level(1, 'earned', 38, 38), level(2, 'locked'))).toBe(
      'Level 1 complete — Level 2 unlocked.',
    );
  });

  it('has no next level to name at the top of the ladder', () => {
    expect(levelProgressHint(level(3, 'unlocked', 10, 90), null)).toBe(
      'Earn 80 credits to complete Level 3.',
    );
    expect(levelProgressHint(level(3, 'earned', 90, 90), null)).toBe('Level 3 complete.');
  });

  it('never counts below zero when a learner overshoots', () => {
    expect(levelProgressHint(level(1, 'earned', 50, 38), null)).toBe('Level 1 complete.');
  });
});
