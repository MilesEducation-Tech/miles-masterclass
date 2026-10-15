import { LevelBadge } from '@features/tracker/caira/models/caira-badge-page.model';

/** How far a neighbouring badge sits from the centre, as a % of the rail height. */
const STEP_PERCENT = 38;
const NEIGHBOUR_SCALE = 0.55;
const NEIGHBOUR_OPACITY = 0.4;

export interface LevelSlide {
  item: LevelBadge;
  imageUrl: string | null;
  /** Translate first, then scale — so shrinking a neighbour doesn't close the gap. */
  transform: string;
  opacity: number;
  zIndex: number;
  isActive: boolean;
}

/**
 * Lays the CAIRA ladder out as a vertical carousel: the selected rung full size in the
 * centre, its immediate neighbours peeking above and below at roughly half scale.
 *
 * Every rung stays in the list, including ones more than a step away. Those are parked at
 * the neighbour position with `opacity: 0` rather than dropped, so a step never adds or
 * removes DOM — the browser can then transition every slide instead of popping a
 * newly-mounted one into place. That is also why the offset is clamped to one step: an
 * unclamped ladder would fling a distant badge across the rail.
 */
export function levelSlides(levels: readonly LevelBadge[], selectedRank: number): LevelSlide[] {
  return levels.map((item) => {
    const distance = item.level.number - selectedRank;
    const clamped = Math.max(-1, Math.min(1, distance));
    const isActive = distance === 0;
    const isNeighbour = Math.abs(distance) === 1;

    return {
      item,
      // Empty strings count as missing — binding `ngSrc=""` throws NG02952.
      imageUrl: item.badge_image_url || null,
      transform: `translateY(${clamped * STEP_PERCENT}%) scale(${isActive ? 1 : NEIGHBOUR_SCALE})`,
      opacity: isActive ? 1 : isNeighbour ? NEIGHBOUR_OPACITY : 0,
      zIndex: isActive ? 20 : 10,
      isActive,
    };
  });
}
