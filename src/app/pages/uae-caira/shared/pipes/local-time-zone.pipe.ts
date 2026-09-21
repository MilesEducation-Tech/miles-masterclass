import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

/**
 * Returns the VISITOR'S local timezone as a short abbreviation for a given
 * date — e.g. "IST", "GST", "EDT". Pairs with a plain `DatePipe` (no `timezone`
 * arg, so the time is already rendered in the visitor's local zone) to replace
 * the hard-coded "ET" label.
 *
 * We resolve the readable long name via `Intl.DateTimeFormat` with
 * `timeZoneName: 'long'` (no `timeZone` option → host's local zone) and then
 * acronym it to its initials — "India Standard Time" → "IST". This is
 * locale-independent (the long English name is stable in en-*), whereas
 * `timeZoneName: 'short'` yields raw offsets like "GMT+5:30" for many zones
 * under en-US. DST-aware because it resolves the name for the given date
 * (e.g. Standard vs Daylight).
 */
@Pipe({ name: 'localTimeZone' })
export class LocalTimeZonePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const longName = new Intl.DateTimeFormat(this.locale, { timeZoneName: 'long' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!longName) return '';

    // Multi-word descriptive name → initials ("India Standard Time" → "IST").
    // Anything else (a single word, or a raw "GMT+5:30" offset) is returned
    // verbatim since there's nothing meaningful to abbreviate.
    if (/^GMT/i.test(longName) || !longName.includes(' ')) return longName;
    return longName
      .split(/\s+/)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();
  }
}
