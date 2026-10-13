import { LevelBadge } from '../models/caira-badge-page.model';

/**
 * Which rung the hero's chevrons park on, given a freshly-emitted ladder and the previous
 * `linkedSignal` state.
 *
 * `previousLevels` matters: while it is empty the seed hasn't happened yet, so a fetch that
 * finally delivers rungs must re-seed rather than keep the placeholder rank. Once a real
 * ladder is in hand the user's pick wins, as long as that rung still exists.
 *
 * `focus` is the server's own answer — `cpe_summary.current_level`, falling back to
 * `next_level`. The ladder rows no longer carry per-rung progress, so there is nothing to
 * derive it from locally.
 */
export function seedLevelRank(
  levels: readonly LevelBadge[],
  previousLevels: readonly LevelBadge[] | undefined,
  previousRank: number | undefined,
  focus: number,
): number {
  const picked = previousLevels?.length ? previousRank : undefined;
  if (picked !== undefined && levels.some((l) => l.level.number === picked)) return picked;
  if (levels.some((l) => l.level.number === focus)) return focus;
  return levels[0]?.level.number ?? 1;
}

/**
 * The line under the progress bar. Completing the *current* rung is what unlocks the next
 * one, so the remaining credits are always measured against this rung's own threshold.
 */
export function levelProgressHint(
  level: LevelBadge,
  next: LevelBadge | null,
  earnedCredits: number,
): string {
  const remaining = Math.max(0, level.level.cpe_threshold - earnedCredits);
  const rank = level.level.number;

  if (remaining === 0) {
    return next
      ? `Level ${rank} complete — Level ${next.level.number} unlocked.`
      : `Level ${rank} complete.`;
  }
  return next
    ? `Earn ${remaining} credits to unlock Level ${next.level.number} status.`
    : `Earn ${remaining} credits to complete Level ${rank}.`;
}

/** This rung's own bar: CAIRA credits earned against its threshold, clamped to 0–100. */
export function levelPercentage(level: LevelBadge, earnedCredits: number): number {
  const threshold = level.level.cpe_threshold;
  if (threshold <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((earnedCredits / threshold) * 100)));
}
