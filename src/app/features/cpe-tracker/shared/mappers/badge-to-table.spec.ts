import {
  BadgeItem,
  CairaLevelBadge,
  LevelProgress,
} from '../../../../shared/core/models/caira/cpe.model';
import {
  availableContentTypes,
  badgeToTableRow,
  filterBadges,
  levelNumber,
  toBadgeHeroCards,
} from './badge-to-table';

const badge = (over: Partial<BadgeItem> = {}): BadgeItem => ({
  id: 'CAIRA-L1-Masterclass-0',
  title: 'AI Basics',
  thumbnailUrl: null,
  contentType: 'Masterclass',
  category: 'CAIRA',
  level: 'L1',
  isBadgeIncluded: false,
  cpeCredits: 2,
  allocatedOn: '2026-01-01',
  isArchived: false,
  hasCertificate: false,
  isPending: false,
  badgeUrl: null,
  certificateUrl: null,
  ...over,
});

describe('levelNumber', () => {
  it('parses the level key, and reports none for NON-CAIRA', () => {
    expect(levelNumber('L2')).toBe(2);
    expect(levelNumber(undefined)).toBeNull();
  });
});

describe('badgeToTableRow', () => {
  it('offers download only when there is something to open', () => {
    // #23 carries no course id, so every other action has no target.
    expect(badgeToTableRow(badge()).actionKind).toBe('none');
    expect(badgeToTableRow(badge({ hasCertificate: true })).actionKind).toBe('download');
    expect(badgeToTableRow(badge({ isBadgeIncluded: true })).actionKind).toBe('download');
  });

  it('offers nothing while the credential pipeline is still running', () => {
    expect(badgeToTableRow(badge({ hasCertificate: true, isPending: true })).actionKind).toBe(
      'none',
    );
  });

  it('carries the level through as a number and leaves fields of study empty', () => {
    const row = badgeToTableRow(badge({ level: 'L3' }));
    expect(row.cairaLevel).toBe(3);
    expect(row.fieldsOfStudy).toEqual([]);
    expect(row.registeredAt).toBeNull();
  });

  it('reports a blank allocation date as null', () => {
    expect(badgeToTableRow(badge({ allocatedOn: '' })).completedAt).toBeNull();
  });
});

describe('filterBadges', () => {
  const items = [
    badge({ id: 'a', category: 'CAIRA', level: 'L1', contentType: 'Masterclass' }),
    badge({ id: 'b', category: 'CAIRA', level: 'L2', contentType: 'Masterclass' }),
    badge({ id: 'c', category: 'CAIRA', level: 'L1', contentType: 'Webinar' }),
    badge({ id: 'd', category: 'NON-CAIRA', level: undefined, contentType: 'Masterclass' }),
  ];

  it('matches on category, level and content type', () => {
    expect(
      filterBadges(items, { category: 'CAIRA', level: 'L1', contentType: 'Masterclass' }).map(
        (i) => i.id,
      ),
    ).toEqual(['a']);
  });

  it('ignores level for NON-CAIRA, which has none', () => {
    expect(
      filterBadges(items, { category: 'NON-CAIRA', level: 'L3', contentType: 'Masterclass' }).map(
        (i) => i.id,
      ),
    ).toEqual(['d']);
  });
});

describe('availableContentTypes', () => {
  const items = [
    badge({ category: 'CAIRA', level: 'L1', contentType: 'Masterclass' }),
    badge({ category: 'CAIRA', level: 'L1', contentType: 'Podcast' }),
    badge({ category: 'CAIRA', level: 'L2', contentType: 'Webinar' }),
  ];

  it('lists only the types that actually have badges, in canonical order', () => {
    expect(availableContentTypes(items, 'CAIRA', 'L1')).toEqual(['Masterclass', 'Podcast']);
    expect(availableContentTypes(items, 'CAIRA', 'L2')).toEqual(['Webinar']);
  });

  it('reports nothing for an empty combination, so the filter can disable itself', () => {
    expect(availableContentTypes(items, 'CAIRA', 'L3')).toEqual([]);
    expect(availableContentTypes([], 'CAIRA', 'L1')).toEqual([]);
  });
});

describe('toBadgeHeroCards', () => {
  const levelBadge = (over: Partial<CairaLevelBadge> = {}): CairaLevelBadge => ({
    levelName: 'Bronze',
    badgeLabel: 'L1',
    progress: { earned: 45, target: 30, percent: 100 },
    progressCorrected: { earned: 30, target: 30, percent: 100 },
    status: 'Completed',
    badgeImageUrl: 'https://badge.png',
    credlyBadgeImageUrl: 'https://credly.png',
    credlyAcceptUrl: null,
    allocatedOn: null,
    ...over,
  });

  const level = (over: Partial<LevelProgress> = {}): LevelProgress => ({
    levelNumber: 1,
    levelName: 'Bronze',
    status: 'Completed',
    progress: null,
    targetCpe: 30,
    credlyAssertionId: 'assert-1',
    credlyAcceptedUrl: null,
    ...over,
  });

  it('joins the two endpoints on level name', () => {
    // #23 has the art, #5 has the assertion id #19 needs. Neither alone works.
    const [card] = toBadgeHeroCards([levelBadge()], [level()]);
    expect(card.image_url).toBe('https://badge.png');
    expect(card.credlyAssertionId).toBe('assert-1');
    expect(card.level_rank).toBe(1);
  });

  it('prefers the corrected per-level numerator over #23s global one', () => {
    const [card] = toBadgeHeroCards([levelBadge()], [level()]);
    expect(card.earned_credits).toBe(30);
  });

  it('is claimable only when #5 supplied an assertion id and nothing is claimed', () => {
    expect(toBadgeHeroCards([levelBadge()], [level()])[0].is_claimable).toBe(true);
    expect(
      toBadgeHeroCards([levelBadge({ allocatedOn: '2026-02-01' })], [level()])[0].is_claimable,
    ).toBe(false);
    expect(
      toBadgeHeroCards([levelBadge()], [level({ credlyAssertionId: null })])[0].is_claimable,
    ).toBe(false);
  });

  it('marks a claimed badge from its allocation date', () => {
    expect(
      toBadgeHeroCards([levelBadge({ allocatedOn: '2026-02-01' })], [level()])[0].is_claimed,
    ).toBe(true);
  });

  it('maps only Locked to the locked state', () => {
    expect(toBadgeHeroCards([levelBadge({ status: 'Locked' })], [level()])[0].status).toBe(
      'locked',
    );
    expect(toBadgeHeroCards([levelBadge({ status: 'Ongoing' })], [level()])[0].status).toBe(
      'unlocked',
    );
  });

  it('still renders when #5 has no matching level', () => {
    const [card] = toBadgeHeroCards([levelBadge()], []);
    expect(card.level_rank).toBe(1);
    expect(card.credlyAssertionId).toBeNull();
    expect(card.is_claimable).toBe(false);
  });
});
