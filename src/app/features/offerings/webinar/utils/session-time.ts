/**
 * Pure time helpers for the webinar module — parsing, splitting a remaining
 * duration, and the three label formats the designs ask for.
 *
 * Deliberately free of Angular: nothing here injects, ticks or holds state, so
 * it is callable from a component, a facade or a test without a TestBed. The
 * ticking half — clock-skew correction and the single shared interval — is
 * `services/server-clock.ts`, which is a `@Service` and belongs there.
 */

/** `Date.parse` that returns `null` rather than `NaN`, for nullable API fields. */
export function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

/** Split a remaining duration into parts. Clamps at zero — never counts up. */
export function splitDuration(remainingMs: number): CountdownParts {
  const totalMs = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

/**
 * Compact countdown label: `2d 04h`, `4h 12m`, `12m 30s`, `45s`.
 *
 * Drops to the two most significant units because a card showing
 * "2d 04h 12m 30s" is noise — nobody acts on the seconds two days out.
 */
export function formatCountdown(parts: CountdownParts): string {
  if (parts.days > 0) return `${parts.days}d ${String(parts.hours).padStart(2, '0')}h`;
  if (parts.hours > 0) return `${parts.hours}h ${String(parts.minutes).padStart(2, '0')}m`;
  if (parts.minutes > 0) return `${parts.minutes}m ${String(parts.seconds).padStart(2, '0')}s`;
  return `${parts.seconds}s`;
}

/**
 * Long-form countdown: `4 days`, `4 hours and 30 minutes`, `12 minutes`.
 *
 * The sentence form the hero and the detail page read as "This webinar starts
 * in {…}". Compact `formatCountdown` stays the right answer inside a card
 * strip, where a full sentence would not fit — this is the same data worded for
 * a headline rather than a badge.
 *
 * Two units at most, and the second is dropped when it is zero, so it reads
 * "4 hours" rather than "4 hours and 0 minutes". Units are singularised.
 */
export function formatCountdownLong(parts: CountdownParts): string {
  const unit = (value: number, name: string): string => `${value} ${name}${value === 1 ? '' : 's'}`;

  if (parts.days > 0) {
    return parts.hours > 0
      ? `${unit(parts.days, 'day')} and ${unit(parts.hours, 'hour')}`
      : unit(parts.days, 'day');
  }
  if (parts.hours > 0) {
    return parts.minutes > 0
      ? `${unit(parts.hours, 'hour')} and ${unit(parts.minutes, 'minute')}`
      : unit(parts.hours, 'hour');
  }
  if (parts.minutes > 0) {
    // Seconds only inside the last five minutes, where they are the thing being
    // watched — and still dropped at zero, like every other unit here.
    return parts.minutes < 5 && parts.seconds > 0
      ? `${unit(parts.minutes, 'minute')} and ${unit(parts.seconds, 'second')}`
      : unit(parts.minutes, 'minute');
  }
  return unit(parts.seconds, 'second');
}

/**
 * Ordinal suffix for a date's day-of-month — the `st` in "1st Jan 2026".
 *
 * `timeZone` must match whatever zone the surrounding date is being RENDERED
 * in. A suffix derived from UTC beside a pill formatted in the viewer's local
 * zone reads "31st" next to a "1", which is the kind of defect nobody reports
 * and everybody notices. Pass the same zone you pass `DatePipe`, or omit it
 * when the date is rendered locally.
 */
export function dayOrdinal(iso: string | null | undefined, timeZone?: string): string {
  const parsed = parseIso(iso);
  if (parsed === null) return '';

  const day = Number.parseInt(
    new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(new Date(parsed)),
    10,
  );
  if (Number.isNaN(day)) return '';

  const rem10 = day % 10;
  const rem100 = day % 100;
  if (rem10 === 1 && rem100 !== 11) return 'st';
  if (rem10 === 2 && rem100 !== 12) return 'nd';
  if (rem10 === 3 && rem100 !== 13) return 'rd';
  return 'th';
}

/**
 * The timezone every session time on the webinar surfaces is quoted in.
 *
 * An IANA name, not the `EST` abbreviation `DatePipe` takes: `EST` is a fixed
 * −5 zone that never observes DST, so a July webinar would be advertised an
 * hour early. `Intl` resolves the real offset for the date in hand, and does it
 * identically under Node and in the browser — so the string SSR renders is the
 * one hydration finds, with no mismatch.
 */
export const SESSION_TIMEZONE = 'America/New_York';

/** A start time broken into the pieces the designs actually arrange. */
export interface SessionParts {
  /** `NOV` — already upper-cased, as the date pill renders it. */
  month: string;
  /** `12`, no leading zero. */
  day: string;
  /** `th` in "12th". */
  ordinal: string;
  year: string;
  /** `7:00 PM`, with no zone appended. */
  time: string;
  /** `EST` / `EDT`, whichever applies on that date. */
  zone: string;
}

/**
 * Split a start time into display parts, all resolved in `SESSION_TIMEZONE`.
 *
 * One function rather than a formatter per surface: the date pill, the hero
 * line and the card all quote the same instant, and the only way they cannot
 * disagree about the zone is to derive from the same place.
 */
export function sessionParts(iso: string | null | undefined): SessionParts | null {
  const ms = parseIso(iso);
  if (ms === null) return null;

  const at = new Date(ms);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { ...options, timeZone: SESSION_TIMEZONE }).format(at);

  return {
    month: format({ month: 'short' }).toUpperCase(),
    day: format({ day: 'numeric' }),
    ordinal: dayOrdinal(iso, SESSION_TIMEZONE),
    year: format({ year: 'numeric' }),
    time: format({ hour: 'numeric', minute: '2-digit' }),
    // `timeZoneName` has to come off `formatToParts` — asking for it inline
    // glues it to the time ("7:00 PM EST") and every design brackets it.
    zone:
      new Intl.DateTimeFormat('en-US', {
        timeZone: SESSION_TIMEZONE,
        timeZoneName: 'short',
      })
        .formatToParts(at)
        .find((part) => part.type === 'timeZoneName')?.value ?? 'ET',
  };
}

/** `1st Jan 2026 | 7:00 PM (EST)` — the full session line. */
export function formatSessionLabel(iso: string | null | undefined): string | null {
  const parts = sessionParts(iso);
  if (!parts) return null;
  const month = parts.month.charAt(0) + parts.month.slice(1).toLowerCase();
  return `${parts.day}${parts.ordinal} ${month} ${parts.year} | ${parts.time} (${parts.zone})`;
}
