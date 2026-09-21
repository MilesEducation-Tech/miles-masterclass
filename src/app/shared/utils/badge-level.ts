/**
 * Shared level → color helpers for badge surfaces.
 *
 * Three badge level ranks (1, 2, 3) drive bronze / silver / gold palettes
 * across the cpe-tracker carousel slide, the "View all" dialog grid card,
 * and the library badge-card halo. Unknown / out-of-range ranks fall back
 * to level 1 (preserves prior behavior of the inlined switches these
 * helpers replaced).
 */

export type BadgeLevelRank = 1 | 2 | 3;

const LEVEL_GRADIENT: Record<BadgeLevelRank, string> = {
  1: 'from-[#BB9253] to-[#9C7337] stroke-[#321A04]',
  2: 'from-[#CFD0D0] to-[#8F9092] stroke-[#2F2F31]',
  3: 'from-[#ECD67F] to-[#B28332] stroke-[#322205]',
};

const PROGRESS_GRADIENT: Record<BadgeLevelRank, string> = {
  1: 'from-[#9C7036] to-[#552C02]',
  2: 'from-[#ABADB1] to-[#4C4D52]',
  3: 'from-[#D9AA3B] to-[#BC8C1E]',
};

const HALO_HEX: Record<BadgeLevelRank, string> = {
  1: '#BB9253',
  2: '#CFD0D0',
  3: '#ECD67F',
};

function clampRank(rank: number | null | undefined): BadgeLevelRank {
  return rank === 2 || rank === 3 ? rank : 1;
}

/** Tailwind classes for the headline gradient on a hero badge slide. */
export function badgeLevelGradient(rank: number | null | undefined): string {
  return LEVEL_GRADIENT[clampRank(rank)];
}

/** Tailwind classes for the progress-bar fill gradient. */
export function badgeProgressGradient(rank: number | null | undefined): string {
  return PROGRESS_GRADIENT[clampRank(rank)];
}

/** Hex color for the soft halo behind a badge icon. */
export function badgeHaloHex(rank: number | null | undefined): string {
  return HALO_HEX[clampRank(rank)];
}
