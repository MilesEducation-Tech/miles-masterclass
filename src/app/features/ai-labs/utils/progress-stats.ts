/**
 * Pure arithmetic for the AI Labs progress panel — a plain module with no Angular imports, so the
 * rules below can be read and reasoned about without a component around them.
 */

/**
 * How much of the learner's catalogue is finished, 0–100.
 *
 * `available` of 0 means nothing has been assigned yet, which is 0% rather than a division by
 * zero. The result is clamped because `completed` can briefly exceed `available` if an assignment
 * is retired between reads — a 130% bar is worse than a full one.
 */
export function labCompletionPercent(completed: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / available) * 100)));
}

/**
 * Whether a server-sent figure is worth rendering.
 *
 * `null`, `undefined`, `NaN` and a missing key all mean the backend didn't send the number; `0`
 * means there is nothing to report. Neither earns a tile — a dashboard of zeros reads as real data
 * the learner has to interpret, when the honest answer is that there is nothing there yet.
 *
 * Coerces rather than type-checks, so a numeric string (`"4"`) still counts and an empty one
 * doesn't.
 */
export function hasStatValue(value: unknown): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0;
}
