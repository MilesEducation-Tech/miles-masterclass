import { CairaLadderItem } from '@core/models/caira-badge.model';

/**
 * Which level the hero's chevrons park on, given a freshly-emitted ladder and
 * the previous `linkedSignal` state.
 *
 * `previousLadder` matters: while it is empty the seed hasn't happened yet, so
 * a fetch that finally delivers rows must re-seed rather than keep the
 * placeholder rank. Once a real ladder is in hand the user's pick wins, as long
 * as that level still exists.
 */
export function seedLevelRank(
  ladder: readonly CairaLadderItem[],
  previousLadder: readonly CairaLadderItem[] | undefined,
  previousRank: number | undefined,
): number {
  const picked = previousLadder?.length ? previousRank : undefined;
  if (picked !== undefined && ladder.some((l) => l.badge.level_rank === picked)) return picked;
  // First level still in play; a fully-earned ladder parks on the top rung.
  return (
    ladder.find((l) => l.status !== 'earned')?.badge.level_rank ??
    ladder.at(-1)?.badge.level_rank ??
    1
  );
}

/**
 * The line under the progress bar. Completing the *current* level is what
 * unlocks the next one, so the remaining credits are always measured against
 * the current level's own requirement.
 */
export function levelProgressHint(level: CairaLadderItem, next: CairaLadderItem | null): string {
  const remaining = Math.max(0, level.progress.required - level.progress.earned);
  const rank = level.badge.level_rank;

  if (remaining === 0) {
    return next
      ? `Level ${rank} complete — Level ${next.badge.level_rank} unlocked.`
      : `Level ${rank} complete.`;
  }
  return next
    ? `Earn ${remaining} credits to unlock Level ${next.badge.level_rank} status.`
    : `Earn ${remaining} credits to complete Level ${rank}.`;
}
