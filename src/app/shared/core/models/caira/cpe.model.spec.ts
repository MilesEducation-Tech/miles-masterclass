import {
  AllBadgesResponse,
  LevelsProgressResponse,
  currentLevelNumber,
  parseCreditProgress,
  toBadgeItems,
  toBadgeTotals,
  toLevelBadges,
  toLevelProgress,
  toTotalCpeCredits,
} from './cpe.model';

describe('parseCreditProgress', () => {
  it('parses the "earned/target" string both #5 and #23 send', () => {
    expect(parseCreditProgress('12.5/30')).toEqual({
      earned: 12.5,
      target: 30,
      percent: 12.5 / 0.3,
    });
    expect(parseCreditProgress('30/30')?.percent).toBe(100);
  });

  it('returns null rather than zeros so "no data" is distinguishable', () => {
    expect(parseCreditProgress(undefined)).toBeNull();
    expect(parseCreditProgress('')).toBeNull();
    expect(parseCreditProgress('30')).toBeNull();
    expect(parseCreditProgress('a/b')).toBeNull();
  });

  it('does not divide by zero', () => {
    expect(parseCreditProgress('0/0')).toEqual({ earned: 0, target: 0, percent: 0 });
  });

  it('clamps an over-target ratio to 100', () => {
    expect(parseCreditProgress('45/30')?.percent).toBe(100);
  });
});

describe('toLevelProgress', () => {
  const response: LevelsProgressResponse = {
    status: true,
    data: {
      total_cpe_credits: 42,
      levels: [
        { level_number: 2, level_name: 'Silver', status: 'Ongoing', progress: '12/60' },
        { level_number: 3, level_name: 'Gold', status: 'Locked' },
        { level_number: 1, level_name: 'Bronze', status: 'Completed' },
      ],
    },
  };

  it('preserves server order — the array is rotated on purpose', () => {
    // #5 rotates so the first "Ongoing" level leads. Re-sorting undoes that.
    expect(toLevelProgress(response).map((l) => l.levelNumber)).toEqual([2, 3, 1]);
  });

  it('reads an unknown status as Locked, the conservative default', () => {
    expect(
      toLevelProgress({ status: true, data: { levels: [{ status: 'Weird' }] } })[0].status,
    ).toBe('Locked');
    expect(toLevelProgress({ status: true, data: { levels: [{}] } })[0].status).toBe('Locked');
  });

  it('survives a half-shaped response', () => {
    expect(toLevelProgress(undefined)).toEqual([]);
    expect(toLevelProgress({ status: true })).toEqual([]);
    expect(toLevelProgress({ status: true, data: { levels: null } })).toEqual([]);
    expect(toTotalCpeCredits(undefined)).toBe(0);
    expect(toTotalCpeCredits(response)).toBe(42);
  });
});

describe('currentLevelNumber', () => {
  const level = (levelNumber: number, status: 'Ongoing' | 'Completed' | 'Locked') => ({
    levelNumber,
    levelName: '',
    status,
    progress: null,
    targetCpe: null,
    credlyAssertionId: null,
    credlyAcceptedUrl: null,
  });

  it('prefers the ongoing level', () => {
    expect(currentLevelNumber([level(1, 'Completed'), level(2, 'Ongoing')])).toBe(2);
  });

  it('reports the last level once everything is complete', () => {
    expect(currentLevelNumber([level(1, 'Completed'), level(3, 'Completed')])).toBe(3);
  });

  it('reports null when nothing is ongoing and nothing is finished', () => {
    expect(currentLevelNumber([level(1, 'Locked')])).toBeNull();
    expect(currentLevelNumber([])).toBeNull();
  });
});

