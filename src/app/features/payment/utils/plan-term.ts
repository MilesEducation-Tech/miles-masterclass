/**
 * How a plan's term reads on the plan cards and the comparison table. CAIRA prices plans
 * by term (`duration_months`), so the term is the plan's name on screen.
 */
export function planTermName(months: number): string {
  if (months === 12) return 'Annual';
  if (months === 1) return 'Monthly';
  return `${months} months`;
}

/** The price suffix: `$948/year`, `$99/month`, `$499/6 months`. */
export function planTermPer(months: number): string {
  if (months === 12) return 'year';
  if (months === 1) return 'month';
  return `${months} months`;
}
