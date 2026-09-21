/** Eastern Time short-name abbreviations — DST-aware. */
export type EasternAbbrev = 'EST' | 'EDT';

/**
 * Resolves the correct Eastern Time abbreviation (`'EST'` / `'EDT'`) for a
 * given instant using the IANA database. Returns `'EST'` as a safe fallback
 * for invalid inputs.
 *
 * The same value is used as the `DatePipe` timezone arg AND the label suffix,
 * so the rendered time and the badge after it never disagree across DST
 * changes. (`DatePipe` parses its `timezone` arg via `Date.parse`, which takes
 * these abbreviations but *not* IANA names like `'America/New_York'`.)
 *
 * Example:
 *   easternAbbrevFor('2026-01-10T12:00:00-05:00') → 'EST'
 *   easternAbbrevFor('2026-06-05T12:00:00-04:00') → 'EDT'
 */
export function easternAbbrevFor(date: string | Date | null | undefined): EasternAbbrev {
  if (date == null) return 'EST';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'EST';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).formatToParts(d);
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tz === 'EDT' ? 'EDT' : 'EST';
  } catch {
    return 'EST';
  }
}
