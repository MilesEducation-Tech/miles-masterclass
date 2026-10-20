import type { ProgressVariant } from '@shared/ui/progress/progress';

/**
 * Meter arithmetic for the AI Lab token allotment.
 *
 * A plain module apart from the `import type`, so nothing from the component graph comes with it.
 */

/** Above this share of the allotment the meter warns; above `CRITICAL_AT` it alarms. */
const WARN_AT = 75;
const CRITICAL_AT = 90;

/**
 * Clamped, so an over-spent allotment renders as a full bar rather than a broken one, and a zero
 * allotment doesn't divide by zero.
 */
export function tokenUsedPercent(allotted: number, used: number): number {
  if (allotted <= 0) return 0;
  return Math.min(100, Math.max(0, (used / allotted) * 100));
}

export function tokenMeterVariant(percent: number): ProgressVariant {
  if (percent >= CRITICAL_AT) return 'error';
  if (percent >= WARN_AT) return 'warning';
  return 'info';
}
