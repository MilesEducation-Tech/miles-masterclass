import { describe, expect, it } from 'vitest';
import { CairaLadderItem } from '../../../../shared/core/models/caira-badge.model';
import { levelSlides } from './level-carousel';

const level = (rank: number, icon = `icon-${rank}.png`): CairaLadderItem =>
  ({
    id: 500 + rank,
    badge: { level_rank: rank, icon_url: icon } as CairaLadderItem['badge'],
    status: 'locked',
    progress: { earned: 0, required: 30, percentage: 0 },
    awarded_at: null,
    image_url: null,
    accept_url: null,
  }) as CairaLadderItem;

const ladder = [level(1), level(2), level(3)];

describe('levelSlides', () => {
  it('centres the selected level and floats its neighbours above and below', () => {
    const slides = levelSlides(ladder, 2);
    expect(slides.map((s) => s.transform)).toEqual([
      'translateY(-38%) scale(0.55)',
      'translateY(0%) scale(1)',
      'translateY(38%) scale(0.55)',
    ]);
    expect(slides.map((s) => s.isActive)).toEqual([false, true, false]);
    expect(slides[1].zIndex).toBeGreaterThan(slides[0].zIndex);
  });

  it('keeps all three visible — neighbours faded, never hidden', () => {
    const [above, active, below] = levelSlides(ladder, 2);
    expect(active.opacity).toBe(1);
    for (const n of [above, below]) {
      expect(n.opacity).toBeGreaterThan(0);
      expect(n.opacity).toBeLessThan(1);
    }
  });

  it('shows one neighbour at each end of the ladder', () => {
    expect(levelSlides(ladder, 1).map((s) => s.opacity > 0)).toEqual([true, true, false]);
    expect(levelSlides(ladder, 3).map((s) => s.opacity > 0)).toEqual([false, true, true]);
  });

  it('parks distant levels at the neighbour slot so a step never remounts DOM', () => {
    const long = [level(1), level(2), level(3), level(4), level(5)];
    const slides = levelSlides(long, 3);
    // Every level still renders...
    expect(slides).toHaveLength(5);
    // ...but levels 1 and 5 are invisible, and clamped to one step out rather
    // than flung two steps away.
    expect(slides[0]).toMatchObject({ opacity: 0, transform: 'translateY(-38%) scale(0.55)' });
    expect(slides[4]).toMatchObject({ opacity: 0, transform: 'translateY(38%) scale(0.55)' });
  });

  it('falls back to the badge icon when the level has no awarded image', () => {
    expect(levelSlides(ladder, 1)[0].imageUrl).toBe('icon-1.png');
    expect(levelSlides([level(1, '')], 1)[0].imageUrl).toBeNull();
  });

  it('renders nothing for an empty ladder', () => {
    expect(levelSlides([], 1)).toEqual([]);
  });
});