describe('toBadgeItems', () => {
  const response: AllBadgesResponse = {
    status: 'success',
    data: {
      caira_based_data: {
        levels: [
          {
            level_number: 1,
            caira_masterclass_badges: [
              {
                masterclass_badge: {
                  course_name: 'AI Basics',
                  cpe_credit_allocated: 2,
                  allocated_on: '2026-01-01',
                  course_thumbnail_url: 'https://thumb',
                },
                credly_accept_url: 'https://credly/accept',
              },
            ],
            caira_webinar_badges: [
              {
                webinar_badge: { webinar_name: 'Live AI', cpe_credit_allocated: 1 },
                credly_badge_image_url: 'https://badge.png',
              },
            ],
          },
        ],
      },
      non_caira_based_data: {
        non_caira_podcast_badges: [{ masterclass_badge: { course_name: 'Pod' } }],
      },
    },
  };

  it('tags CAIRA badges with their level and NON-CAIRA with none', () => {
    const items = toBadgeItems(response);
    expect(items.map((i) => [i.contentType, i.category, i.level])).toEqual([
      ['Masterclass', 'CAIRA', 'L1'],
      ['Webinar', 'CAIRA', 'L1'],
      ['Podcast', 'NON-CAIRA', undefined],
    ]);
  });

  it('reads webinar detail from webinar_badge and everything else from masterclass_badge', () => {
    // Podcast and reel badges nest under `masterclass_badge` too — the backend
    // reuses one builder, so the key does not identify the content type.
    const items = toBadgeItems(response);
    expect(items[1].title).toBe('Live AI');
    expect(items[2].title).toBe('Pod');
  });

  it('falls back to the Credly art for webinars, which carry no content image', () => {
    const items = toBadgeItems(response);
    expect(items[0].thumbnailUrl).toBe('https://thumb');
    expect(items[1].thumbnailUrl).toBe('https://badge.png');
  });

  it('does not mistake the Credly badge art for a content thumbnail', () => {
    const [item] = toBadgeItems({
      status: 'success',
      data: {
        caira_based_data: {
          levels: [
            {
              level_number: 1,
              caira_masterclass_badges: [
                { masterclass_badge: {}, credly_badge_image_url: 'https://badge.png' },
              ],
            },
          ],
        },
      },
    });
    expect(item.thumbnailUrl).toBeNull();
  });

  it('survives a half-shaped response', () => {
    expect(toBadgeItems(undefined)).toEqual([]);
    expect(toBadgeItems({ status: 'success', data: {} })).toEqual([]);
    expect(
      toBadgeItems({ status: 'success', data: { caira_based_data: { levels: null } } }),
    ).toEqual([]);
  });
});

describe('toLevelBadges', () => {
  // The backend defect: `caira_badges.progress` uses the GLOBAL grand total as
  // its numerator, so every level reports the same earned figure.
  const response: AllBadgesResponse = {
    status: 'success',
    data: {
      caira_based_data: {
        levels: [
          {
            level_name: 'Bronze',
            caira_badges: { level: 'L1', progress: '45/30', status: 'Completed' },
            caira_masterclass_badges: [{ masterclass_badge: { cpe_credit_allocated: 20 } }],
            caira_webinar_badges: [{ webinar_badge: { cpe_credit_allocated: 10 } }],
          },
          {
            level_name: 'Silver',
            caira_badges: { level: 'L2', progress: '45/60', status: 'Ongoing' },
            caira_masterclass_badges: [{ masterclass_badge: { cpe_credit_allocated: 15 } }],
          },
        ],
      },
    },
  };

  it('keeps the server value on progress so the defect stays inspectable', () => {
    const badges = toLevelBadges(response);
    expect(badges[0].progress?.earned).toBe(45);
    expect(badges[1].progress?.earned).toBe(45);
  });

  it('rebuilds the numerator per level on progressCorrected', () => {
    const badges = toLevelBadges(response);
    expect(badges[0].progressCorrected).toEqual({ earned: 30, target: 30, percent: 100 });
    expect(badges[1].progressCorrected).toEqual({ earned: 15, target: 60, percent: 25 });
  });

  it('reports no correction when the server sent no parseable progress', () => {
    expect(
      toLevelBadges({
        status: 'success',
        data: { caira_based_data: { levels: [{ caira_badges: {} }] } },
      })[0].progressCorrected,
    ).toBeNull();
  });

  it('survives a half-shaped response', () => {
    expect(toLevelBadges(undefined)).toEqual([]);
    expect(toLevelBadges({ status: 'success', data: {} })).toEqual([]);
  });
});

describe('toBadgeTotals', () => {
  it('defaults every total to zero', () => {
    expect(toBadgeTotals(undefined)).toEqual({
      cairaCredits: 0,
      nonCairaCredits: 0,
      grandTotal: 0,
    });
  });

  it('reads the totals block', () => {
    expect(
      toBadgeTotals({
        status: 'success',
        data: { totals: { caira_credits: 30, non_caira_credits: 5, grand_total: 35 } },
      }),
    ).toEqual({ cairaCredits: 30, nonCairaCredits: 5, grandTotal: 35 });
  });
});
