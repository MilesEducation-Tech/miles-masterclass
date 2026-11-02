import type { ProgressVariant } from '@shared/ui/progress/progress';

/**
 * Meter arithmetic for the Copilot Credits cap.
 *
 * A plain module apart from the `import type`, so nothing from the component graph comes with it.
 */

/** Above this share of the cap the meter warns; above `CRITICAL_AT` it alarms. */
const WARN_AT = 75;
const CRITICAL_AT = 90;

/**
 * Clamped, so an over-spent cap renders as a full bar rather than a broken one, and a zero cap
 * doesn't divide by zero. `used` arrives as a decimal string (`"1840.75"`); an unparseable one
 * reads as nothing used rather than a NaN bar.
 */
export function tokenUsedPercent(cap: number, used: string): number {
  const spent = Number(used);
  if (cap <= 0 || !Number.isFinite(spent)) return 0;
  return Math.min(100, Math.max(0, (spent / cap) * 100));
}

export function tokenMeterVariant(percent: number): ProgressVariant {
  if (percent >= CRITICAL_AT) return 'error';
  if (percent >= WARN_AT) return 'warning';
  return 'info';
}
